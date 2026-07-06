<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebtStore } from '@/stores/debt'
import { useUiStore } from '@/stores/ui'

import { formatVND } from '@/constants/finance'
import { formatMoneyShort } from '@/composables/useCurrency'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'
import CurrencyInput from '@/components/ui/CurrencyInput.vue'
import type { Debt } from '@/types'
import {
  HandCoins,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  X
} from 'lucide-vue-next'

const { t } = useI18n()
const debtStore = useDebtStore()
const ui = useUiStore()

// ─── Form state ─────────────────────────────────
const showForm = ref(false)
const formTitle = ref('')
const formType = ref<'borrowed' | 'lent'>('borrowed')
const formAmount = ref<number>(0)
const formCounterparty = ref('')
const formInterestRate = ref<number>(0)
const formStartDate = ref(new Date().toISOString().substring(0, 10))
const formDueDate = ref('')
const formNote = ref('')

// ─── Tab ────────────────────────────────────────
const activeTab = ref<'active' | 'completed'>('active')

const displayDebts = computed(() =>
  activeTab.value === 'active' ? debtStore.activeDebts : debtStore.completedDebts
)

// ─── Helpers ────────────────────────────────────
function getStatus(debt: Debt): 'overdue' | 'due-soon' | 'ok' | 'paid' {
  if (debt.status === 'paid') return 'paid'
  const today = new Date().toISOString().substring(0, 10)
  if (debt.dueDate && debt.dueDate < today) return 'overdue'
  const weekLater = new Date()
  weekLater.setDate(weekLater.getDate() + 7)
  if (debt.dueDate && debt.dueDate <= weekLater.toISOString().substring(0, 10)) return 'due-soon'
  return 'ok'
}

function progressPct(debt: Debt): number {
  if (debt.amount <= 0) return 0
  return Math.min(((debt.amount - debt.remainingAmount) / debt.amount) * 100, 100)
}

function daysUntilDue(debt: Debt): number {
  if (!debt.dueDate) return Infinity
  const diff = new Date(debt.dueDate).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

// ─── Actions ────────────────────────────────────
function resetForm() {
  formTitle.value = ''
  formType.value = 'borrowed'
  formAmount.value = 0
  formCounterparty.value = ''
  formInterestRate.value = 0
  formStartDate.value = new Date().toISOString().substring(0, 10)
  formDueDate.value = ''
  formNote.value = ''
  showForm.value = false
}

function submitDebt() {
  if (!formTitle.value || formAmount.value <= 0) return
  debtStore.addDebt({
    title: formTitle.value,
    type: formType.value,
    amount: formAmount.value,
    remainingAmount: formAmount.value,
    interestRate: formInterestRate.value,
    counterparty: formCounterparty.value,
    startDate: formStartDate.value,
    dueDate: formDueDate.value,
    note: formNote.value,
    status: 'active'
  })
  resetForm()
}

async function handleDelete(debt: Debt) {
  const ok = await ui.requestConfirm({
    title: t('debt.deleteTitle'),
    message: t('debt.deleteMessage'),
    danger: true,
    confirmText: t('common.delete')
  })
  if (ok) debtStore.deleteDebt(debt.id)
}
</script>

<template>
  <div class="mx-auto max-w-[64rem]">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HandCoins :size="22" class="text-accent" />
          {{ t('debt.title') }}
        </h1>
        <p class="text-text-tertiary mt-1 text-sm">{{ t('debt.description') }}</p>
      </div>
      <button @click="showForm = true" class="btn-primary">
        <Plus :size="16" />
        {{ t('debt.add') }}
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 gap-3 mb-6">
      <div class="card-premium p-4 relative overflow-hidden">
        <div class="absolute -right-4 -top-4 w-16 h-16 bg-error/10 rounded-full blur-2xl pointer-events-none" />
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-1">
            <ArrowDownLeft :size="14" class="text-error" />
            <span class="text-[0.6875rem] font-medium text-text-tertiary">{{ t('debt.totalBorrowed') }}</span>
          </div>
          <div class="text-lg font-bold text-error">{{ formatMoneyShort(debtStore.totalBorrowed) }}</div>
        </div>
      </div>
      <div class="card-premium p-4 relative overflow-hidden">
        <div class="absolute -right-4 -top-4 w-16 h-16 bg-success/10 rounded-full blur-2xl pointer-events-none" />
        <div class="relative z-10">
          <div class="flex items-center gap-2 mb-1">
            <ArrowUpRight :size="14" class="text-success" />
            <span class="text-[0.6875rem] font-medium text-text-tertiary">{{ t('debt.totalLent') }}</span>
          </div>
          <div class="text-lg font-bold text-success">{{ formatMoneyShort(debtStore.totalLent) }}</div>
        </div>
      </div>
    </div>

    <!-- Overdue Alert -->
    <div
      v-if="debtStore.overdueDebts.length"
      class="mb-4 flex items-center gap-3 rounded-xl p-3 text-sm bg-error/10 border border-error/20"
    >
      <AlertTriangle :size="16" class="text-error shrink-0" />
      <span class="text-text-primary">
        <strong>{{ debtStore.overdueDebts.length }}</strong> {{ t('debt.overdue') }}
      </span>
    </div>

    <!-- Tabs -->
    <div class="border-border-default flex overflow-hidden rounded-lg border mb-6">
      <button
        v-for="tab in ['active', 'completed'] as const"
        :key="tab"
        class="flex-1 px-4 py-2 text-sm font-medium transition-all duration-150"
        :class="activeTab === tab
          ? 'bg-accent-subtle text-accent'
          : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'"
        @click="activeTab = tab"
      >
        {{ t(`debt.${tab}`) }}
        <span class="ml-1 text-xs opacity-70">
          ({{ tab === 'active' ? debtStore.activeDebts.length : debtStore.completedDebts.length }})
        </span>
      </button>
    </div>

    <!-- Debt List -->
    <div class="space-y-3">
      <div
        v-for="debt in displayDebts"
        :key="debt.id"
        class="bg-bg-surface border-border-default rounded-xl border p-4 transition-all duration-150"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-0.5">
              <span
                class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.625rem] font-bold"
                :class="debt.type === 'borrowed'
                  ? 'bg-error/10 text-error'
                  : 'bg-success/10 text-success'"
              >
                <ArrowDownLeft v-if="debt.type === 'borrowed'" :size="10" />
                <ArrowUpRight v-else :size="10" />
                {{ t(`debt.${debt.type}`) }}
              </span>
              <span
                v-if="getStatus(debt) === 'overdue'"
                class="inline-flex items-center gap-1 rounded-md bg-error/10 px-1.5 py-0.5 text-[0.625rem] font-bold text-error"
              >
                <AlertTriangle :size="10" />
                {{ t('debt.overdue') }}
              </span>
              <span
                v-else-if="getStatus(debt) === 'due-soon'"
                class="inline-flex items-center gap-1 rounded-md bg-warning/10 px-1.5 py-0.5 text-[0.625rem] font-bold text-warning"
              >
                <Clock :size="10" />
                {{ t('debt.dueSoon') }}
              </span>
            </div>
            <h3 class="text-sm font-semibold truncate">{{ debt.title }}</h3>
            <p v-if="debt.counterparty" class="text-[0.75rem] text-text-tertiary truncate">{{ debt.counterparty }}</p>
          </div>
          <div class="text-right shrink-0 ml-3">
            <div class="text-base font-bold">{{ formatVND(debt.remainingAmount) }}</div>
            <div class="text-[0.6875rem] text-text-disabled">/ {{ formatVND(debt.amount) }}</div>
          </div>
        </div>

        <!-- Progress -->
        <div class="bg-bg-elevated h-1.5 overflow-hidden rounded-full mb-2">
          <div
            class="h-full rounded-full transition-all duration-700"
            :class="getStatus(debt) === 'overdue' ? 'bg-error' : getStatus(debt) === 'due-soon' ? 'bg-warning' : 'bg-accent'"
            :style="{ width: progressPct(debt) + '%' }"
          />
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 text-[0.6875rem] text-text-disabled">
            <span v-if="debt.dueDate">{{ t('debt.dueDate') }}: {{ debt.dueDate }}</span>
            <span v-if="debt.interestRate > 0">{{ debt.interestRate }}%/{{ t('debt.interestRateUnit') }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              v-if="debt.status === 'active'"
              @click="debtStore.markPaid(debt.id)"
              class="flex items-center gap-1 rounded-lg px-2 py-1 text-[0.6875rem] font-medium text-success bg-success/10 hover:bg-success/20 transition-colors"
            >
              <CheckCircle2 :size="12" />
              {{ t('debt.markPaid') }}
            </button>
            <button
              @click="handleDelete(debt)"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-text-disabled hover:bg-error/10 hover:text-error transition-colors"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="displayDebts.length === 0"
      class="flex flex-col items-center py-16 text-center"
    >
      <HandCoins :size="48" class="text-text-disabled mb-4" />
      <p class="text-text-secondary font-medium mb-1">{{ t('debt.empty') }}</p>
      <p class="text-text-disabled text-sm mb-4">{{ t('debt.emptyHint') }}</p>
      <button v-if="activeTab === 'active'" @click="showForm = true" class="btn-primary">
        <Plus :size="16" />
        {{ t('debt.add') }}
      </button>
    </div>

    <!-- Add Form Modal -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showForm"
        class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        @click.self="resetForm"
      >
        <div class="bg-bg-surface border-border-default w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden">
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-border-default px-5 py-4">
            <h2 class="text-base font-bold">{{ t('debt.addNew') }}</h2>
            <button @click="resetForm" class="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-bg-hover transition-colors">
              <X :size="16" />
            </button>
          </div>

          <!-- Modal Body -->
          <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <!-- Type toggle -->
            <div class="border-border-default flex overflow-hidden rounded-lg border">
              <button
                v-for="t in (['borrowed', 'lent'] as const)"
                :key="t"
                class="flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-150"
                :class="formType === t
                  ? t === 'borrowed' ? 'bg-error/10 text-error' : 'bg-success/10 text-success'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'"
                @click="formType = t"
              >
                {{ $t(`debt.${t}`) }}
              </button>
            </div>

            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">{{ t('debt.title') }}</label>
              <input
                v-model="formTitle"
                type="text"
                :placeholder="t('debt.titlePlaceholder')"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none"
              />
            </div>

            <!-- Amount -->
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">{{ t('transactions.amount') }}</label>
              <CurrencyInput
                v-model="formAmount"
                placeholder="0"
                className="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all focus:ring-2 focus:outline-none"
              />
            </div>

            <!-- Counterparty -->
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">{{ t('debt.counterparty') }}</label>
              <input
                v-model="formCounterparty"
                type="text"
                :placeholder="t('debt.counterpartyPlaceholder')"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none"
              />
            </div>

            <!-- Interest Rate -->
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">{{ t('debt.interestRate') }}</label>
              <input
                v-model.number="formInterestRate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none"
              />
            </div>

            <!-- Dates -->
            <div class="grid grid-cols-2 gap-3">
              <CustomDatePicker
                v-model="formStartDate"
                :label="t('debt.startDate')"
              />
              <CustomDatePicker
                v-model="formDueDate"
                :label="t('debt.dueDate')"
              />
            </div>

            <!-- Note -->
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">{{ t('addTx.note') }}</label>
              <input
                v-model="formNote"
                type="text"
                :placeholder="t('addTx.notePlaceholder')"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none"
              />
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="border-t border-border-default px-5 py-4 flex gap-3">
            <button @click="resetForm" class="btn-secondary flex-1 justify-center">
              {{ t('common.cancel') }}
            </button>
            <button
              @click="submitDebt"
              :disabled="!formTitle || formAmount <= 0"
              class="btn-primary flex-1 justify-center disabled:opacity-40"
            >
              {{ t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
