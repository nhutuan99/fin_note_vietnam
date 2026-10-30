<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFinanceStore } from '@/stores/finance'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { X, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-vue-next'
import AppSpinner from '@/components/ui/AppSpinner.vue'

type Scope = 'week' | 'month' | 'year'

const emit = defineEmits<{
  close: []
  cleared: []
}>()

const { t } = useI18n()
const finance = useFinanceStore()
const auth = useAuthStore()
const ui = useUiStore()

const scope = ref<Scope>('month')
/** 0 = current period, -1 = previous, ... (future periods are not selectable) */
const offset = ref(0)
const count = ref<number | null>(null)
const isCounting = ref(false)
const isClearing = ref(false)
// Hide this modal while the global PIN dialog is open (both share the modal z-index)
const awaitingPin = ref(false)

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDM(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Inclusive local-date range of the selected period. Weeks run Monday → Sunday. */
const range = computed(() => {
  const now = new Date()
  if (scope.value === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset.value * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
  }
  if (scope.value === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth() + offset.value, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    return { start, end }
  }
  const year = now.getFullYear() + offset.value
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) }
})

const periodLabel = computed(() => {
  const { start, end } = range.value
  if (scope.value === 'week') {
    return `${formatDM(start)} – ${formatDM(end)}/${end.getFullYear()}`
  }
  if (scope.value === 'month') {
    return t('transactions.clearMonthLabel', { month: start.getMonth() + 1, year: start.getFullYear() })
  }
  return t('transactions.clearYearLabel', { year: start.getFullYear() })
})

const relativeLabel = computed(() => {
  if (offset.value === 0) return t(`transactions.clearThis.${scope.value}`)
  if (offset.value === -1) return t(`transactions.clearLast.${scope.value}`)
  return ''
})

function setScope(s: Scope) {
  scope.value = s
  offset.value = 0
}

let countRequestId = 0
async function refreshCount() {
  const requestId = ++countRequestId
  isCounting.value = true
  const res = await finance.clearTransactions(toISODate(range.value.start), toISODate(range.value.end), true)
  if (requestId !== countRequestId) return
  count.value = res ? res.count : null
  isCounting.value = false
}

watch(range, refreshCount, { immediate: true })

async function handleClear() {
  if (!count.value || isClearing.value) return

  // Bulk deletion includes SMS/notification transactions, which are PIN-protected individually
  if (!auth.isGuest) {
    awaitingPin.value = true
    const pinOk = await ui.requestPinValidation(
      t('transactions.clearPinTitle'),
      t('transactions.clearPinMessage', { n: count.value })
    )
    awaitingPin.value = false
    if (!pinOk) return
  }

  isClearing.value = true
  const res = await finance.clearTransactions(toISODate(range.value.start), toISODate(range.value.end))
  isClearing.value = false

  if (!res) {
    ui.showToast('error', t('common.somethingWentWrong'))
    return
  }
  ui.showToast('success', t('transactions.clearSuccess', { n: res.deleted }))
  emit('cleared')
}
</script>

<template>
  <div v-show="!awaitingPin" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="bg-error/10 text-error flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Trash2 :size="20" />
          </div>
          <div>
            <h3 class="text-lg font-bold">{{ t('transactions.clearTitle') }}</h3>
            <p class="text-text-tertiary text-sm">{{ t('transactions.clearDesc') }}</p>
          </div>
        </div>
        <button @click="emit('close')" class="modal-close">
          <X :size="20" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Scope selector -->
        <div class="border-border-default mb-4 flex overflow-hidden rounded-lg border">
          <button
            v-for="s in (['week', 'month', 'year'] as const)"
            :key="s"
            class="bg-bg-surface border-border-default flex-1 border-r px-3 py-2 text-sm transition-all duration-150 last:border-r-0"
            :class="scope === s ? 'bg-accent-subtle text-accent font-medium' : 'text-text-secondary hover:bg-bg-hover'"
            @click="setScope(s)"
          >
            {{ t(`transactions.clearScope.${s}`) }}
          </button>
        </div>

        <!-- Period navigator -->
        <div class="bg-bg-elevated mb-4 flex items-center justify-between rounded-xl p-2">
          <button class="nav-btn" :aria-label="t('transactions.clearPrev')" @click="offset--">
            <ChevronLeft :size="18" />
          </button>
          <div class="text-center">
            <div class="text-text-primary text-sm font-semibold">{{ periodLabel }}</div>
            <div v-if="relativeLabel" class="text-text-tertiary text-xs">{{ relativeLabel }}</div>
          </div>
          <button class="nav-btn" :aria-label="t('transactions.clearNext')" :disabled="offset >= 0" @click="offset++">
            <ChevronRight :size="18" />
          </button>
        </div>

        <!-- Preview -->
        <div class="border-error/30 bg-error/5 flex items-start gap-2.5 rounded-xl border p-3 text-sm">
          <AlertTriangle :size="16" class="text-error mt-0.5 shrink-0" />
          <div>
            <div class="text-text-primary font-medium">
              <AppSpinner v-if="isCounting" :size="14" class="inline-block" />
              <template v-else-if="count !== null">{{ t('transactions.clearCount', { n: count }) }}</template>
            </div>
            <div class="text-text-tertiary mt-1 text-xs whitespace-pre-line">{{ t('transactions.clearWarning') }}</div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="emit('close')" class="btn-cancel" :disabled="isClearing">
          {{ t('common.cancel') }}
        </button>
        <button @click="handleClear" class="btn-delete" :disabled="!count || isCounting || isClearing">
          <AppSpinner v-if="isClearing" :size="16" />
          <Trash2 v-else :size="16" />
          {{ t('transactions.clearConfirm', { n: count || 0 }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

.modal-container {
  width: 100%;
  max-width: 28rem;
  background: var(--bg-surface);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-default);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp {
  from { transform: translateY(20px) scale(0.95); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 1rem 1.5rem;
  overflow-y: auto;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
}

.btn-cancel {
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.btn-delete {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  background: var(--error);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(251, 113, 133, 0.2);
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
