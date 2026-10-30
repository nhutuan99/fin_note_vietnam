<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useEventListener } from '@/composables/useEventListener'
import { useRoute, useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { useReminderStore } from '@/stores/reminders'
import { useUiStore } from '@/stores/ui'
import RichEditor from '@/components/editor/RichEditor.vue'
import AiPanel from '@/components/editor/AiPanel.vue'
import ShareNoteModal from '@/components/ui/ShareNoteModal.vue'
import ReminderSuggestionModal from '@/components/ui/ReminderSuggestionModal.vue'
import type { ReminderSuggestion } from '@/types'
import { ArrowLeft, Save, Pin, Trash2, Tag, X, Plus, Check, Sparkles, Bell, Share2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { autoFormatJsonContent } from '@/shared/utils/jsonFormatter'

const route = useRoute()
const router = useRouter()
const notesStore = useNotesStore()
const ui = useUiStore()
const { t } = useI18n()

const title = ref('')
const content = ref('')
const tags = ref<string[]>([])
const pinned = ref(false)
const isPublic = ref(false)
const sharedWith = ref<string[]>([])
const newTag = ref('')
const saving = ref(false)
const lastSaved = ref('')
const hasChanges = ref(false)
const showTagInput = ref(false)
let saveTimeout: ReturnType<typeof setTimeout> | null = null
const loadingNote = ref(true)
const noteId = computed(() => route.params.id as string)

// AI Panel
const showAiPanel = ref(false)

async function loadNote(id: string) {
  loadingNote.value = true
  hasChanges.value = false
  if (saveTimeout) clearTimeout(saveTimeout)
  const note = await notesStore.fetchNote(id)
  if (note) {
    title.value = note.title
    content.value = note.content
    tags.value = [...note.tags]
    pinned.value = note.pinned
    isPublic.value = !!note.isPublic
    sharedWith.value = note.sharedWith || []
    lastSaved.value = new Date(note.updatedAt).toLocaleTimeString()
  } else {
    ui.showToast('error', t('common.somethingWentWrong'))
    router.push('/notes')
  }
  loadingNote.value = false
}

onMounted(() => loadNote(noteId.value))

// Re-fetch when navigating to a different note (e.g. sidebar click)
watch(noteId, (newId, oldId) => {
  if (newId && newId !== oldId) loadNote(newId)
})

useEventListener(document, 'keydown', handleKeydown)

onUnmounted(() => {
  if (saveTimeout) clearTimeout(saveTimeout)
  if (hasChanges.value) saveNote()
})

watch(
  [title, content, tags, pinned],
  () => {
    hasChanges.value = true
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => saveNote(), 2000)
  },
  { deep: true }
)



async function saveNote() {
  if (!noteId.value || saving.value) return
  saving.value = true
  try {
    // Auto-format JSON data
    const formattedJson = autoFormatJsonContent(content.value)
    if (formattedJson && content.value !== formattedJson) {
      content.value = formattedJson
    }

    await notesStore.updateNote(noteId.value, {
      title: title.value,
      content: content.value,
      tags: tags.value,
      pinned: pinned.value
    })
    hasChanges.value = false
    lastSaved.value = new Date().toLocaleTimeString()
  } catch {
    ui.showToast('error', t('common.somethingWentWrong'))
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  const confirmed = await ui.requestConfirm({
    title: t('notes.deleteTitle'),
    message: t('notes.deleteMessage'),
    danger: true,
    confirmText: t('notes.deleteConfirm')
  })

  if (confirmed) {
    if (await notesStore.deleteNote(noteId.value)) {
      ui.showToast('success', t('notes.noteDeleted'))
      router.push('/notes')
    }
  }
}

function addTag() {
  const t = newTag.value.trim().toLowerCase()
  if (t && !tags.value.includes(t)) {
    tags.value.push(t)
    newTag.value = ''
  }
}

function handleTagKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    addTag()
  }
  if (e.key === 'Escape') showTagInput.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveNote()
  }
}

// AI handlers
function toggleAiPanel() {
  showAiPanel.value = !showAiPanel.value
}

import { marked } from 'marked'

function handleAiInsert(text: string, isHtml = false) {
  if (isHtml) {
    content.value += `\n${text}`
  } else {
    // Parse markdown so code blocks and formatting from AI render correctly in Tiptap
    const html = marked.parse(text) as string
    content.value += `\n${html}`
  }
  ui.showToast('success', t('notes.ai.insert'))
}

function handleAiReplace(text: string) {
  // Parse markdown so code blocks and formatting from AI render correctly
  const html = marked.parse(text) as string
  content.value = html
  ui.showToast('success', t('notes.ai.insert'))
  showAiPanel.value = false
}

// Sharing logic
const showShareModal = ref(false)
async function handleSaveShare(newIsPublic: boolean, newSharedWith: string[]) {
  isPublic.value = newIsPublic
  sharedWith.value = newSharedWith
  const success = await notesStore.updateNoteShare(noteId.value, newIsPublic, newSharedWith)
  if (success) {
    ui.showToast('success', t('notes.share.updateSuccess'))
  } else {
    ui.showToast('error', t('notes.share.updateError'))
  }
  showShareModal.value = false
}

const reminderStore = useReminderStore()
const extractingEvents = ref(false)
const reminderSuggestions = ref<ReminderSuggestion[]>([])

async function handleExtractEvents() {
  if (!content.value.trim() || extractingEvents.value) return
  extractingEvents.value = true
  try {
    // Convert HTML to readable plain text for AI
    const rawText = content.value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>?/gm, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    const suggestions = await reminderStore.detectFromText(rawText)
    if (suggestions.length > 0) {
      reminderSuggestions.value = suggestions
    } else {
      ui.showToast('info', t('reminders.noEventsFound'))
    }
  } catch (e) {
    ui.showToast('error', t('common.somethingWentWrong'))
  } finally {
    extractingEvents.value = false
  }
}

function handleApplyTags(aiTags: string[]) {
  const newTags = aiTags.filter(t => !tags.value.includes(t))
  tags.value.push(...newTags)
  ui.showToast('success', t('common.tagsAdded', { n: newTags.length }))
}
</script>

<template>
  <div class="mx-auto flex min-h-[calc(100vh-3.5rem-3rem)] max-w-[68rem] flex-col">
    <!-- Toolbar -->
    <div
      class="border-border-default mb-4 flex flex-col items-start justify-between gap-3 border-b pb-4 sm:flex-row sm:items-center"
    >
      <div class="flex items-center gap-3">
        <button
          id="back-to-notes-btn"
          @click="router.push('/notes')"
          class="text-text-secondary hover:bg-bg-hover hover:text-text-primary flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
        >
          <ArrowLeft :size="18" />
        </button>
        <div class="flex items-center gap-1 text-sm">
          <template v-if="saving"><span class="text-warning">{{ t('common.saving') }}</span></template>
          <template v-else-if="hasChanges">
            <span class="text-text-tertiary">{{ t('common.unsavedChanges') }}</span>
          </template>
          <template v-else-if="lastSaved">
            <Check :size="14" class="text-success" />
            <span class="text-text-disabled">{{ t('common.saved', { time: lastSaved }) }}</span>
          </template>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          id="extract-events-btn"
          :title="t('notes.scanEvents')"
          class="flex h-[2.125rem] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-all duration-150 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          @click="handleExtractEvents"
          :disabled="extractingEvents"
        >
          <AppSpinner v-if="extractingEvents" :size="15"  />
          <Bell v-else :size="15" />
          <span class="hidden sm:inline">{{ t('notes.scanEvents') }}</span>
        </button>

        <button
          id="share-note-btn"
          :title="t('notes.shareBtn')"
          class="flex h-[2.125rem] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-all duration-150 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          @click="showShareModal = true"
        >
          <Share2 :size="15" />
          <span class="hidden sm:inline">{{ t('notes.shareBtn') }}</span>
        </button>

        <!-- AI Button -->
        <button
          id="ai-panel-btn"
          :title="t('notes.ai.assistant')"
          class="flex h-[2.125rem] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-all duration-150"
          :class="showAiPanel
            ? 'bg-accent-subtle text-accent'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'"
          @click="toggleAiPanel"
        >
          <Sparkles :size="15" />
          <span class="hidden sm:inline">AI</span>
        </button>

        <button
          id="pin-note-btn"
          :title="pinned ? 'Unpin' : 'Pin'"
          class="text-text-secondary hover:bg-bg-hover hover:text-text-primary flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
          :class="pinned ? 'text-warning' : ''"
          @click="pinned = !pinned"
        >
          <Pin :size="16" />
        </button>
        <button
          id="save-note-btn"
          :title="t('common.save')"
          @click="saveNote"
          class="text-text-secondary hover:bg-bg-hover hover:text-text-primary flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
        >
          <Save :size="16" />
        </button>
        <button
          id="delete-note-btn"
          :title="t('common.delete')"
          @click="handleDelete"
          class="text-text-secondary hover:bg-bg-hover hover:text-error flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <!-- Tags -->
    <div class="mb-2 flex items-center gap-2 pb-4">
      <Tag :size="14" class="text-text-disabled shrink-0" />
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-for="tag in tags"
          :key="tag"
          class="bg-accent-subtle text-accent flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium"
        >
          {{ tag }}
          <button
            class="text-accent opacity-60 transition-opacity duration-150 hover:opacity-100"
            @click="tags = tags.filter((t) => t !== tag)"
          >
            <X :size="12" />
          </button>
        </span>
        <button
          v-if="!showTagInput"
          class="border-border-default text-text-tertiary hover:border-accent hover:text-accent flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-[0.6875rem] transition-all duration-150"
          @click="showTagInput = true"
        >
          <Plus :size="12" />
          {{ t('notes.addTag') }}
        </button>
        <input
          v-else
          v-model="newTag"
          autofocus
          class="border-accent bg-accent-subtle text-accent w-[6.25rem] rounded-full border px-2.5 py-0.5 text-[0.6875rem] focus:outline-none"
          :placeholder="t('notes.typeTag')"
          @keydown="handleTagKeydown"
          @blur="showTagInput = false"
        />
      </div>
    </div>

    <template v-if="loadingNote">
      <div class="skeleton mb-4 h-[2.5rem] w-3/4"></div>
      <div class="skeleton mb-2 h-4 w-full"></div>
      <div class="skeleton mb-2 h-4 w-full"></div>
      <div class="skeleton mb-2 h-4 w-4/5"></div>
      <div class="skeleton mb-2 h-4 w-5/6"></div>
    </template>
    <template v-else>
      <!-- Title -->
      <input
        id="note-title-input"
        v-model="title"
        :placeholder="t('notes.untitledNote')"
        class="text-text-primary placeholder:text-text-disabled mb-4 w-full border-none bg-transparent py-2 text-[1.875rem] leading-tight font-bold tracking-tight focus:outline-none"
      />

      <!-- AI Panel -->
      <AiPanel
        :visible="showAiPanel"
        :title="title"
        :content="content"
        @close="showAiPanel = false"
        @insert-text="handleAiInsert"
        @replace-text="handleAiReplace"
        @apply-tags="handleApplyTags"
      />

      <!-- Rich Editor -->
      <RichEditor v-model="content" />
    </template>

    <ReminderSuggestionModal
      v-if="reminderSuggestions.length > 0"
      :suggestions="reminderSuggestions"
      @close="reminderSuggestions = []"
      @created="reminderSuggestions = []"
    />
    <ShareNoteModal
      v-if="showShareModal"
      :note-id="noteId"
      :initial-is-public="isPublic"
      :initial-shared-with="sharedWith"
      @close="showShareModal = false"
      @save="handleSaveShare"
    />
  </div>
</template>
