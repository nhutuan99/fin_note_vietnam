<script setup lang="ts">
// 1. Vue core
import { computed, onMounted } from 'vue'
// 2. Vue ecosystem
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
// 3. Stores
import { useNotesStore } from '@/stores/notes'
// 4. Icons
import { FileText, ChevronRight, Pin, NotebookPen } from 'lucide-vue-next'

const router = useRouter()
const notesStore = useNotesStore()
const { t, locale } = useI18n()

onMounted(() => {
  if (!notesStore.notes.length) {
    notesStore.fetchNotes()
  }
})

/** Top 3 notes: pinned first, then most recently updated */
const recentNotes = computed(() =>
  [...notesStore.notes]
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    .slice(0, 3)
)

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return t('time.mAgo', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('time.hAgo', { n: h })
  const d = Math.floor(h / 24)
  if (d < 30) return t('time.dAgo', { n: d })
  return new Date(dateStr).toLocaleDateString(locale.value === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit' })
}

/** Strip HTML tags + truncate for safe excerpt display */
function safeExcerpt(html: string, maxLen = 60): string {
  if (!html) return ''
  
  let text = html.replace(/<br\s*\/?>/gi, ' ')
  text = text.replace(/<\/?(p|div|h[1-6]|li|ul|ol|table|tr|th|td|blockquote)[^>]*>/gi, ' ')
  
  const doc = new DOMParser().parseFromString(text, 'text/html')
  text = doc.body.textContent || ''
  
  text = text.replace(/(?:^|\s)#{1,6}\s+(.*)/g, ' $1 ') 
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2') 
  text = text.replace(/(\*|_)(.*?)\1/g, '$2') 
  text = text.replace(/!\[(.*?)\]\(.*?\)/g, '$1') 
  text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1') 
  text = text.replace(/`(.*?)`/g, '$1') 
  text = text.replace(/```[\s\S]*?```/g, ' ') 
  
  text = text.replace(/[\n\r]+/g, ' ')
  text = text.replace(/\s{2,}/g, ' ')
  text = text.trim()

  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}
</script>

<template>
  <!-- Widget shell -->
  <div class="bg-bg-surface border-border-default rounded-2xl border p-4 flex flex-col gap-3" style="min-height: 9.5rem;">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
          <FileText :size="15" />
        </div>
        <h3 class="text-sm font-semibold text-text-primary">{{ t('nav.recentNotes') }}</h3>
        <span
          v-if="notesStore.totalNotes > 0"
          class="inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 py-0.5 min-w-[1.1rem] bg-violet-500/15 text-violet-400"
        >
          {{ notesStore.totalNotes }}
        </span>
      </div>
      <button class="flex items-center gap-0.5 text-accent text-xs font-medium hover:opacity-80 transition-opacity" @click="router.push('/notes')">
        {{ t('dashboard.viewAll') }}
        <ChevronRight :size="14" />
      </button>
    </div>

    <!-- Skeleton -->
    <div v-if="notesStore.loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="skeleton h-14 rounded-xl" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!recentNotes.length" class="flex flex-1 flex-col items-center justify-center gap-1 py-4">
      <NotebookPen :size="28" class="text-text-disabled mb-2" />
      <p class="text-text-disabled text-sm">{{ t('notes.noNotes') }}</p>
      <button class="mt-1 text-xs text-accent hover:opacity-80 transition-opacity font-medium" @click="router.push('/notes')">
        + {{ t('notes.newNote') }}
      </button>
    </div>

    <!-- Note list -->
    <div v-else class="space-y-2.5">
      <div
        v-for="note in recentNotes"
        :key="note.id"
        class="relative flex items-start gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-colors bg-bg-elevated hover:bg-bg-hover"
        @click="router.push(`/notes/${note.id}`)"
      >
        <!-- Pin indicator -->
        <span v-if="note.pinned" class="shrink-0 text-warning mt-[3px]">
          <Pin :size="10" class="fill-current" />
        </span>

        <!-- Content -->
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-text-primary truncate leading-tight">{{ note.title || t('notes.untitled') }}</p>
          <p v-if="safeExcerpt(note.excerpt)" class="text-[11px] text-text-disabled leading-tight mt-0.5 line-clamp-1">
            {{ safeExcerpt(note.excerpt) }}
          </p>
        </div>

        <!-- Time -->
        <span class="shrink-0 text-[11px] text-text-disabled whitespace-nowrap mt-0.5">{{ timeAgo(note.updatedAt) }}</span>
      </div>
    </div>

  </div>
</template>
