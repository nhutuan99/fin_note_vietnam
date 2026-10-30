<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import { useEventListener } from '@/composables/useEventListener'
import { Search, Plus, LayoutGrid, List, Pin, Clock, FileText, X, Hash, ArrowDownUp } from 'lucide-vue-next'
import type { NoteSort } from '@/types'
import NoteCard from '@/components/notes/NoteCard.vue'

const { t } = useI18n()
const router = useRouter()
const notesStore = useNotesStore()
const ui = useUiStore()

const searchInput = ref<HTMLInputElement | null>(null)
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

onMounted(() => notesStore.fetchNotes())

const filters = computed(() => [
  { key: 'all' as const, label: t('notes.filterAll'), icon: null },
  { key: 'pinned' as const, label: t('notes.filterPinned'), icon: Pin },
  { key: 'recent' as const, label: t('notes.filterRecent'), icon: Clock }
])

const sortOptions = computed<{ key: NoteSort; label: string }[]>(() => [
  { key: 'updated', label: t('notes.sortUpdated') },
  { key: 'created', label: t('notes.sortCreated') },
  { key: 'title', label: t('notes.sortTitle') }
])

const isFiltering = computed(
  () => !!notesStore.searchQuery.trim() || !!notesStore.activeTag || notesStore.filter !== 'all'
)

/** Split into "Pinned" / "Others" sections only when browsing everything and both have notes */
const sections = computed(() => {
  if (notesStore.filter === 'all' && notesStore.pinnedNotes.length && notesStore.otherNotes.length) {
    return [
      { key: 'pinned', label: t('notes.sectionPinned'), notes: notesStore.pinnedNotes },
      { key: 'others', label: t('notes.sectionOthers'), notes: notesStore.otherNotes }
    ]
  }
  return [{ key: 'all', label: '', notes: notesStore.filteredNotes }]
})

const isCreating = ref(false)

async function createNote() {
  if (isCreating.value) return
  isCreating.value = true
  try {
    const note = await notesStore.createNote({ title: '', content: '', tags: [], pinned: false })
    if (note) router.push({ path: `/notes/${note.id}`, query: { new: '1' } })
    else ui.showToast('error', t('common.somethingWentWrong'))
  } finally {
    isCreating.value = false
  }
}

async function handleDelete(id: string) {
  const confirmed = await ui.requestConfirm({
    title: t('notes.deleteTitle'),
    message: t('notes.deleteMessage'),
    danger: true,
    confirmText: t('notes.deleteConfirm')
  })
  if (confirmed && (await notesStore.deleteNote(id))) {
    ui.showToast('success', t('notes.noteDeleted'))
  }
}

function toggleTag(tag: string) {
  notesStore.activeTag = notesStore.activeTag === tag ? null : tag
}

function clearFilters() {
  notesStore.searchQuery = ''
  notesStore.activeTag = null
  notesStore.filter = 'all'
}

function isTypingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null
  return !!node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable)
}

// Ctrl/⌘+K or "/" focuses search, Esc clears it
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchInput.value?.focus()
    searchInput.value?.select()
  } else if (e.key === '/' && !isTypingTarget(e.target)) {
    e.preventDefault()
    searchInput.value?.focus()
  }
})

function handleSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (notesStore.searchQuery) notesStore.searchQuery = ''
    else searchInput.value?.blur()
  }
}
</script>

<template>
  <div class="notes-page mx-auto max-w-[85rem]">
    <!-- Header -->
    <header class="mb-5 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('notes.title') }}</h1>
        <p class="text-text-tertiary mt-0.5 text-sm">
          <template v-if="isFiltering">{{ t('notes.countFiltered', { n: notesStore.filteredNotes.length, total: notesStore.totalNotes }) }}</template>
          <template v-else>{{ t('notes.count', { n: notesStore.totalNotes }) }}</template>
        </p>
      </div>
      <button id="notes-new-btn" class="btn-primary shrink-0" :disabled="isCreating" @click="createNote">
        <AppSpinner v-if="isCreating" :size="16" />
        <Plus v-else :size="16" />
        {{ t('notes.newNote') }}
      </button>
    </header>

    <!-- Toolbar -->
    <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
      <div class="search-box relative flex-1">
        <Search :size="16" class="text-text-tertiary pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
        <input
          id="notes-search-input"
          ref="searchInput"
          v-model="notesStore.searchQuery"
          type="search"
          autocomplete="off"
          :placeholder="t('notes.searchPlaceholder')"
          :aria-label="t('notes.searchPlaceholder')"
          class="search-input"
          @keydown="handleSearchKeydown"
        />
        <button
          v-if="notesStore.searchQuery"
          class="search-clear"
          :aria-label="t('notes.clearSearch')"
          @click="notesStore.searchQuery = ''; searchInput?.focus()"
        >
          <X :size="14" />
        </button>
        <kbd v-else class="search-kbd">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto">
        <div class="segmented" role="tablist">
          <button
            v-for="f in filters"
            :key="f.key"
            role="tab"
            :aria-selected="notesStore.filter === f.key"
            class="segmented__item"
            :class="{ 'is-active': notesStore.filter === f.key }"
            @click="notesStore.filter = f.key"
          >
            <component :is="f.icon" v-if="f.icon" :size="13" />
            {{ f.label }}
          </button>
        </div>

        <label class="sort-select" :title="t('notes.sortBy')">
          <ArrowDownUp :size="14" class="text-text-tertiary" />
          <select v-model="notesStore.sortBy" :aria-label="t('notes.sortBy')">
            <option v-for="opt in sortOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
          </select>
        </label>

        <div class="segmented">
          <button
            id="view-grid-btn"
            class="segmented__item segmented__item--icon"
            :class="{ 'is-active': notesStore.viewMode === 'grid' }"
            :aria-label="t('notes.viewGrid')"
            :title="t('notes.viewGrid')"
            @click="notesStore.viewMode = 'grid'"
          >
            <LayoutGrid :size="15" />
          </button>
          <button
            id="view-list-btn"
            class="segmented__item segmented__item--icon"
            :class="{ 'is-active': notesStore.viewMode === 'list' }"
            :aria-label="t('notes.viewList')"
            :title="t('notes.viewList')"
            @click="notesStore.viewMode = 'list'"
          >
            <List :size="15" />
          </button>
        </div>
      </div>
    </div>

    <!-- Tag filter -->
    <div v-if="notesStore.allTags.length" class="tag-bar mb-5">
      <button
        v-for="{ tag, count } in notesStore.allTags"
        :key="tag"
        class="tag-chip"
        :class="{ 'is-active': notesStore.activeTag === tag }"
        :aria-pressed="notesStore.activeTag === tag"
        @click="toggleTag(tag)"
      >
        <Hash :size="12" />
        {{ tag }}
        <span class="tag-chip__count">{{ count }}</span>
      </button>
    </div>

    <!-- Loading (first load only — refreshes keep the current list on screen) -->
    <div
      v-if="notesStore.loading && !notesStore.notes.length"
      class="notes-grid"
      :class="`notes-grid--${notesStore.viewMode}`"
    >
      <div v-for="i in 6" :key="i" class="bg-bg-surface border-border-default rounded-xl border p-5">
        <div class="skeleton mb-3 h-5 w-3/5"></div>
        <div class="skeleton mb-2 h-3.5 w-full"></div>
        <div class="skeleton h-3.5 w-4/5"></div>
      </div>
    </div>

    <!-- Notes -->
    <template v-else-if="notesStore.filteredNotes.length">
      <section v-for="section in sections" :key="section.key" class="mb-6">
        <h2 v-if="section.label" class="section-label">{{ section.label }}</h2>
        <TransitionGroup tag="div" name="note-list" class="notes-grid" :class="`notes-grid--${notesStore.viewMode}`">
          <NoteCard
            v-for="note in section.notes"
            :id="`note-item-${note.id}`"
            :key="note.id"
            :note="note"
            :view="notesStore.viewMode"
            :query="notesStore.searchQuery"
            @pin="notesStore.togglePin"
            @delete="handleDelete"
            @tag="toggleTag"
          />
        </TransitionGroup>
      </section>
    </template>

    <!-- Empty -->
    <div v-else class="empty-state flex flex-col items-center py-16 text-center">
      <div class="empty-icon-wrap mb-5">
        <component :is="isFiltering ? Search : FileText" :size="32" class="text-accent" />
      </div>
      <h3 class="mb-1.5 text-lg font-semibold">
        {{ isFiltering ? t('notes.noResults') : t('notes.noNotes') }}
      </h3>
      <p class="text-text-tertiary mb-6 max-w-sm text-sm">
        {{ isFiltering ? t('notes.tryDifferent') : t('notes.createFirst') }}
      </p>
      <button v-if="isFiltering" class="btn-secondary" @click="clearFilters">
        <X :size="16" />
        {{ t('notes.clearFilters') }}
      </button>
      <button v-else class="btn-primary" :disabled="isCreating" @click="createNote">
        <Plus :size="16" />
        {{ t('notes.createNote') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.notes-page {
  animation: notesFadeIn 0.25s ease both;
}

@keyframes notesFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}

/* ── Search ── */
.search-input {
  width: 100%;
  height: 2.5rem;
  padding: 0 4.5rem 0 2.375rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.search-input::placeholder {
  color: var(--text-disabled);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

/* Native clear button is replaced by our own */
.search-input::-webkit-search-cancel-button {
  display: none;
}

.search-clear {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
}

.search-clear:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.search-kbd {
  position: absolute;
  top: 50%;
  right: 0.625rem;
  transform: translateY(-50%);
  padding: 0.0625rem 0.375rem;
  border-radius: 4px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  font-family: inherit;
  font-size: 0.6875rem;
  pointer-events: none;
}

@media (hover: none) {
  .search-kbd {
    display: none;
  }
}

/* ── Segmented controls ── */
.segmented {
  display: flex;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.segmented__item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  height: 2.375rem;
  padding: 0 0.875rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  white-space: nowrap;
  border-right: 1px solid var(--border-default);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.segmented__item:last-child {
  border-right: none;
}

.segmented__item:hover {
  background: var(--bg-hover);
}

.segmented__item.is-active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.segmented__item--icon {
  padding: 0 0.625rem;
  color: var(--text-tertiary);
}

.sort-select {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  height: 2.5rem;
  padding: 0 0.625rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  cursor: pointer;
}

.sort-select select {
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  border: none;
  outline: none;
  cursor: pointer;
}

.sort-select select option {
  background: var(--bg-surface);
  color: var(--text-primary);
}

.sort-select:focus-within {
  border-color: var(--accent);
}

/* ── Tags ── */
.tag-bar {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.tag-bar::-webkit-scrollbar {
  display: none;
}

.tag-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  height: 1.75rem;
  padding: 0 0.625rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.75rem;
  transition: all var(--transition-fast);
}

.tag-chip:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.tag-chip.is-active {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent);
}

.tag-chip__count {
  color: var(--text-tertiary);
  font-size: 0.6875rem;
}

/* ── Grid ── */
.section-label {
  margin-bottom: 0.625rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.notes-grid {
  position: relative;
  display: grid;
  gap: 0.75rem;
}

.notes-grid--grid {
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
}

.notes-grid--list {
  grid-template-columns: 1fr;
  gap: 0.5rem;
}

/* Smoothly reflow cards when pinning, filtering or deleting */
.note-list-move,
.note-list-enter-active,
.note-list-leave-active {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
}

.note-list-enter-from,
.note-list-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

.note-list-leave-active {
  position: absolute;
  visibility: hidden;
}

/* ── Empty state ── */
.empty-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  background: var(--accent-subtle);
  border: 1px solid var(--border-default);
}

@media (prefers-reduced-motion: reduce) {
  .notes-page,
  .note-list-move,
  .note-list-enter-active,
  .note-list-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
