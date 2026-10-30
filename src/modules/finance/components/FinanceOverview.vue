<script setup lang="ts">
// 1. Vue core
import { computed } from 'vue'
// 2. Vue ecosystem
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
// 3. Composables / Stores
import { useFinancePolling } from '@/composables/useFinancePolling'
import { usePortfolioSummary } from '@/composables/usePortfolioSummary'
import { useUiStore } from '@/stores/ui'
import { useSavingsStore } from '@/stores/savings'
// 4. Utils
import { formatVNDShort } from '@/constants/finance'
// 5. Components & icons
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  LineChart,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Target
} from 'lucide-vue-next'
import WeatherWidget from '@/components/WeatherWidget.vue'

const { t, tm } = useI18n()
const router = useRouter()
const finance = useFinancePolling()
const ui = useUiStore()
const portfolio = usePortfolioSummary()
const savings = useSavingsStore()


// ── Month navigation ──

const monthLabel = computed(() => {
  const [y, m] = finance.selectedMonth.split('-')
  const months = tm('months') as string[]
  return `${months[parseInt(m) - 1]}, ${y}`
})

function prevMonth() {
  const [y, m] = finance.selectedMonth.split('-').map(Number)
  let newM = m - 1
  let newY = y
  if (newM < 1) { newM = 12; newY-- }
  finance.selectedMonth = `${newY}-${String(newM).padStart(2, '0')}`
}

function nextMonth() {
  const [y, m] = finance.selectedMonth.split('-').map(Number)
  let newM = m + 1
  let newY = y
  if (newM > 12) { newM = 1; newY++ }
  finance.selectedMonth = `${newY}-${String(newM).padStart(2, '0')}`
}

const isCurrentMonth = computed(() => {
  const d = new Date()
  return finance.selectedMonth === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

/** The big number: Net Worth when investments exist, wallet balance otherwise */
const primaryBalance = computed(() =>
  portfolio.hasInvestments.value ? portfolio.totalNetWorth.value : finance.totalBalance
)
</script>

<template>
  <!-- ── Weather hero ── -->
  <div class="relative mb-6">
    <WeatherWidget>
      <template #actions>
        <button @click="router.push('/transactions/add')" class="btn-primary">
          <Plus :size="16" />
          <span class="hidden sm:inline">{{ t('dashboard.addTransaction') }}</span>
        </button>
      </template>
    </WeatherWidget>
  </div>

  <!-- ── Month selector ── -->
  <div class="mb-5 flex items-center justify-center gap-2">
    <button
      @click="prevMonth"
      class="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
    >
      <ChevronLeft :size="18" />
    </button>
    <span class="text-sm font-bold text-text-primary min-w-[10rem] text-center">
      {{ monthLabel }}
    </span>
    <button
      @click="nextMonth"
      :disabled="isCurrentMonth"
      class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
      :class="isCurrentMonth ? 'text-text-disabled cursor-not-allowed' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'"
    >
      <ChevronRight :size="18" />
    </button>
  </div>

  <!-- ── Overview cards grid ── -->
  <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

    <!-- ★ Total Balance / Net Worth ── -->
    <div
      class="relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-0 sm:col-span-1"
      style="border-color: color-mix(in srgb, var(--accent) 30%, transparent); background: color-mix(in srgb, var(--accent) 4%, var(--bg-surface)); box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 8%, transparent);"
    >
      <!-- glow decor -->
      <div
        class="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl"
        style="background: color-mix(in srgb, var(--accent) 18%, transparent);"
      />

      <!-- Label row -->
      <div class="relative z-10 mb-3 flex items-center gap-2">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
          style="background: color-mix(in srgb, var(--accent) 12%, transparent);"
        >
          <Wallet :size="18" class="text-accent" />
        </div>
        <span class="text-text-tertiary text-sm">
          {{ portfolio.hasInvestments.value ? t('dashboard.totalAssets') : t('dashboard.totalBalance') }}
        </span>
        <button
          @click="ui.toggleHideBalances()"
          class="ml-auto text-text-tertiary hover:text-accent flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-bg-hover"
          :title="t('dashboard.toggleBalance')"
        >
          <EyeOff v-if="ui.hideBalances" :size="16" />
          <Eye v-else :size="16" />
        </button>
      </div>

      <!-- Primary balance number -->
      <div v-if="finance.loading" class="skeleton h-9 w-44 mt-1 relative z-10" />
      <div v-else class="relative z-10 text-3xl font-bold tracking-tight text-text-primary leading-none">
        {{ ui.hideBalances ? '••••••' : formatVNDShort(primaryBalance) }}
      </div>

      <!-- Breakdown rows (only when investments exist) -->
      <template v-if="(!finance.loading)">
        <div class="relative z-10 mt-3 space-y-1.5 border-t pt-3" style="border-color: color-mix(in srgb, var(--border-subtle) 80%, transparent);">

          <!-- Total Savings row -->
          <div v-if="savings.totalSaved > 0" class="flex items-center gap-2">
            <Target :size="12" class="text-accent shrink-0" />
            <span class="flex-1 text-xs text-text-disabled">{{ t('savings.totalSaved') }}</span>
            <span class="text-xs tabular-nums text-text-secondary font-medium">
              {{ ui.hideBalances ? '•••' : formatVNDShort(savings.totalSaved) }}
            </span>
          </div>

          <template v-if="portfolio.hasInvestments.value">
            <!-- Wallet row -->
          <div class="flex items-center gap-2">
            <Wallet :size="12" class="text-text-disabled shrink-0" />
            <span class="flex-1 text-xs text-text-disabled">{{ t('dashboard.walletBalance') }}</span>
            <span class="text-xs tabular-nums text-text-secondary font-medium">
              {{ ui.hideBalances ? '•••' : formatVNDShort(finance.totalBalance) }}
            </span>
          </div>

          <!-- Stocks P&L -->
          <div v-if="portfolio.hasStocks.value" class="flex items-center gap-2">
            <LineChart
              :size="12"
              class="shrink-0"
              :class="portfolio.stockProfit.value >= 0 ? 'text-success' : 'text-error'"
            />
            <span class="flex-1 text-xs text-text-disabled">{{ t('dashboard.stocksLabel') }}</span>
            <span
              class="text-xs tabular-nums font-bold flex items-center gap-0.5"
              :class="portfolio.stockProfit.value >= 0 ? 'text-success' : 'text-error'"
            >
              <component
                :is="portfolio.stockProfit.value >= 0 ? ArrowUpRight : ArrowDownRight"
                :size="11"
              />
              {{ ui.hideBalances ? '•••' : formatVNDShort(Math.abs(portfolio.stockProfit.value)) }}
            </span>
          </div>

          <!-- Funds P&L -->
          <div v-if="portfolio.hasFunds.value" class="flex items-center gap-2">
            <Landmark
              :size="12"
              class="shrink-0"
              :class="portfolio.fundProfit.value >= 0 ? 'text-success' : 'text-error'"
            />
            <span class="flex-1 text-xs text-text-disabled">{{ t('dashboard.fundsLabel') }}</span>
            <span
              class="text-xs tabular-nums font-bold flex items-center gap-0.5"
              :class="portfolio.fundProfit.value >= 0 ? 'text-success' : 'text-error'"
            >
              <component
                :is="portfolio.fundProfit.value >= 0 ? ArrowUpRight : ArrowDownRight"
                :size="11"
              />
              {{ ui.hideBalances ? '•••' : formatVNDShort(Math.abs(portfolio.fundProfit.value)) }}
            </span>
          </div>
          </template>
        </div>
      </template>
    </div>

    <!-- Monthly Income ── -->
    <div class="relative overflow-hidden rounded-2xl border border-border-default bg-bg-surface p-5 flex flex-col gap-0">
      <div class="mb-3 flex items-center gap-2">
        <div class="bg-success/10 flex h-9 w-9 items-center justify-center rounded-lg shrink-0">
          <TrendingUp :size="18" class="text-success" />
        </div>
        <span class="text-text-tertiary text-sm">{{ t('dashboard.monthIncome') }}</span>
      </div>
      <div v-if="finance.loading" class="skeleton h-8 w-32 mt-1" />
      <div
        v-else
        class="text-2xl font-bold tracking-tight"
        :class="finance.monthIncome > 0 ? 'text-success' : 'text-text-primary'"
      >
        {{ finance.monthIncome > 0 ? '+' : '' }}{{ formatVNDShort(finance.monthIncome) }}
      </div>
      <!-- Net savings hint -->
      <div
        v-if="!finance.loading && finance.monthNet !== 0"
        class="mt-2 flex items-center gap-1 text-[11px]"
        :class="finance.monthNet >= 0 ? 'text-success' : 'text-error'"
      >
        <component :is="finance.monthNet >= 0 ? ArrowUpRight : ArrowDownRight" :size="12" />
        <span>{{ t('dashboard.monthlySavings') }} {{ formatVNDShort(Math.abs(finance.monthNet)) }}</span>
      </div>
    </div>

    <!-- Monthly Expense ── -->
    <div class="relative overflow-hidden rounded-2xl border border-border-default bg-bg-surface p-5 flex flex-col gap-0">
      <div class="mb-3 flex items-center gap-2">
        <div class="bg-error/10 flex h-9 w-9 items-center justify-center rounded-lg shrink-0">
          <TrendingDown :size="18" class="text-error" />
        </div>
        <span class="text-text-tertiary text-sm">{{ t('dashboard.monthExpense') }}</span>
      </div>
      <div v-if="finance.loading" class="skeleton h-8 w-32 mt-1" />
      <div
        v-else
        class="text-2xl font-bold tracking-tight"
        :class="finance.monthExpense > 0 ? 'text-error' : 'text-text-primary'"
      >
        {{ finance.monthExpense > 0 ? '-' : '' }}{{ formatVNDShort(finance.monthExpense) }}
      </div>
      <!-- Expense rate -->
      <div
        v-if="!finance.loading && finance.monthIncome > 0 && finance.monthExpense > 0"
        class="mt-2 text-[11px] text-text-disabled"
      >
        {{ Math.round((finance.monthExpense / finance.monthIncome) * 100) }}{{ t('dashboard.incomePercent') }}
      </div>
    </div>
  </div>
</template>
