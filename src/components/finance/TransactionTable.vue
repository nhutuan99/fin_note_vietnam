<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Transaction } from '@/types'
import { formatVND, getCategoryConfig } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'
import { useFinancePolling } from '@/composables/useFinancePolling'
import {
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Wallet,
  Clock,
  Tag,
  FileText,
  Zap
} from 'lucide-vue-next'

const props = defineProps<{
  transactions: Transaction[]
  total: number
  currentPage: number
  pageSize: number
  loading?: boolean
}>()

const emit = defineEmits<{
  delete: [tx: Transaction]
  add: []
  'update:page': [page: number]
}>()

const { t, tm } = useI18n()
const finance = useFinancePolling()

const selectedTx = ref<Transaction | null>(null)

// Format precise time for modal
function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getSourceLabel(source: string) {
  const map: Record<string, string> = {
    'sms': 'SMS',
    'telegram': 'Telegram',
    'notification': 'Auto',
    'manual': 'Manual'
  }
  return map[source] || source
}

function getSourceClass(source: string) {
  const map: Record<string, string> = {
    'sms': 'tx-badge--sms',
    'telegram': 'tx-badge--telegram',
    'notification': 'tx-badge--auto',
    'manual': 'tx-badge--manual'
  }
  return map[source] || 'tx-badge--manual'
}

// Reset pagination when data changes
// Handled by parent now, this is just a dumb component

const paginatedTransactions = computed(() => props.transactions)

const totalPages = computed(() => Math.ceil(props.total / props.pageSize))

const displayedPages = computed(() => {
  const pages: (number | string)[] = []
  for (let i = 1; i <= totalPages.value; i++) {
    if (
      i === 1 || 
      i === totalPages.value || 
      (i >= props.currentPage - 1 && i <= props.currentPage + 1)
    ) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }
  return pages
})

// Group paginated transactions by date
const groupedTransactions = computed(() => {
  const groups: Record<string, Transaction[]> = {}
  paginatedTransactions.value.forEach((tx) => {
    if (!groups[tx.date]) groups[tx.date] = []
    groups[tx.date].push(tx)
  })
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
})

function formatDateGroup(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === today.toISOString().substring(0, 10)) return t('common.today')
  if (dateStr === yesterday.toISOString().substring(0, 10)) return t('common.yesterday')

  const days = tm('days.long') as string[]
  return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function dayTotal(txs: Transaction[]) {
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  return { income, expense, net: income - expense }
}
</script>

<template>
  <!-- Loading State -->
  <template v-if="loading">
    <div class="space-y-4">
      <div v-for="i in 2" :key="'grp-' + i">
        <div class="mb-2 flex items-center justify-between px-1">
          <div class="skeleton h-4 w-24"></div>
          <div class="skeleton h-4 w-16"></div>
        </div>
        <div class="bg-bg-surface border-border-default divide-border-subtle divide-y overflow-hidden rounded-xl border">
          <div v-for="j in 3" :key="'item-' + j" class="flex items-center gap-3 px-4 py-3">
            <div class="skeleton h-10 w-10 rounded-xl"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-3/4"></div>
              <div class="skeleton h-3 w-1/2"></div>
            </div>
            <div class="skeleton h-5 w-16"></div>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- Table View -->
  <template v-else-if="groupedTransactions.length">
    <div class="bg-bg-surface border-border-default overflow-hidden rounded-xl border">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-bg-subtle border-border-subtle border-b text-xs uppercase text-text-tertiary">
            <tr>
              <th class="px-4 py-3 font-medium">{{ t('transactions.tableTransaction') }}</th>
              <th class="px-4 py-3 font-medium text-right">{{ t('transactions.tableAmount') }}</th>
              <th class="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          
          <template v-for="[date, txs] in groupedTransactions" :key="date">
            <tbody class="divide-border-subtle divide-y">
              <!-- Date Header Row -->
              <tr class="bg-bg-active/40">
                <td colspan="3" class="px-4 py-2.5 text-xs font-semibold text-text-secondary">
                  <div class="flex items-center justify-between">
                    <span>{{ formatDateGroup(date) }}</span>
                    <span :class="dayTotal(txs).net > 0 ? 'text-success' : (dayTotal(txs).net < 0 ? 'text-error' : 'text-text-primary')">
                      {{ dayTotal(txs).net > 0 ? '+' : '' }}{{ formatVND(dayTotal(txs).net) }}
                    </span>
                  </div>
                </td>
              </tr>
              
              <!-- Transaction Rows — Clean & Compact -->
              <tr
                v-for="tx in txs"
                :key="tx.id"
                class="group hover:bg-bg-hover transition-colors duration-150 cursor-pointer"
                @click="selectedTx = tx"
              >
                <!-- Transaction Info: Icon + Category + Wallet + Source -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <!-- Category/Wallet Icon -->
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden border border-border-default/30"
                      :style="{ backgroundColor: getWalletBrand(finance.getWalletName(tx.walletId))?.logoUrl ? '#fff' : getCategoryConfig(tx.category).color + '12' }"
                    >
                      <img
                        v-if="getWalletBrand(finance.getWalletName(tx.walletId))?.logoUrl"
                        :src="getWalletBrand(finance.getWalletName(tx.walletId))!.logoUrl"
                        :alt="finance.getWalletName(tx.walletId)"
                        class="h-6 w-6 object-contain"
                        loading="lazy"
                      />
                      <span
                        v-else-if="getWalletBrand(finance.getWalletName(tx.walletId))"
                        class="text-[9px] font-bold"
                        :style="{ color: getWalletBrand(finance.getWalletName(tx.walletId))!.textColor, backgroundColor: getWalletBrand(finance.getWalletName(tx.walletId))!.bgColor }"
                      >
                        {{ getWalletBrand(finance.getWalletName(tx.walletId))!.abbr }}
                      </span>
                      <span v-else class="text-base">{{ getCategoryConfig(tx.category).icon }}</span>
                    </div>
                    
                    <!-- Text Info -->
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-text-primary truncate max-w-[10rem] sm:max-w-[18rem]">
                          {{ t(`categories.${tx.category}`) }}
                        </span>
                        <span :class="['tx-badge', getSourceClass(tx.source)]">
                          {{ getSourceLabel(tx.source) }}
                        </span>
                      </div>
                      <div class="text-[0.6875rem] text-text-disabled mt-0.5 flex items-center gap-1.5 truncate max-w-[14rem] sm:max-w-[22rem]">
                        <span>{{ finance.getWalletName(tx.walletId) }}</span>
                        <span class="opacity-40">•</span>
                        <span>{{ formatTime(tx.createdAt || tx.date) }}</span>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Amount -->
                <td class="px-4 py-3 text-right">
                  <div
                    class="flex items-center justify-end gap-1 font-bold text-[0.8125rem] tabular-nums"
                    :class="tx.type === 'income' ? 'text-success' : 'text-error'"
                  >
                    <ArrowUpRight v-if="tx.type === 'income'" :size="14" />
                    <ArrowDownRight v-else :size="14" />
                    {{ formatVND(tx.amount) }}
                  </div>
                </td>

                <!-- Delete -->
                <td class="px-3 py-3 w-10 text-right">
                  <button
                    class="text-text-tertiary hover:text-error active:text-error hover:bg-error/10 active:bg-error/10 inline-flex rounded-md p-1.5 opacity-100 md:opacity-0 transition-all duration-150 md:group-hover:opacity-100"
                    @click.stop="emit('delete', tx)"
                    :title="t('transactions.deleteTitle')"
                  >
                    <Trash2 :size="15" />
                  </button>
                </td>
              </tr>
            </tbody>
          </template>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 bg-bg-surface border-t border-border-default">
        <div class="text-xs text-text-secondary">
          {{ t('transactions.pagination', { start: (currentPage - 1) * pageSize + 1, end: Math.min(currentPage * pageSize, total), total: total }) }}
        </div>
        <div class="flex items-center gap-1">
          <button 
            class="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            :disabled="currentPage === 1"
            @click="emit('update:page', currentPage - 1)"
          >
            <ChevronLeft :size="16" />
          </button>
          
          <template v-for="(page, idx) in displayedPages" :key="idx">
            <span v-if="page === '...'" class="px-2 text-text-tertiary">...</span>
            <button 
              v-else
              class="min-w-[28px] h-7 px-2 text-xs font-medium rounded-md transition-colors"
              :class="currentPage === page ? 'bg-accent-subtle text-accent font-bold' : 'text-text-secondary hover:bg-bg-hover'"
              @click="emit('update:page', page as number)"
            >
              {{ page }}
            </button>
          </template>

          <button 
            class="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            :disabled="currentPage === totalPages"
            @click="emit('update:page', currentPage + 1)"
          >
            <ChevronRight :size="16" />
          </button>
        </div>
      </div>
    </div>
  </template>

  <!-- Empty State -->
  <template v-else>
    <div class="flex flex-col items-center py-16 text-center">
      <Calendar :size="48" class="text-text-disabled mb-4" />
      <h3 class="mb-2 text-lg font-semibold">{{ t('transactions.empty') }}</h3>
      <p class="text-text-tertiary mb-6 text-sm">{{ t('transactions.emptyHint') }}</p>
      <button @click="emit('add')" class="btn-secondary">
        <Plus :size="16" />
        {{ t('transactions.addTransaction') }}
      </button>
    </div>
  </template>

  <!-- ══════════════════════════════════════════
       Transaction Detail Card — Rich Modal
       ══════════════════════════════════════════ -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="selectedTx" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="selectedTx = null"></div>
        
        <div class="tx-detail-card">
          <!-- Decorative glow -->
          <div class="tx-detail-card__glow" :class="selectedTx.type === 'income' ? 'tx-detail-card__glow--income' : 'tx-detail-card__glow--expense'"></div>

          <!-- Header -->
          <div class="flex justify-between items-start mb-5">
            <div class="flex items-center gap-3">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden border border-border-default/30 shadow-sm"
                :style="{ backgroundColor: getWalletBrand(finance.getWalletName(selectedTx.walletId))?.logoUrl ? '#fff' : getCategoryConfig(selectedTx.category).color + '15' }"
              >
                <img
                  v-if="getWalletBrand(finance.getWalletName(selectedTx.walletId))?.logoUrl"
                  :src="getWalletBrand(finance.getWalletName(selectedTx.walletId))!.logoUrl"
                  :alt="finance.getWalletName(selectedTx.walletId)"
                  class="h-8 w-8 object-contain"
                />
                <span v-else class="text-2xl">{{ getCategoryConfig(selectedTx.category).icon }}</span>
              </div>
              <div>
                <h3 class="text-base font-bold text-text-primary">{{ t(`categories.${selectedTx.category}`) }}</h3>
                <p class="text-[0.6875rem] text-text-tertiary mt-0.5">{{ formatDateTime(selectedTx.createdAt || selectedTx.date) }}</p>
              </div>
            </div>
            <button @click="selectedTx = null" class="text-text-tertiary hover:bg-bg-hover active:bg-bg-hover hover:text-text-primary active:text-text-primary p-1.5 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>

          <!-- Amount Hero -->
          <div class="tx-detail-card__amount" :class="selectedTx.type === 'income' ? 'tx-detail-card__amount--income' : 'tx-detail-card__amount--expense'">
            <div class="text-[0.6875rem] font-semibold uppercase tracking-wider opacity-70 mb-1">
              {{ selectedTx.type === 'income' ? t('transactions.filterIncome') : t('transactions.filterExpense') }}
            </div>
            <div class="text-2xl font-extrabold flex items-center justify-center gap-1.5 tabular-nums">
              <ArrowUpRight v-if="selectedTx.type === 'income'" :size="22" />
              <ArrowDownRight v-else :size="22" />
              {{ formatVND(selectedTx.amount) }}
            </div>
          </div>

          <!-- Details Grid -->
          <div class="tx-detail-card__grid">
            <!-- Wallet -->
            <div class="tx-detail-card__row">
              <div class="tx-detail-card__label">
                <Wallet :size="13" />
                <span>{{ t('transactions.tableWallet') }}</span>
              </div>
              <span class="tx-detail-card__value">{{ finance.getWalletName(selectedTx.walletId) }}</span>
            </div>

            <!-- Category -->
            <div class="tx-detail-card__row">
              <div class="tx-detail-card__label">
                <Tag :size="13" />
                <span>{{ t('addTx.category') }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-sm">{{ getCategoryConfig(selectedTx.category).icon }}</span>
                <span class="tx-detail-card__value">{{ t(`categories.${selectedTx.category}`) }}</span>
              </div>
            </div>

            <!-- Source -->
            <div class="tx-detail-card__row">
              <div class="tx-detail-card__label">
                <Zap :size="13" />
                <span>{{ t('transactions.tableSource') }}</span>
              </div>
              <span :class="['tx-badge', getSourceClass(selectedTx.source)]">
                {{ getSourceLabel(selectedTx.source) }}
              </span>
            </div>

            <!-- Date -->
            <div class="tx-detail-card__row">
              <div class="tx-detail-card__label">
                <Calendar :size="13" />
                <span>{{ t('transactions.tableDate') }}</span>
              </div>
              <span class="tx-detail-card__value">{{ formatDateTime(selectedTx.date) }}</span>
            </div>

            <!-- Created -->
            <div class="tx-detail-card__row">
              <div class="tx-detail-card__label">
                <Clock :size="13" />
                <span>{{ t('transactions.created') }}</span>
              </div>
              <span class="tx-detail-card__value">{{ formatDateTime(selectedTx.createdAt) }}</span>
            </div>
          </div>

          <!-- Note -->
          <div v-if="selectedTx.note" class="mt-4">
            <div class="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
              <FileText :size="12" />
              <span>{{ t('addTx.note') }}</span>
            </div>
            <div class="tx-detail-card__note">
              <p class="text-sm text-text-primary leading-relaxed break-words whitespace-pre-wrap">{{ selectedTx.note }}</p>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-border-subtle">
            <button
              class="tx-detail-card__delete-btn"
              @click="emit('delete', selectedTx!); selectedTx = null"
            >
              <Trash2 :size="14" />
              <span>{{ t('transactions.deleteConfirm') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ══════════════════════════════════════════════
   Transaction Badges — Source labels
   ══════════════════════════════════════════════ */
.tx-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  letter-spacing: 0.03em;
  white-space: nowrap;
  flex-shrink: 0;
}
.tx-badge--sms {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}
.tx-badge--telegram {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-info);
}
.tx-badge--auto {
  background: rgba(251, 191, 36, 0.1);
  color: var(--color-warning);
}
.tx-badge--manual {
  background: var(--color-bg-elevated);
  color: var(--color-text-disabled);
}

/* ══════════════════════════════════════════════
   Transaction Detail Card — Rich Modal
   ══════════════════════════════════════════════ */
.tx-detail-card {
  position: relative;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: 1.25rem;
  width: 100%;
  max-width: 24rem;
  padding: 1.5rem;
  box-shadow:
    0 25px 60px -15px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(124, 111, 247, 0.05);
  overflow: hidden;
}

.tx-detail-card__glow {
  position: absolute;
  top: -4rem;
  right: -3rem;
  width: 12rem;
  height: 12rem;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(30px);
}
.tx-detail-card__glow--income {
  background: rgba(16, 185, 129, 0.08);
}
.tx-detail-card__glow--expense {
  background: rgba(239, 68, 68, 0.06);
}

/* Amount hero block */
.tx-detail-card__amount {
  border-radius: 0.875rem;
  padding: 1rem;
  text-align: center;
  margin-bottom: 1rem;
}
.tx-detail-card__amount--income {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.03));
  border: 1px solid rgba(16, 185, 129, 0.15);
  color: var(--color-success);
}
.tx-detail-card__amount--expense {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.03));
  border: 1px solid rgba(239, 68, 68, 0.12);
  color: var(--color-error);
}

/* Details grid */
.tx-detail-card__grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.tx-detail-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
}
.tx-detail-card__row:last-child {
  border-bottom: none;
}
.tx-detail-card__label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-tertiary);
}
.tx-detail-card__value {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Note block */
.tx-detail-card__note {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  max-height: 10rem;
  overflow-y: auto;
}

/* Delete button */
.tx-detail-card__delete-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-error);
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
}
.tx-detail-card__delete-btn:hover,
.tx-detail-card__delete-btn:active {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
}
</style>
