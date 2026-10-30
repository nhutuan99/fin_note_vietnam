<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAi } from '@/composables/useGemini'
import {
  Sparkles, X, Copy, Check, ChevronDown,
  AlignLeft, PenLine, Wand2, Tag, MessageSquare, ListChecks, Braces
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  title: string
  content: string
  visible: boolean
}>()

const { t } = useI18n()

const emit = defineEmits<{
  close: []
  insertText: [text: string, isHtml?: boolean]
  replaceText: [text: string]
  applyTags: [tags: string[]]
}>()

const ai = useAi()
const activeMode = ref<'summarize' | 'continue' | 'improve' | 'tags' | 'ask' | 'rewrite' | 'format_json' | null>(null)
const question = ref('')
const copied = ref(false)
const suggestedTags = ref<string[]>([])

// Strip HTML → plain text for AI context
function getPlainText() {
  const el = document.createElement('div')
  el.innerHTML = props.content
  return el.textContent || ''
}

const originalImages = ref<string[]>([])

function prepareContextForAi(mode: string) {
  let text = mode === 'rewrite' ? props.content : getPlainText()
  
  const imgRegex = /<img[^>]+src="([^">]+)"([^>]*)>/g
  let match
  const imagesBase64: string[] = []
  
  if (mode === 'rewrite') {
    text = text.replace(imgRegex, (fullMatch, src, rest) => {
      if (src.startsWith('data:image') || src.startsWith('http')) {
        const idx = imagesBase64.length
        imagesBase64.push(src)
        return `<img src="[IMAGE_${idx}]"${rest}>`
      }
      return fullMatch
    })
  } else {
    while ((match = imgRegex.exec(props.content)) !== null) {
      if (match[1].startsWith('data:image') || match[1].startsWith('http')) {
        imagesBase64.push(match[1])
      }
    }
  }

  originalImages.value = imagesBase64
  return { text, imagesBase64 }
}

function resetState() {
  suggestedTags.value = []
  ai.streamText.value = ''
  originalImages.value = []
}

async function runSummarize() {
  activeMode.value = 'summarize'
  resetState()
  const ctx = prepareContextForAi('summarize')
  await ai.summarize(ctx.text, ctx.imagesBase64)
}

async function runContinue() {
  activeMode.value = 'continue'
  resetState()
  const ctx = prepareContextForAi('continue')
  await ai.continueWriting(ctx.text, ctx.imagesBase64)
}

async function runImprove() {
  activeMode.value = 'improve'
  resetState()
  const ctx = prepareContextForAi('improve')
  await ai.improveWriting(ctx.text, ctx.imagesBase64)
}

async function runRewrite() {
  activeMode.value = 'rewrite'
  resetState()
  const ctx = prepareContextForAi('rewrite')
  await ai.rewriteNote(ctx.text, ctx.imagesBase64)
}

async function runFormatJson() {
  activeMode.value = 'format_json'
  resetState()
  const ctx = prepareContextForAi('format_json')
  await ai.formatJson(ctx.text, ctx.imagesBase64)
}

async function runSuggestTags() {
  activeMode.value = 'tags'
  resetState()
  const ctx = prepareContextForAi('tags')
  const result = await ai.suggestTags(props.title, ctx.text)
  if (result) suggestedTags.value = result
}

async function runAsk() {
  if (!question.value.trim()) return
  activeMode.value = 'ask'
  resetState()
  const ctx = prepareContextForAi('ask')
  await ai.askAbout(ctx.text, question.value, ctx.imagesBase64)
}

function insertResult() {
  if (ai.streamText.value) {
    let finalHtml = ai.streamText.value
    if (activeMode.value === 'rewrite') {
      originalImages.value.forEach((src, idx) => {
        finalHtml = finalHtml.replace(`[IMAGE_${idx}]`, src)
      })
    }
    emit('insertText', finalHtml, activeMode.value === 'rewrite')
  }
}

function replaceResult() {
  if (ai.streamText.value) {
    let finalHtml = ai.streamText.value
    if (activeMode.value === 'rewrite') {
      originalImages.value.forEach((src, idx) => {
        finalHtml = finalHtml.replace(`[IMAGE_${idx}]`, src)
      })
    }
    emit('replaceText', finalHtml)
  }
}

function applyTags() {
  if (suggestedTags.value.length) emit('applyTags', suggestedTags.value)
}

async function copyResult() {
  await navigator.clipboard.writeText(ai.streamText.value)
  copied.value = true
  setTimeout(() => copied.value = false, 1500)
}

const hasContent = computed(() => getPlainText().trim().length > 0 || props.content.includes('<img'))
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible" class="ai-panel">
      <!-- Header -->
      <div class="ai-panel-header">
        <div class="flex items-center gap-2">
          <div class="ai-icon-badge">
            <Sparkles :size="14" />
          </div>
          <span class="ai-panel-title">{{ t('notes.ai.assistant') }}</span>
          <span class="ai-model-badge">Workers AI</span>
        </div>
        <button class="ai-close-btn" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <!-- Actions -->
      <div class="ai-actions">
        <button class="ai-action-btn" :class="{ active: activeMode === 'summarize' }" @click="runSummarize" :disabled="ai.loading.value || !hasContent">
          <AlignLeft :size="14" />
          {{ t('notes.ai.summarize') }}
        </button>
        <button class="ai-action-btn" :class="{ active: activeMode === 'rewrite' }" @click="runRewrite" :disabled="ai.loading.value || !hasContent">
          <ListChecks :size="14" />
          Clean & Format
        </button>
        <button class="ai-action-btn" :class="{ active: activeMode === 'format_json' }" @click="runFormatJson" :disabled="ai.loading.value || !hasContent">
          <Braces :size="14" />
          Format JSON
        </button>
        <button class="ai-action-btn" :class="{ active: activeMode === 'continue' }" @click="runContinue" :disabled="ai.loading.value || !hasContent">
          <PenLine :size="14" />
          {{ t('notes.ai.continue') }}
        </button>
        <button class="ai-action-btn" :class="{ active: activeMode === 'improve' }" @click="runImprove" :disabled="ai.loading.value || !hasContent">
          <Wand2 :size="14" />
          {{ t('notes.ai.improve') }}
        </button>
        <button class="ai-action-btn" :class="{ active: activeMode === 'tags' }" @click="runSuggestTags" :disabled="ai.loading.value || !hasContent">
          <Tag :size="14" />
          {{ t('notes.ai.tags') }}
        </button>
      </div>

      <!-- Ask AI -->
      <div class="ai-ask-row">
        <input
          v-model="question"
          :placeholder="t('notes.ai.ask')"
          class="ai-ask-input"
          @keyup.enter="runAsk"
          :disabled="ai.loading.value"
        />
        <button class="ai-ask-btn" @click="runAsk" :disabled="ai.loading.value || !question.trim()">
          <MessageSquare :size="14" />
        </button>
      </div>

      <!-- Loading (only before first chunk arrives) -->
      <div v-if="ai.loading.value && !ai.streamText.value && !suggestedTags.length" class="ai-loading">
        <AppSpinner :size="16"  />
        <span>{{ t('notes.ai.processing') }}</span>
      </div>

      <!-- Error -->
      <div v-if="ai.error.value" class="ai-error">
        {{ ai.error.value }}
      </div>

      <!-- Tags Result -->
      <div v-else-if="suggestedTags.length" class="ai-result">
        <p class="ai-result-label mb-2">{{ t('notes.ai.suggestedTags') }}</p>
        <div class="flex flex-wrap gap-2 mb-3">
          <span v-for="tag in suggestedTags" :key="tag" class="ai-tag-badge">#{{ tag }}</span>
        </div>
        <button class="ai-insert-btn w-full" @click="applyTags">
          <Tag :size="13" />
          {{ t('notes.ai.applyTags') }}
        </button>
      </div>

      <!-- Streaming Text Result -->
      <div v-else-if="ai.streamText.value" class="ai-result">
        <div class="mb-2 flex items-center justify-between">
          <p class="ai-result-label !mb-0">{{ t('notes.ai.result') }}</p>
          <button
            v-if="!ai.loading.value"
            class="text-text-tertiary hover:text-text-primary flex items-center gap-1.5 text-[0.6875rem] font-medium transition-colors"
            @click="copyResult"
          >
            <component :is="copied ? Check : Copy" :size="12" />
            {{ copied ? t('common.copied') : t('common.copy') }}
          </button>
        </div>
        <div class="ai-result-text">
          {{ ai.streamText.value }}<span v-if="ai.loading.value" class="ai-cursor">▋</span>
        </div>
        <div v-if="!ai.loading.value" class="mt-3 flex gap-2">
          <button class="ai-insert-btn flex-1" @click="insertResult">
            <ChevronDown :size="13" />
            {{ t('notes.ai.insert') }}
          </button>
          <button v-if="activeMode === 'rewrite'" class="ai-insert-btn flex-1 bg-warning text-white" @click="replaceResult">
            <Check :size="13" />
            Thay thế toàn bộ
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.ai-panel {
  border: 1px solid var(--border-default);
  border-radius: 12px;
  background: var(--bg-surface);
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
}

.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.875rem;
}

.ai-icon-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--accent-subtle);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.ai-model-badge {
  font-size: 0.625rem;
  background: var(--accent-subtle);
  color: var(--accent);
  border-radius: 100px;
  padding: 1px 7px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.ai-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 120ms;
}
.ai-close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 0.75rem;
}

.ai-action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0.3rem 0.75rem;
  border-radius: 7px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 120ms;
}
.ai-action-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-subtle);
}
.ai-action-btn.active {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent);
}
.ai-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ai-ask-row {
  display: flex;
  gap: 6px;
  margin-bottom: 0.75rem;
}

.ai-ask-input {
  flex: 1;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-primary);
  outline: none;
  transition: border-color 150ms;
}
.ai-ask-input::placeholder { color: var(--text-disabled); }
.ai-ask-input:focus { border-color: var(--accent); }
.ai-ask-input:disabled { opacity: 0.5; }

.ai-ask-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 120ms;
  flex-shrink: 0;
}
.ai-ask-btn:hover:not(:disabled) { opacity: 0.85; }
.ai-ask-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ai-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  padding: 0.5rem 0;
}

.ai-error {
  font-size: 0.8125rem;
  color: var(--error);
  background: rgba(239, 68, 68, 0.08);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}

.ai-result {
  border-top: 1px solid var(--border-subtle);
  padding-top: 0.75rem;
  margin-top: 0.25rem;
}

.ai-result-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ai-result-text {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.75;
  white-space: pre-wrap;
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 0.625rem 0.75rem;
  max-height: 200px;
  overflow-y: auto;
}

.ai-tag-badge {
  font-size: 0.75rem;
  background: var(--accent-subtle);
  color: var(--accent);
  border-radius: 100px;
  padding: 2px 10px;
  font-weight: 500;
}

.ai-copy-btn, .ai-insert-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0.4rem 0.75rem;
  border-radius: 7px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 120ms;
  border: none;
}

.ai-copy-btn {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}
.ai-copy-btn:hover { background: var(--bg-hover); }

.ai-insert-btn {
  background: var(--accent);
  color: #000;
}
.ai-insert-btn:hover { opacity: 0.85; }

/* Transition */
.slide-up-enter-active, .slide-up-leave-active {
  transition: all 200ms ease;
}
.slide-up-enter-from, .slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}


@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ai-cursor {
  display: inline-block;
  color: var(--accent);
  animation: blink 0.7s step-end infinite;
  margin-left: 1px;
  line-height: 1;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
</style>
