<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import { useNotesStore } from '@/stores/notes'
import { useReminderStore } from '@/stores/reminders'
import { useUiStore } from '@/stores/ui'
import { useEventListener } from '@/composables/useEventListener'
import { ApiError } from '@/shared/api/httpClient'
import { htmlToPlainText, readingMinutes } from '@/shared/utils/noteText'
import RichEditor from '@/components/editor/RichEditor.vue'
import AiPanel from '@/components/editor/AiPanel.vue'
import ShareNoteModal from '@/components/ui/ShareNoteModal.vue'
import ReminderSuggestionModal from '@/components/ui/ReminderSuggestionModal.vue'
import type { Note, ReminderSuggestion } from '@/types'
import {
  ArrowLeft, Pin, Trash2, X, Check, Sparkles, Bell, Share2, MoreHorizontal, Copy, CloudOff, Hash,
  Maximize2, Minimize2
} from 'lucide-vue-next'

/** Debounce between the last keystroke and the autosave request */
const AUTOSAVE_DELAY_MS = 1000
/** Retry delay after a failed save (network hiccup, worker error) */
const RETRY_DELAY_MS = 5000

const route = useRoute()
const router = useRouter()
const notesStore = useNotesStore()
const reminderStore = useReminderStore()
const ui = useUiStore()
const { t, locale } = useI18n()

const noteId = computed(() => route.params.id as string)

// ── Editable fields ──
const title = ref('')
const content = ref('')
const tags = ref<string[]>([])
const pinned = ref(false)
const isPublic = ref(false)
const sharedWith = ref<string[]>([])
const createdAt = ref('')

const loadingNote = ref(true)
const titleRef = ref<HTMLTextAreaElement | null>(null)
const editorRef = ref<InstanceType<typeof RichEditor> | null>(null)
const stats = ref({ words: 0, characters: 0 })

// ── Autosave state ──
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
const saveStatus = ref<SaveStatus>('idle')
const lastSavedAt = ref<Date | null>(null)
/** Server `updatedAt` this editor is based on (optimistic concurrency) */
let baseUpdatedAt = ''
/** Serialized fields as last persisted; anything different is unsaved */
const savedSnapshot = ref('')
let saveTimer: ReturnType<typeof setTimeout> | null = null
let inFlight: Promise<void> | null = null
let conflictOpen = false
/** Set once the note is deleted from this page, so leaving it neither saves nor deletes again */
let deleted = false

const snapshot = computed(() =>
  JSON.stringify({ title: title.value, content: content.value, tags: tags.value, pinned: pinned.value })
)
const isDirty = computed(() => !loadingNote.value && snapshot.value !== savedSnapshot.value)

function applyNote(note: Note) {
  title.value = note.title
  content.value = note.content
  tags.value = [...note.tags]
  pinned.value = note.pinned
  isPublic.value = !!note.isPublic
  sharedWith.value = note.sharedWith || []
  createdAt.value = note.createdAt
  baseUpdatedAt = note.updatedAt
  lastSavedAt.value = new Date(note.updatedAt)
  savedSnapshot.value = snapshot.value
}

async function loadNote(id: string, isNew = route.query.new === '1') {
  loadingNote.value = true
  clearSaveTimer()
  saveStatus.value = 'idle'
  const note = await notesStore.fetchNote(id)
  if (!note) {
    ui.showToast('error', t('notes.loadError'))
    router.replace('/notes')
    return
  }
  applyNote(note)
  loadingNote.value = false
  await nextTick()
  autoResizeTitle()
  // Fresh notes start with the cursor in the title
  if (isNew) titleRef.value?.focus()
}

function clearSaveTimer() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
}

function scheduleSave(delay = AUTOSAVE_DELAY_MS) {
  clearSaveTimer()
  saveTimer = setTimeout(() => void saveNote(), delay)
}

watch(snapshot, () => {
  if (isDirty.value) scheduleSave()
})

/**
 * Persists the current fields. Saves are serialized: a change made while a request is in flight
 * triggers one more save afterwards, so nothing typed during a slow request is lost.
 */
async function saveNote(options: { force?: boolean; keepalive?: boolean } = {}): Promise<void> {
  clearSaveTimer()
  if (inFlight) {
    await inFlight
    if (isDirty.value) return saveNote(options)
    return
  }
  if (!isDirty.value || !noteId.value) return

  const id = noteId.value
  const sent = snapshot.value
  saveStatus.value = 'saving'

  let succeeded = false
  inFlight = (async () => {
    try {
      const saved = await notesStore.updateNote(
        id,
        { title: title.value, content: content.value, tags: tags.value, pinned: pinned.value },
        { baseUpdatedAt, force: options.force, keepalive: options.keepalive }
      )
      if (!saved) throw new Error('save failed')
      baseUpdatedAt = saved.updatedAt
      savedSnapshot.value = sent
      lastSavedAt.value = new Date(saved.updatedAt)
      saveStatus.value = 'saved'
      succeeded = true
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        saveStatus.value = 'idle'
        void resolveConflict(err.data as Note)
      } else {
        saveStatus.value = 'error'
        scheduleSave(RETRY_DELAY_MS)
      }
    }
  })()

  try {
    await inFlight
  } finally {
    inFlight = null
  }
  // Typed more while saving → persist that too (debounced like a normal edit)
  if (succeeded && isDirty.value) scheduleSave()
}

/** The note changed on another device/tab since we loaded it */
async function resolveConflict(serverNote: Note) {
  if (conflictOpen) return
  conflictOpen = true
  const keepMine = await ui.requestConfirm({
    title: t('notes.conflictTitle'),
    message: t('notes.conflictMessage'),
    confirmText: t('notes.conflictKeepMine'),
    cancelText: t('notes.conflictLoadTheirs')
  })
  conflictOpen = false
  if (keepMine) {
    await saveNote({ force: true })
    return
  }
  // Load the latest version, but keep the unsaved local edits as a separate note so nothing is lost
  // (this branch also runs when the dialog is dismissed)
  const copy = await notesStore.createNote({
    title: `${title.value || t('notes.untitled')} ${t('notes.conflictCopySuffix')}`,
    content: content.value,
    tags: tags.value,
    pinned: false
  })
  applyNote(serverNote)
  ui.showToast('info', copy ? t('notes.conflictLoadedWithCopy') : t('notes.conflictLoaded'))
}

/** Saves pending edits now (route change, tab hidden). Resolves once the latest edits are stored. */
async function flush(keepalive = false) {
  if (deleted) return
  if (isDirty.value || inFlight) await saveNote({ keepalive })
}

/** A note created with "New note" and left untouched is removed instead of cluttering the list */
async function discardIfEmpty(): Promise<boolean> {
  if (deleted) return true
  if (route.query.new !== '1' || loadingNote.value) return false
  const empty = !title.value.trim() && !htmlToPlainText(content.value) && !/<img[\s>]/i.test(content.value) && !tags.value.length
  if (!empty) return false
  clearSaveTimer()
  deleted = true
  await notesStore.deleteNote(noteId.value)
  return true
}

onMounted(() => loadNote(noteId.value))

onBeforeRouteUpdate(async (to, from) => {
  if (to.params.id === from.params.id) return
  if (!(await discardIfEmpty())) await flush()
  deleted = false
  await loadNote(to.params.id as string, to.query.new === '1')
})

onBeforeRouteLeave(async () => {
  if (!(await discardIfEmpty())) await flush()
})

onBeforeUnmount(clearSaveTimer)

// Tab hidden / app backgrounded (mobile) → save right away; keepalive lets it finish if the tab closes
useEventListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flush(true)
  else void refreshIfStale()
})

// Last resort: warn before closing the tab with unsaved edits
useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (isDirty.value || inFlight) {
    void flush(true)
    e.preventDefault()
  }
})

/** Coming back to the tab: pick up edits made elsewhere if we have nothing unsaved */
async function refreshIfStale() {
  if (loadingNote.value || isDirty.value || inFlight || !noteId.value) return
  const latest = await notesStore.fetchNote(noteId.value)
  if (latest && latest.updatedAt !== baseUpdatedAt && !isDirty.value) applyNote(latest)
}

// ── Save status label ──
const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 30_000)
onBeforeUnmount(() => clearInterval(clock))

const savedLabel = computed(() => {
  if (!lastSavedAt.value) return ''
  const minutes = Math.floor((now.value - lastSavedAt.value.getTime()) / 60_000)
  if (minutes < 1) return t('notes.savedJustNow')
  if (minutes < 60) return t('notes.savedMinutesAgo', { n: minutes })
  return t('notes.savedAt', {
    time: lastSavedAt.value.toLocaleString(locale.value === 'vi' ? 'vi-VN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short'
    })
  })
})

const metaLine = computed(() => {
  const parts = [t('notes.words', { n: stats.value.words })]
  if (stats.value.words > 0) parts.push(t('notes.readingTime', { n: readingMinutes(stats.value.words) }))
  if (createdAt.value) {
    parts.push(
      t('notes.createdOn', {
        date: new Date(createdAt.value).toLocaleDateString(locale.value === 'vi' ? 'vi-VN' : 'en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      })
    )
  }
  return parts.join(' · ')
})

// ── Keyboard ──
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    void saveNote()
  }
})

// ── Title ──
function autoResizeTitle() {
  const el = titleRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

watch(title, () => nextTick(autoResizeTitle))

function handleTitleKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLTextAreaElement
  const atEnd = el.selectionStart === el.value.length
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault()
    editorRef.value?.focus('start')
  } else if (e.key === 'ArrowDown' && atEnd) {
    e.preventDefault()
    editorRef.value?.focus('start')
  }
}

function handleTitleInput(e: Event) {
  // Titles are single-line: pasted line breaks become spaces
  const el = e.target as HTMLTextAreaElement
  if (/\r|\n/.test(el.value)) title.value = el.value.replace(/[\r\n]+/g, ' ')
}

// ── Tags ──
const newTag = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)
const tagSuggestions = computed(() =>
  notesStore.allTags.map((x) => x.tag).filter((tag) => !tags.value.includes(tag))
)

function addTag(raw = newTag.value) {
  const tag = raw.trim().replace(/^#/, '').toLowerCase()
  if (tag && !tags.value.includes(tag)) tags.value.push(tag)
  newTag.value = ''
}

function removeTag(tag: string) {
  tags.value = tags.value.filter((x) => x !== tag)
}

function handleTagKeydown(e: KeyboardEvent) {
  if ((e.key === 'Enter' || e.key === ',') && !e.isComposing) {
    e.preventDefault()
    addTag()
  } else if (e.key === 'Backspace' && !newTag.value && tags.value.length) {
    tags.value.pop()
  } else if (e.key === 'Escape') {
    newTag.value = ''
    tagInputRef.value?.blur()
  }
}

// ── Layout: full width (default) or a narrower focus column, remembered per device ──
const FULL_WIDTH_KEY = 'sn_note_full_width'
const fullWidth = ref(localStorage.getItem(FULL_WIDTH_KEY) !== '0')
function toggleWidth() {
  fullWidth.value = !fullWidth.value
  showMenu.value = false
  try {
    localStorage.setItem(FULL_WIDTH_KEY, fullWidth.value ? '1' : '0')
  } catch {
    // Storage unavailable — the choice just isn't remembered
  }
}

// ── Actions ──
const showMenu = ref(false)
const menuRef = ref<HTMLElement | null>(null)
useEventListener(document, 'click', (e: MouseEvent) => {
  if (showMenu.value && menuRef.value && !menuRef.value.contains(e.target as Node)) showMenu.value = false
})

async function handleDelete() {
  showMenu.value = false
  const confirmed = await ui.requestConfirm({
    title: t('notes.deleteTitle'),
    message: t('notes.deleteMessage'),
    danger: true,
    confirmText: t('notes.deleteConfirm')
  })
  if (!confirmed) return
  clearSaveTimer()
  if (await notesStore.deleteNote(noteId.value)) {
    deleted = true
    ui.showToast('success', t('notes.noteDeleted'))
    router.push('/notes')
  }
}

async function copyAsText() {
  showMenu.value = false
  const text = [title.value, htmlToPlainText(content.value.replace(/<\/(p|h[1-6]|li|pre|blockquote)>/gi, '\n'))]
    .filter(Boolean)
    .join('\n\n')
  try {
    await navigator.clipboard.writeText(text)
    ui.showToast('success', t('notes.copied'))
  } catch {
    ui.showToast('error', t('common.somethingWentWrong'))
  }
}

// ── AI ──
const showAiPanel = ref(false)

function handleAiInsert(text: string, isHtml = false) {
  // Parse markdown so code blocks and formatting from AI render correctly in Tiptap
  content.value += isHtml ? `\n${text}` : `\n${marked.parse(text) as string}`
  ui.showToast('success', t('notes.ai.insert'))
}

function handleAiReplace(text: string) {
  content.value = marked.parse(text) as string
  ui.showToast('success', t('notes.ai.insert'))
  showAiPanel.value = false
}

function handleApplyTags(aiTags: string[]) {
  const added = aiTags.filter((tag) => !tags.value.includes(tag))
  tags.value.push(...added)
  ui.showToast('success', t('common.tagsAdded', { n: added.length }))
}

// ── Sharing ──
const showShareModal = ref(false)
async function handleSaveShare(newIsPublic: boolean, newSharedWith: string[]) {
  isPublic.value = newIsPublic
  sharedWith.value = newSharedWith
  const success = await notesStore.updateNoteShare(noteId.value, newIsPublic, newSharedWith)
  ui.showToast(success ? 'success' : 'error', success ? t('notes.share.updateSuccess') : t('notes.share.updateError'))
  showShareModal.value = false
}

// ── Reminders from note content ──
const extractingEvents = ref(false)
const reminderSuggestions = ref<ReminderSuggestion[]>([])

async function handleExtractEvents() {
  showMenu.value = false
  const text = htmlToPlainText(content.value.replace(/<\/(p|div|li|h[1-6])>/gi, '\n'))
  if (!text || extractingEvents.value) return
  extractingEvents.value = true
  try {
    const suggestions = await reminderStore.detectFromText(text)
    if (suggestions.length > 0) reminderSuggestions.value = suggestions
    else ui.showToast('info', t('reminders.noEventsFound'))
  } catch {
    ui.showToast('error', t('common.somethingWentWrong'))
  } finally {
    extractingEvents.value = false
  }
}
</script>

<template>
  <div class="note-page mx-auto flex min-h-[calc(100vh-3.5rem-3rem)] w-full flex-col" :class="{ 'is-focus': !fullWidth }">
    <!-- Top bar -->
    <div class="note-topbar">
      <button id="back-to-notes-btn" class="icon-btn" :title="t('notes.backToNotes')" :aria-label="t('notes.backToNotes')" @click="router.push('/notes')">
        <ArrowLeft :size="18" />
      </button>

      <div class="save-status" role="status" aria-live="polite">
        <template v-if="saveStatus === 'saving'">
          <AppSpinner :size="13" />
          <span>{{ t('common.saving') }}</span>
        </template>
        <template v-else-if="saveStatus === 'error'">
          <CloudOff :size="14" class="text-error" />
          <span class="text-error">{{ t('notes.saveFailed') }}</span>
          <button class="save-retry" @click="saveNote()">{{ t('notes.retry') }}</button>
        </template>
        <template v-else-if="isDirty">
          <span class="dirty-dot" />
          <span>{{ t('common.unsavedChanges') }}</span>
        </template>
        <template v-else-if="lastSavedAt">
          <Check :size="14" class="text-success" />
          <span>{{ savedLabel }}</span>
        </template>
      </div>

      <div class="ml-auto flex items-center gap-1">
        <button id="share-note-btn" class="action-btn" :class="{ 'is-active': isPublic || sharedWith.length }" :title="t('notes.shareBtn')" @click="showShareModal = true">
          <Share2 :size="16" />
          <span class="hidden sm:inline">{{ t('notes.shareBtn') }}</span>
        </button>
        <button id="ai-panel-btn" class="action-btn" :class="{ 'is-active': showAiPanel }" :title="t('notes.ai.assistant')" @click="showAiPanel = !showAiPanel">
          <Sparkles :size="16" />
          <span class="hidden sm:inline">AI</span>
        </button>
        <button
          id="pin-note-btn"
          class="icon-btn"
          :class="{ 'is-pinned': pinned }"
          :title="pinned ? t('notes.unpin') : t('notes.pin')"
          :aria-label="pinned ? t('notes.unpin') : t('notes.pin')"
          :aria-pressed="pinned"
          @click="pinned = !pinned"
        >
          <Pin :size="16" :class="{ 'fill-current': pinned }" />
        </button>

        <div ref="menuRef" class="relative">
          <button class="icon-btn" :title="t('notes.moreActions')" :aria-label="t('notes.moreActions')" :aria-expanded="showMenu" @click="showMenu = !showMenu">
            <MoreHorizontal :size="18" />
          </button>
          <Transition name="menu">
            <div v-if="showMenu" class="note-menu" role="menu">
              <button id="extract-events-btn" role="menuitem" :disabled="extractingEvents" @click="handleExtractEvents">
                <AppSpinner v-if="extractingEvents" :size="15" />
                <Bell v-else :size="15" />
                {{ t('notes.scanEvents') }}
              </button>
              <button role="menuitem" @click="copyAsText">
                <Copy :size="15" />
                {{ t('notes.copyText') }}
              </button>
              <button role="menuitem" class="hidden lg:flex" @click="toggleWidth">
                <component :is="fullWidth ? Minimize2 : Maximize2" :size="15" />
                {{ fullWidth ? t('notes.focusWidth') : t('notes.fullWidth') }}
              </button>
              <div class="note-menu__divider" />
              <button id="delete-note-btn" role="menuitem" class="is-danger" @click="handleDelete">
                <Trash2 :size="15" />
                {{ t('notes.deleteTitle') }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <template v-if="loadingNote">
      <div class="skeleton mt-6 mb-4 h-[2.5rem] w-3/4"></div>
      <div class="skeleton mb-6 h-4 w-1/3"></div>
      <div class="skeleton mb-2 h-4 w-full"></div>
      <div class="skeleton mb-2 h-4 w-full"></div>
      <div class="skeleton mb-2 h-4 w-4/5"></div>
    </template>

    <template v-else>
      <!-- Title -->
      <textarea
        id="note-title-input"
        ref="titleRef"
        v-model="title"
        rows="1"
        :placeholder="t('notes.titlePlaceholder')"
        :aria-label="t('notes.titlePlaceholder')"
        class="note-title"
        @keydown="handleTitleKeydown"
        @input="handleTitleInput"
      />

      <!-- Meta + tags -->
      <div class="note-meta">
        <span class="note-meta__info">{{ metaLine }}</span>
        <div class="note-tags">
          <span v-for="tag in tags" :key="tag" class="note-tag">
            #{{ tag }}
            <button :aria-label="t('notes.removeTag', { tag })" @click="removeTag(tag)"><X :size="11" /></button>
          </span>
          <label class="note-tag-input">
            <Hash :size="12" />
            <input
              ref="tagInputRef"
              v-model="newTag"
              list="note-tag-suggestions"
              :placeholder="tags.length ? t('notes.addTagShort') : t('notes.addTag')"
              @keydown="handleTagKeydown"
              @change="addTag()"
              @blur="addTag()"
            />
            <datalist id="note-tag-suggestions">
              <option v-for="tag in tagSuggestions" :key="tag" :value="tag" />
            </datalist>
          </label>
        </div>
      </div>

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

      <RichEditor ref="editorRef" v-model="content" @stats="stats = $event" />
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

<style scoped>
.note-page {
  max-width: 100%;
  animation: notePageIn 0.2s ease both;
  transition: max-width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

/* Focus mode: a comfortable reading column (desktop only) */
@media (min-width: 1024px) {
  .note-page.is-focus {
    max-width: 50rem;
  }
}

@keyframes notePageIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.note-topbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.icon-btn,
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.icon-btn {
  width: 2.25rem;
}

.action-btn {
  padding: 0 0.75rem;
}

.icon-btn:hover,
.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.action-btn.is-active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.icon-btn.is-pinned {
  color: var(--warning);
}

.save-status {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  overflow: hidden;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* Narrow phones: the status text gives way to the action buttons */
.save-status > span:not(.dirty-dot) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.save-status > :deep(svg),
.save-status > .dirty-dot {
  flex-shrink: 0;
}

.dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warning);
}

.save-retry {
  margin-left: 0.25rem;
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── More menu ── */
.note-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 13rem;
  padding: 0.375rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
}

.note-menu button {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--text-secondary);
  text-align: left;
  white-space: nowrap;
}

.note-menu button:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.note-menu button.is-danger:hover {
  color: var(--error);
}

.note-menu__divider {
  height: 1px;
  margin: 0.25rem 0;
  background: var(--border-subtle);
}

.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Title ── */
.note-title {
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  resize: none;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.note-title::placeholder {
  color: var(--text-disabled);
}

.note-title:focus {
  outline: none;
}

@media (max-width: 640px) {
  .note-title {
    font-size: 1.625rem;
  }
}

@media (min-width: 1024px) {
  .note-title {
    font-size: 2.375rem;
  }
  .note-topbar {
    margin-bottom: 1.75rem;
  }
}

/* ── Meta & tags ── */
.note-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin: 0.625rem 0 1.25rem;
}

.note-meta__info {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.note-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.note-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.5rem;
  padding: 0 0.375rem 0 0.5rem;
  border-radius: var(--radius-full);
  background: var(--accent-subtle);
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 500;
}

.note-tag button {
  display: flex;
  border-radius: 50%;
  padding: 1px;
  opacity: 0.6;
}

.note-tag button:hover {
  opacity: 1;
  background: var(--accent-glow);
}

.note-tag-input {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.5rem;
  padding: 0 0.5rem;
  border-radius: var(--radius-full);
  border: 1px dashed var(--border-default);
  color: var(--text-tertiary);
  transition: border-color var(--transition-fast);
}

.note-tag-input:focus-within {
  border-style: solid;
  border-color: var(--accent);
  color: var(--accent);
}

.note-tag-input input {
  width: 6.5rem;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.75rem;
  outline: none;
}

.note-tag-input input::placeholder {
  color: var(--text-tertiary);
}

/* Hide the native datalist arrow in Chromium */
.note-tag-input input::-webkit-calendar-picker-indicator {
  display: none !important;
}
</style>
