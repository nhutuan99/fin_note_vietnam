<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pin, Trash2, ImageIcon } from 'lucide-vue-next'
import type { NoteListItem, ViewMode } from '@/types'
import { normalizeForSearch } from '@/shared/utils/noteText'
import HighlightText from './HighlightText.vue'

const props = defineProps<{
  note: NoteListItem
  view: ViewMode
  query?: string
}>()

const emit = defineEmits<{
  pin: [id: string]
  delete: [id: string]
  tag: [tag: string]
}>()

const { t, locale } = useI18n()

const SNIPPET_LENGTH = 160

/** When searching, preview the part of the body around the first hit instead of its beginning. */
const preview = computed(() => {
  const body = props.note.text || props.note.excerpt || ''
  const terms = normalizeForSearch(props.query?.trim() || '').split(/\s+/).filter(Boolean)
  if (!terms.length) return props.note.excerpt || body.substring(0, SNIPPET_LENGTH)

  // Diacritic stripping keeps precomposed text the same length, so indexes line up with `body`
  const hit = Math.min(...terms.map((term) => normalizeForSearch(body).indexOf(term)).filter((i) => i >= 0))
  if (!Number.isFinite(hit) || hit < SNIPPET_LENGTH / 2) return body.substring(0, SNIPPET_LENGTH)
  const start = body.lastIndexOf(' ', hit - 40) + 1
  return '…' + body.substring(start, start + SNIPPET_LENGTH)
})

const updatedLabel = computed(() => {
  const date = new Date(props.note.updatedAt)
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('time.daysAgo', { n: days })
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(locale.value === 'vi' ? 'vi-VN' : 'en-US', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' })
  })
})

const visibleTags = computed(() => props.note.tags.slice(0, 3))
const hiddenTagCount = computed(() => Math.max(0, props.note.tags.length - 3))
</script>

<template>
  <router-link
    :to="`/notes/${note.id}`"
    class="note-card group"
    :class="[`note-card--${view}`, { 'note-card--pinned': note.pinned }]"
  >
    <div class="note-card__main">
      <div class="note-card__head">
        <h3 class="note-card__title" :class="{ 'is-untitled': !note.title }">
          <HighlightText v-if="note.title" :text="note.title" :query="query" />
          <template v-else>{{ t('notes.untitled') }}</template>
        </h3>
        <Pin v-if="note.pinned" :size="14" class="note-card__pin-badge" :aria-label="t('notes.filterPinned')" />
      </div>

      <p class="note-card__preview" :class="{ 'is-empty': !preview }">
        <HighlightText v-if="preview" :text="preview" :query="query" />
        <template v-else>{{ note.hasImages ? t('notes.imageOnly') : t('notes.noContent') }}</template>
      </p>
    </div>

    <div class="note-card__meta">
      <div class="note-card__tags">
        <button
          v-for="tag in visibleTags"
          :key="tag"
          class="note-card__tag"
          @click.prevent.stop="emit('tag', tag)"
        >
          #{{ tag }}
        </button>
        <span v-if="hiddenTagCount" class="note-card__tag-more">+{{ hiddenTagCount }}</span>
      </div>
      <div class="note-card__info">
        <ImageIcon v-if="note.hasImages" :size="12" :aria-label="t('notes.hasImages')" />
        <time :datetime="note.updatedAt" :title="new Date(note.updatedAt).toLocaleString()">{{ updatedLabel }}</time>
      </div>
    </div>

    <!-- Floating actions: shown on hover/focus, always on touch screens -->
    <div class="note-card__actions" @click.prevent.stop>
      <button
        class="note-card__action"
        :class="{ 'is-pinned': note.pinned }"
        :title="note.pinned ? t('notes.unpin') : t('notes.pin')"
        :aria-label="note.pinned ? t('notes.unpin') : t('notes.pin')"
        @click="emit('pin', note.id)"
      >
        <Pin :size="15" :class="{ 'fill-current': note.pinned }" />
      </button>
      <button
        class="note-card__action note-card__action--danger"
        :title="t('common.delete')"
        :aria-label="t('common.delete')"
        @click="emit('delete', note.id)"
      >
        <Trash2 :size="15" />
      </button>
    </div>
  </router-link>
</template>

<style scoped>
.note-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  padding: 1rem 1.125rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: inherit;
  text-decoration: none;
  transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.note-card:hover {
  border-color: var(--border-strong);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-md);
}

.note-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.note-card:active {
  transform: scale(0.995);
}

.note-card--grid {
  min-height: 9.5rem;
}

/*
 * Breakpoints below query the notes page container (`container: notes` in NotesView) rather than
 * the viewport, so layouts follow the space left beside the sidebar.
 */

/* Roomier cards with a longer preview when the page is wide */
@container notes (min-width: 60rem) {
  .note-card--grid {
    min-height: 11rem;
    padding: 1.125rem 1.25rem;
  }
  .note-card--grid .note-card__title {
    font-size: 1rem;
  }
  .note-card--grid .note-card__preview {
    -webkit-line-clamp: 4;
    font-size: 0.84375rem;
  }
}

.note-card--list {
  min-height: 0;
  padding: 0.75rem 1rem;
}

@container notes (min-width: 44rem) {
  .note-card--list {
    flex-direction: row;
    align-items: center;
    gap: 1.5rem;
  }
  .note-card--list .note-card__main {
    display: flex;
    /* Must be explicit: the base rule sets column, which turned the 15rem title basis into a height */
    flex-direction: row;
    align-items: center;
    gap: 1rem;
    min-width: 0;
    flex: 1;
  }
  .note-card--list .note-card__head {
    flex: 0 0 clamp(10rem, 28%, 18rem);
    min-width: 0;
  }
  .note-card--list .note-card__preview {
    -webkit-line-clamp: 1;
    flex: 1;
    min-width: 0;
  }
  .note-card--list .note-card__meta {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 45%;
    gap: 1rem;
  }
  /* One line of tags; extras are clipped rather than pushing the row wider */
  .note-card--list .note-card__tags {
    flex-wrap: nowrap;
    overflow: hidden;
  }
  .note-card--list .note-card__tag {
    flex-shrink: 0;
  }
}

.note-card__main {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
}

.note-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.note-card__title {
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.note-card__title.is-untitled {
  color: var(--text-tertiary);
  font-style: italic;
  font-weight: 500;
}

.note-card__pin-badge {
  flex-shrink: 0;
  margin-top: 0.1875rem;
  color: var(--warning);
  fill: currentColor;
}

/* Floating action pill in the top-right corner; it doesn't take layout space */
.note-card__actions {
  position: absolute;
  top: 0.625rem;
  right: 0.625rem;
  display: flex;
  gap: 0.125rem;
  padding: 0.125rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-sm);
  opacity: 0;
  transform: translateY(-2px);
  pointer-events: none;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.note-card:hover .note-card__actions,
.note-card:focus-within .note-card__actions {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.note-card--list .note-card__actions {
  top: 50%;
  transform: translateY(-50%);
}

.note-card--list:hover .note-card__actions,
.note-card--list:focus-within .note-card__actions {
  transform: translateY(-50%);
}

.note-card__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.875rem;
  height: 1.875rem;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

/* Touch screens have no hover: actions sit inline in the corner, always visible */
@media (hover: none) {
  .note-card__actions {
    opacity: 1;
    transform: none;
    pointer-events: auto;
    border-color: transparent;
    background: transparent;
    box-shadow: none;
  }
  .note-card--list .note-card__actions {
    top: 0.375rem;
    transform: none;
  }
  .note-card__head {
    padding-right: 4rem;
  }
  .note-card__pin-badge {
    display: none;
  }
}

.note-card__action:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.note-card__action.is-pinned {
  color: var(--warning);
}

.note-card__action--danger:hover {
  color: var(--error);
}

.note-card__preview {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.note-card__preview.is-empty {
  color: var(--text-disabled);
  font-style: italic;
}

.note-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 1.375rem;
}

.note-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-width: 0;
}

.note-card__tag {
  padding: 0.0625rem 0.5rem;
  border-radius: var(--radius-full);
  background: var(--accent-subtle);
  color: var(--accent);
  font-size: 0.6875rem;
  font-weight: 500;
  transition: background var(--transition-fast);
}

.note-card__tag:hover {
  background: var(--accent-glow);
}

.note-card__tag-more {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  align-self: center;
}

.note-card__info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
