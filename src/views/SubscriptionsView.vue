<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFinancePolling } from '@/composables/useFinancePolling'
import { formatVND, getCategoryConfig } from '@/constants/finance'
import { useI18n } from 'vue-i18n'
import type { Transaction } from '@/types'
import { CreditCard, AlertTriangle, Calendar, Loader2 } from 'lucide-vue-next'

const { t } = useI18n()
const finance = useFinancePolling()

const transactions = ref<Transaction[]>([])
const loading = ref(true)

onMounted(async () => {
  transactions.value = await finance.getExportTransactions()
  loading.value = false
})

// Auto-detect subscriptions from transaction history
// Look for recurring expenses with same amount + same category in different months
const subscriptions = computed(() => {
  const txs = transactions.value.filter(tx => tx.type === 'expense')
  const grouped: Record<string, { amount: number; category: string; note: string; walletId: string; dates: string[]; count: number }> = {}

  for (const tx of txs) {
    // Group by amount + category + note (normalized)
    const key = `${tx.amount}-${tx.category}-${(tx.note || '').toLowerCase().trim()}`
    if (!grouped[key]) {
      grouped[key] = { amount: tx.amount, category: tx.category, note: tx.note, walletId: tx.walletId, dates: [], count: 0 }
    }
    grouped[key].dates.push(tx.date)
    grouped[key].count++
  }

  // Filter: transactions that appear 2+ times with same amount = likely subscription
  return Object.values(grouped)
    .filter(g => g.count >= 2)
    .map(g => {
      const sortedDates = g.dates.sort()
      const lastDate = sortedDates[sortedDates.length - 1]
      // Estimate next date (assume monthly)
      const last = new Date(lastDate)
      const next = new Date(last)
      next.setMonth(next.getMonth() + 1)
      return { ...g, lastDate, nextDate: next.toISOString().substring(0, 10), isUpcoming: next.getTime() - Date.now() < 7 * 86400000 }
    })
    .sort((a, b) => b.amount - a.amount)
})

const totalMonthly = computed(() => subscriptions.value.reduce((s, sub) => s + sub.amount, 0))
const upcomingCount = computed(() => subscriptions.value.filter(s => s.isUpcoming).length)

function fmtDate(d: string) { const [, m, dd] = d.split('-'); return `${dd}/${m}` }
</script>

<template>
  <div class="mx-auto max-w-[64rem]">
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight">{{ t('subs.title') }}</h1>
      <p class="text-text-tertiary mt-1 text-sm">{{ t('subs.desc') }}</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-text-tertiary" />
    </div>
    
    <template v-else>
      <!-- Summary -->
    <div v-if="subscriptions.length" class="card-premium mb-6 flex items-center justify-between p-4">
      <div class="flex items-center gap-3">
        <div class="bg-error/10 flex h-9 w-9 items-center justify-center rounded-lg"><CreditCard :size="18" class="text-error" /></div>
        <div>
          <div class="text-text-tertiary text-[0.6875rem] font-medium">{{ t('subs.monthlyTotal') }}</div>
          <div class="text-lg font-bold text-error">-{{ formatVND(totalMonthly) }}</div>
        </div>
      </div>
      <div v-if="upcomingCount > 0" class="flex items-center gap-1.5 bg-warning/10 text-warning px-3 py-1.5 rounded-lg text-xs font-semibold">
        <AlertTriangle :size="14" /> {{ t('subs.upcoming', { n: upcomingCount }) }}
      </div>
    </div>

    <!-- List -->
    <div class="space-y-3">
      <div v-if="!subscriptions.length" class="bg-bg-surface border-border-default flex flex-col items-center rounded-2xl border border-dashed py-12 text-center">
        <CreditCard :size="48" class="text-text-disabled mb-4" />
        <h4 class="mb-2 text-lg font-semibold">{{ t('subs.empty') }}</h4>
        <p class="text-text-tertiary text-sm max-w-xs">{{ t('subs.emptyHint') }}</p>
      </div>

      <div v-for="sub in subscriptions" :key="`${sub.amount}-${sub.category}-${sub.note}`" class="bg-bg-surface border-border-default hover:border-border-strong flex items-center gap-4 rounded-xl border p-4 transition-all duration-150" :class="{ 'border-warning/30': sub.isUpcoming }">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" :style="{ backgroundColor: getCategoryConfig(sub.category).color + '15' }">{{ getCategoryConfig(sub.category).icon }}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold truncate">{{ sub.note || t(`categories.${sub.category}`) }}</span>
            <span v-if="sub.isUpcoming" class="text-[0.625rem] font-bold px-1.5 py-px rounded bg-warning/15 text-warning">{{ t('subs.soon') }}</span>
          </div>
          <div class="text-text-disabled flex items-center gap-2 text-[0.6875rem] mt-0.5">
            <span class="flex items-center gap-1"><Calendar :size="10" /> {{ t('subs.nextBill') }}: {{ fmtDate(sub.nextDate) }}</span>
            <span>·</span>
            <span>{{ sub.count }}x {{ t('subs.detected') }}</span>
          </div>
        </div>
        <div class="text-sm font-bold text-error whitespace-nowrap">-{{ formatVND(sub.amount) }}</div>
      </div>
    </div>
    </template>
  </div>
</template>
