<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notes'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import { useEventListener } from '@/composables/useEventListener'
import { Search, Plus, LayoutGrid, List, Pin, Clock, FileText, X, Hash, ArrowDownUp, Pencil, Trash2, Check } from 'lucide-vue-next'
import type { NoteSort } from '@/types'
import NoteCard from '@/components/notes/NoteCard.vue'
import MenuSelect from '@/components/ui/MenuSelect.vue'

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

const sortOptions = computed<{ value: NoteSort; label: string }[]>(() => [
  { value: 'updated', label: t('notes.sortUpdated') },
  { value: 'created', label: t('notes.sortCreated') },
  { value: 'title', label: t('notes.sortTitle') }
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

// ── Tag management: remove a tag (or all tags) from every note; notes are kept ──
const managingTags = ref(false)
const deletingTags = ref(false)

async function deleteTag(tag: string, count: number) {
  const confirmed = await ui.requestConfirm({
    title: t('notes.tags.deleteOneTitle', { tag }),
    message: t('notes.tags.deleteOneMessage', { tag, n: count }),
    danger: true,
    confirmText: t('notes.tags.deleteConfirm')
  })
  if (!confirmed) return
  deletingTags.value = true
  const ok = await notesStore.deleteTags([tag])
  deletingTags.value = false
  ui.showToast(ok ? 'success' : 'error', ok ? t('notes.tags.deletedOne', { tag }) : t('common.somethingWentWrong'))
  if (!notesStore.allTags.length) managingTags.value = false
}

async function deleteAllTags() {
  const confirmed = await ui.requestConfirm({
    title: t('notes.tags.deleteAllTitle'),
    message: t('notes.tags.deleteAllMessage', { n: notesStore.allTags.length }),
    danger: true,
    confirmText: t('notes.tags.deleteConfirm')
  })
  if (!confirmed) return
  deletingTags.value = true
  const ok = await notesStore.deleteTags('all')
  deletingTags.value = false
  ui.showToast(ok ? 'success' : 'error', ok ? t('notes.tags.deletedAll') : t('common.somethingWentWrong'))
  if (ok) managingTags.value = false
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
  } else if (e.key === 'Escape' && managingTags.value && !ui.confirmState.isOpen) {
    managingTags.value = false
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
  <div class="notes-page w-full">
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
    <div class="notes-toolbar mb-4">
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

      <!-- No overflow clipping here: the sort dropdown pops out of this row -->
      <div class="flex flex-wrap items-center gap-2">
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

        <MenuSelect
          v-model="notesStore.sortBy"
          :options="sortOptions"
          :label="t('notes.sortBy')"
          :icon="ArrowDownUp"
          align="right"
          class="sort-menu"
        />

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

    <!-- Tag filter / tag management -->
    <div v-if="notesStore.allTags.length" class="tag-row mb-5" :class="{ 'is-managing': managingTags }">
      <div class="tag-bar">
        <template v-if="managingTags">
          <span v-for="{ tag, count } in notesStore.allTags" :key="tag" class="tag-chip tag-chip--manage">
            <Hash :size="12" />
            {{ tag }}
            <span class="tag-chip__count">{{ count }}</span>
            <button
              class="tag-chip__remove"
              :title="t('notes.tags.deleteOne', { tag })"
              :aria-label="t('notes.tags.deleteOne', { tag })"
              :disabled="deletingTags"
              @click="deleteTag(tag, count)"
            >
              <X :size="12" />
            </button>
          </span>
        </template>
        <template v-else>
          <button
            v-for="{ tag, count } in notesStore.allTags"
            :key="tag"
            class="tag-chip"
            :class="{ 'is-active': notesStore.activeTag === tag }"
            :aria-pressed="notesStore.activeTag === tag"
            :title="notesStore.activeTag === tag ? t('notes.tags.clearFilter') : t('notes.tags.filterBy', { tag })"
            @click="toggleTag(tag)"
          >
            <Hash :size="12" />
            {{ tag }}
            <span class="tag-chip__count">{{ count }}</span>
            <X v-if="notesStore.activeTag === tag" :size="12" class="tag-chip__clear" />
          </button>
        </template>
      </div>

      <div class="tag-actions">
        <template v-if="managingTags">
          <button class="tag-action tag-action--danger" :disabled="deletingTags" @click="deleteAllTags">
            <Trash2 :size="13" />
            {{ t('notes.tags.deleteAll') }}
          </button>
          <button class="tag-action tag-action--primary" @click="managingTags = false">
            <Check :size="13" />
            {{ t('notes.tags.done') }}
          </button>
        </template>
        <button v-else class="tag-action" :title="t('notes.tags.manage')" @click="managingTags = true">
          <Pencil :size="13" />
          <span class="tag-action__label">{{ t('notes.tags.manage') }}</span>
        </button>
      </div>
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
/*
 * Layout responds to the width the page actually gets (the sidebar takes ~260px on tablets),
 * not the viewport: it is a size container and the rules below use container queries.
 */
.notes-page {
  container: notes / inline-size;
  animation: notesFadeIn 0.25s ease both;
}

.notes-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.search-box {
  min-width: 0;
}

@container notes (min-width: 52rem) {
  .notes-toolbar {
    flex-direction: row;
    align-items: center;
  }
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

/* Phones: tighter filters and an icon-only sort button so the row fits on one line */
@container notes (max-width: 30rem) {
  .segmented__item {
    padding: 0 0.625rem;
  }
  .segmented__item:not(.segmented__item--icon) :deep(svg) {
    display: none;
  }
  .sort-menu :deep(.menu-select__value),
  .sort-menu :deep(.menu-select__chevron) {
    display: none;
  }
  .sort-menu :deep(.menu-select__button) {
    padding: 0 0.6875rem;
  }
}

/* ── Tags ── */
.tag-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.tag-bar {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 0.375rem;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 2px 0;
  /* Fade the trailing edge so a horizontally scrollable row reads as "more →" */
  mask-image: linear-gradient(to right, #000 calc(100% - 2.5rem), transparent);
}

/* Managing: show every tag at once (wrapped) so each one can be removed */
.tag-row.is-managing .tag-bar {
  flex-wrap: wrap;
  overflow: visible;
  mask-image: none;
}

.tag-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.375rem;
  padding: 2px 0;
}

.tag-action {
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  height: 1.75rem;
  padding: 0 0.625rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.75rem;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.tag-action:hover:not(:disabled) {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.tag-action:focus-visible,
.tag-chip:focus-visible,
.tag-chip__remove:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.tag-action--danger {
  color: var(--error);
}

.tag-action--danger:hover:not(:disabled) {
  border-color: var(--error);
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.tag-action--primary {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent);
}

.tag-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@container notes (max-width: 30rem) {
  .tag-action__label {
    display: none;
  }
}

.tag-chip__clear {
  margin-left: 0.125rem;
  opacity: 0.8;
}

.tag-chip--manage {
  padding-right: 0.25rem;
  border-style: dashed;
}

.tag-chip__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  margin-left: 0.125rem;
  border-radius: 50%;
  border: 1px solid transparent;
  color: var(--text-tertiary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.tag-chip__remove:hover:not(:disabled) {
  background: color-mix(in srgb, var(--error) 15%, transparent);
  color: var(--error);
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
  /* min(100%, …) keeps a single column from overflowing on very narrow screens */
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
}

@container notes (min-width: 60rem) {
  .notes-grid {
    gap: 1rem;
  }
  .notes-grid--grid {
    grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
  }
}

.notes-grid--list {
  /* minmax(0, …): long titles/tags must not stretch the column past the page */
  grid-template-columns: minmax(0, 1fr);
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
