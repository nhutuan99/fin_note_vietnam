<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { httpClient } from '@/shared/api/httpClient'
import type { Note } from '@/types'
import RichEditor from '@/components/editor/RichEditor.vue'
import JsonViewer from '@/components/ui/JsonViewer.vue'
import LogoLoader from '@/components/ui/LogoLoader.vue'
import AppIntroCta from '@/components/ui/AppIntroCta.vue'
import SocialShare from '@/components/ui/SocialShare.vue'
import { Lock } from 'lucide-vue-next'
import { useAppSeo, extractExcerpt, extractFirstImage } from '@/composables/useAppSeo'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const noteId = route.params.id as string
const note = ref<Note | null>(null)
const loading = ref(true)
const error = ref('')
const parsedJsonBlocks = ref<{ prefix: string; data: any }[]>([])

/** Attempt to extract JSON blocks from note content */
function extractJsonBlocks(html: string): { prefix: string; data: any }[] | null {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n</p>')
  const text = tempDiv.textContent || ''
  const trimmed = text.trim()
  if (!trimmed) return null

  // Case 1: Entire content is one JSON object/array
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === 'object' && parsed !== null) {
      return [{ prefix: '', data: parsed }]
    }
  } catch { /* continue */ }

  // Case 2: Line-by-line JSON (SSE / NDJSON)
  const lines = trimmed.split('\n').filter(l => l.trim())
  const blocks: { prefix: string; data: any }[] = []
  let jsonCount = 0

  for (const line of lines) {
    let cleanLine = line.trim()
    let prefix = ''
    if (cleanLine.startsWith('data: ')) {
      prefix = 'data: '
      cleanLine = cleanLine.substring(6).trim()
    }
    if (
      (cleanLine.startsWith('{') && cleanLine.endsWith('}')) ||
      (cleanLine.startsWith('[') && cleanLine.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(cleanLine)
        blocks.push({ prefix, data: parsed })
        jsonCount++
        continue
      } catch { /* not valid JSON */ }
    }
    // Non-JSON line → skip for block extraction
  }

  if (jsonCount > 0 && jsonCount >= lines.length * 0.3) return blocks
  return null
}

onMounted(async () => {
  try {
    const data = await httpClient.get<Note>(`/api/notes/shared/${noteId}`)
    if (data) {
      // Try to detect JSON blocks for the interactive viewer
      const blocks = extractJsonBlocks(data.content)
      if (blocks) {
        parsedJsonBlocks.value = blocks
      }
      note.value = data
      
      useAppSeo({
        title: data.title || 'Untitled Note',
        description: extractExcerpt(data.content, 'Shared Note on FinNote'),
        url: `${window.location.origin}/notes/shared/${noteId}`,
        imageUrl: extractFirstImage(data.content),
        author: 'FinNote User',
        publishedAt: data.createdAt,
        updatedAt: data.updatedAt,
        tags: data.tags || [],
        type: 'article',
        keywords: 'smart note,finnote,ghi chú'
      })
    } else {
      error.value = t('sharedNote.notFound')
    }
  } catch (err: any) {
    if (err.message?.includes('401')) {
      error.value = t('sharedNote.loginRequired')
    } else if (err.message?.includes('403')) {
      error.value = t('sharedNote.noAccess')
    } else {
      error.value = t('sharedNote.notFound')
    }
  } finally {
    loading.value = false
  }
})

function goToDashboard() {
  router.push('/')
}

const shareUrl = computed(() => `${typeof window !== 'undefined' ? window.location.origin : ''}/notes/shared/${noteId}`)
const hasJsonBlocks = computed(() => parsedJsonBlocks.value.length > 0)
</script>

<template>
  <div class="flex h-full flex-col max-w-6xl mx-auto w-full pb-16 px-2 sm:px-4 pt-4 sm:pt-6">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex min-w-0 items-center gap-3">
        <h1 v-if="!loading && note" class="text-text-primary truncate text-xl font-bold">
          {{ note.title || 'Untitled Note' }}
        </h1>
        <span v-if="note?.isPublic" class="bg-accent-subtle text-accent shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold">{{ t('notes.share.public') }}</span>
        <span v-else-if="note" class="bg-bg-elevated border-border-default text-text-secondary shrink-0 flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold">
          <Lock :size="12" /> {{ t('notes.share.private') }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <LogoLoader :size="40" />
    </div>

    <div v-else-if="error" class="flex flex-1 flex-col items-center justify-center text-center">
      <Lock :size="48" class="text-text-tertiary mb-4" />
      <h2 class="text-text-primary mb-2 text-xl font-bold">{{ t('sharedNote.cannotAccess') }}</h2>
      <p class="text-text-secondary mb-6 text-sm">{{ error }}</p>
      <button class="btn-primary" @click="goToDashboard">{{ t('sharedNote.goHome') }}</button>
    </div>

    <div v-else-if="note" class="bg-bg-surface border-border-default flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
      <div class="border-border-default flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
        <div class="flex flex-1 flex-wrap items-center gap-2">
          <span
            v-for="tag in note.tags"
            :key="tag"
            class="bg-accent-subtle text-accent rounded-md px-2.5 py-1 text-xs font-medium"
          >
            {{ tag }}
          </span>
          <span v-if="note.tags.length === 0" class="text-text-tertiary text-xs italic">{{ t('sharedNote.noTags') }}</span>
          
          <span class="text-text-tertiary text-xs ml-2 hidden sm:inline-block">
            {{ t('sharedNote.updated') }}: {{ new Date(note.updatedAt).toLocaleString() }}
          </span>
        </div>
        
        <SocialShare 
          :url="shareUrl"
          :title="note.title || 'Untitled Note'"
          :description="note.content.substring(0, 100).replace(/<[^>]+>/g, '')"
          :shareLabel="t('sharedNote.shareLabel')"
        />
      </div>

      <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div class="mx-auto w-full">
          <!-- JSON Interactive Viewer -->
          <template v-if="hasJsonBlocks">
            <div v-for="(block, idx) in parsedJsonBlocks" :key="idx" class="mb-4">
              <div v-if="block.prefix" class="text-text-tertiary text-xs font-mono mb-1 px-1">{{ block.prefix }}</div>
              <JsonViewer :data="block.data" />
            </div>
          </template>

          <!-- Fallback: Rich Editor for non-JSON notes -->
          <RichEditor v-else v-model="note.content" :readonly="true" />
        </div>
      </div>
    </div>

    <AppIntroCta />
  </div>
</template>

<style scoped>
/* Force readonly editor styles if needed */
:deep(.is-readonly .ProseMirror) {
  outline: none;
  min-height: auto;
}
</style>

