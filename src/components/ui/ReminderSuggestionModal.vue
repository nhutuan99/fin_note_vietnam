<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReminderStore } from '@/stores/reminders'
import { useUiStore } from '@/stores/ui'
import type { ReminderSuggestion } from '@/types'
import { Sparkles, Bell, X, ChevronRight, Loader, Link } from 'lucide-vue-next'
import LogoLoader from '@/components/ui/LogoLoader.vue'

const props = defineProps<{
  suggestions: ReminderSuggestion[]
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

const { t } = useI18n()
const store = useReminderStore()
const ui = useUiStore()

const showCreateModal = ref(false)
const selectedSuggestion = ref<ReminderSuggestion | null>(null)
const creating = ref<string | null>(null)

function selectSuggestion(suggestion: ReminderSuggestion) {
  selectedSuggestion.value = suggestion
  showCreateModal.value = true
}

async function quickCreate(suggestion: ReminderSuggestion) {
  creating.value = suggestion.title
  const result = await store.create({
    title: suggestion.title,
    description: suggestion.description,
    url: suggestion.url,
    eventDate: suggestion.eventDate,
    offsets: ['1d'], // Default to 1 day for deadlines
    sourceType: 'note',
  })
  creating.value = null
  if (result) {
    ui.showToast('success', t('reminders.created'))
    emit('created')
  }
}

function handleModalSaved() {
  showCreateModal.value = false
  selectedSuggestion.value = null
  emit('created')
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

// Batch Add Logic
const batchMode = ref(false)
const batchCreating = ref(false)
const batchOffsets = ref<string[]>(['1d'])

const offsetOptions = computed(() => [
  { key: '1d', label: t('reminders.offset1d') },
  { key: '2d', label: t('reminders.offset2d') },
  { key: '3d', label: t('reminders.offset3d') },
  { key: '1w', label: t('reminders.offset1w') },
])

function toggleBatchOffset(key: string) {
  const idx = batchOffsets.value.indexOf(key)
  if (idx === -1) batchOffsets.value.push(key)
  else batchOffsets.value.splice(idx, 1)
}

async function handleBatchCreate() {
  if (batchOffsets.value.length === 0 || batchCreating.value) return
  batchCreating.value = true
  try {
    for (const s of props.suggestions) {
      await store.create({
        title: s.title,
        description: s.description,
        url: s.url,
        eventDate: s.eventDate,
        offsets: batchOffsets.value,
        sourceType: 'note',
      })
    }
    ui.showToast('success', t('reminders.created'))
    emit('created')
  } catch {
    ui.showToast('error', t('common.somethingWentWrong'))
  } finally {
    batchCreating.value = false
  }
}
</script>

<template>
  <!-- Bottom sheet style suggestion panel -->
  <div class="suggestion-overlay">
    <div class="suggestion-sheet">
      <!-- Header -->
      <div class="sheet-header">
        <div class="flex items-center gap-2">
          <div class="ai-badge">
            <Sparkles :size="14" />
            AI
          </div>
          <span class="text-sm font-semibold">{{ t('reminders.aiDetected') }}</span>
        </div>
        <button @click="emit('close')" class="sheet-close">
          <X :size="16" />
        </button>
      </div>

      <p class="text-text-tertiary text-xs px-4 mb-3">
        {{ t('reminders.aiDetectedDesc') }}
      </p>

      <!-- Suggestions List -->
      <div class="sheet-body">
        <template v-if="!batchMode">
          <div
            v-for="(s, idx) in suggestions"
            :key="idx"
            class="suggestion-item"
          >
            <div class="suggestion-info" @click="selectSuggestion(s)">
              <Bell :size="14" class="text-accent shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold truncate">{{ s.title }}</div>
                <div class="text-[0.6875rem] text-text-tertiary flex items-center gap-2">
                  {{ formatDate(s.eventDate) }}
                  <span v-if="s.url" class="inline-flex items-center gap-1 text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                    <Link :size="10" /> Link
                  </span>
                </div>
                <div v-if="s.description" class="text-xs text-text-disabled mt-0.5 truncate">{{ s.description }}</div>
              </div>
              <ChevronRight :size="14" class="text-text-disabled shrink-0" />
            </div>
            <button
              @click="quickCreate(s)"
              :disabled="creating === s.title"
              class="quick-create-btn"
            >
              <AppSpinner v-if="creating === s.title" :size="13"  />
              <template v-else>+ {{ t('reminders.quickAdd') }}</template>
            </button>
          </div>

          <!-- Add All Button -->
          <button
            v-if="suggestions.length > 1"
            @click="batchMode = true"
            class="w-full mt-2 py-3 rounded-xl bg-accent-subtle text-accent font-semibold text-sm hover:bg-accent/20 transition-all border border-accent/20"
          >
            {{ t('reminders.batchAddAll', { n: suggestions.length }) }}
          </button>
        </template>

        <!-- Batch Add Options -->
        <template v-else>
          <div class="p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]">
            <h4 class="text-sm font-semibold mb-1 text-text-primary">{{ t('reminders.batchTitle', { n: suggestions.length }) }}</h4>
            <p class="text-xs text-text-secondary mb-4">{{ t('reminders.batchDesc') }}</p>
            
            <label class="text-xs font-semibold text-text-tertiary uppercase mb-2 block">{{ t('reminders.batchRemindBefore') }}</label>
            <div class="flex flex-wrap gap-2 mb-6">
              <button
                v-for="opt in offsetOptions" :key="opt.key"
                @click="toggleBatchOffset(opt.key)"
                class="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                :class="batchOffsets.includes(opt.key) ? 'bg-accent/20 border-accent text-accent' : 'bg-bg-elevated border-border-default text-text-secondary hover:border-accent'"
              >
                {{ opt.label }}
              </button>
            </div>

            <div class="flex gap-2">
              <button @click="batchMode = false" class="flex-1 py-2 rounded-lg bg-bg-elevated border border-border-default text-xs font-medium hover:bg-bg-hover">{{ t('common.cancel') }}</button>
              <button 
                @click="handleBatchCreate" 
                :disabled="batchOffsets.length === 0 || batchCreating"
                class="flex-1 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <AppSpinner v-if="batchCreating" :size="14"  />
                {{ t('reminders.batchConfirm') }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- Full Create Modal (when user clicks to customize) -->
  <CreateReminderModal
    v-if="showCreateModal && selectedSuggestion"
    :reminder="{
      id: '',
      title: selectedSuggestion.title,
      description: selectedSuggestion.description,
      url: selectedSuggestion.url,
      eventDate: selectedSuggestion.eventDate,
      remindAt: [],
      offsets: ['1h', '1d'],
      notifiedAt: [],
      acknowledged: false,
      lastChanceSent: false,
      sourceType: 'note' as const,
      status: 'active' as const,
      createdAt: '',
      updatedAt: ''
    }"
    @close="showCreateModal = false"
    @saved="handleModalSaved"
  />
</template>

<style scoped>
.suggestion-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: fadeIn 0.15s ease;
}

.suggestion-sheet {
  width: 100%;
  max-width: 28rem;
  max-height: 60vh;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  background: rgba(18, 18, 18, 0.85);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: none;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

@media (min-width: 768px) {
  .suggestion-overlay {
    align-items: center;
  }
  .suggestion-sheet {
    border-radius: var(--radius-xl);
    border-bottom: 1px solid var(--border-default);
    max-height: 70vh;
  }
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.5rem;
}
.sheet-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-sm);
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.sheet-close:hover { background: var(--bg-hover); color: var(--text-primary); }

.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.625rem;
  font-weight: 700;
  background: linear-gradient(135deg, rgba(142, 125, 250, 0.2), rgba(255, 143, 171, 0.2));
  color: var(--accent);
}

.sheet-body {
  padding: 0 1rem 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.suggestion-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.15s ease;
}
.suggestion-item:hover { 
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(142, 125, 250, 0.3); /* subtle accent */
}

.suggestion-info {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  cursor: pointer;
}

.quick-create-btn {
  align-self: flex-end;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-subtle);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.quick-create-btn:hover { background: rgba(142, 125, 250, 0.2); }
.quick-create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
