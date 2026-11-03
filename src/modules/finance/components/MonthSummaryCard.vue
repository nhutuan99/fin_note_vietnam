<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowUpRight, ArrowDownRight, Minus, Target } from 'lucide-vue-next'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { formatVNDShort } from '@/constants/finance'
import type { DayTotals } from '@/types'

/**
 * "This month" at a glance: spent (vs the same point last month), income, what's left,
 * average spend per day and — when a budget is set — budget progress with a daily allowance.
 */
const { t } = useI18n()
const finance = useFinanceStore()
const ui = useUiStore()

const money = (v: number) => (ui.hideBalances ? '••••' : formatVNDShort(v))

const monthInfo = computed(() => {
  const [y, m] = finance.selectedMonth.split('-').map(Number)
  const today = new Date()
  const isCurrent = today.getFullYear() === y && today.getMonth() + 1 === m
  const days = new Date(y, m, 0).getDate()
  return { isCurrent, days, elapsed: isCurrent ? today.getDate() : days }
})

const spent = computed(() => finance.monthExpense)
const net = computed(() => finance.monthIncome - finance.monthExpense)
const dailyAverage = computed(() => spent.value / Math.max(1, monthInfo.value.elapsed))

/**
 * Compare with the same number of days of last month while the month is in progress
 * (a full month vs half a month would always look "down"), and with the full month otherwise.
 */
const comparison = computed(() => {
  const prevDaily: DayTotals[] = finance.stats.prevDaily ?? []
  if (!prevDaily.length) return null
  const upTo = monthInfo.value.isCurrent ? Math.min(monthInfo.value.elapsed, prevDaily.length) : prevDaily.length
  const previous = prevDaily.slice(0, upTo).reduce((s, d) => s + d.expense, 0)
  // Nothing to compare against (e.g. first month of use): show no comparison rather than a meaningless one
  if (previous <= 0) return null
  const diff = spent.value - previous
  const ratio = spent.value / previous
  // "×14" reads better than "1317%" when last month's figure was tiny
  const label = ratio >= 3 ? `×${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}` : `${Math.abs(Math.round((diff / previous) * 100))}%`
  return { label, diff }
})

// Budget is configured on the Budget page (stored per month on this device)
const budget = computed(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('finnote_budget') || 'null')
    if (!stored || stored.month !== finance.selectedMonth || !(stored.totalLimit > 0)) return null
    const limit: number = stored.totalLimit
    const remaining = limit - spent.value
    const daysLeft = monthInfo.value.isCurrent ? monthInfo.value.days - monthInfo.value.elapsed + 1 : 0
    return {
      limit,
      pct: Math.min(100, Math.round((spent.value / limit) * 100)),
      remaining,
      perDay: daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0,
      over: remaining < 0,
      warn: spent.value / limit >= (stored.alertThreshold ?? 0.8)
    }
  } catch {
    return null
  }
})
</script>

<template>
  <div class="month-card">
    <div class="month-card__main">
      <div class="month-card__label">{{ monthInfo.isCurrent ? t('dashboard.spentThisMonth') : t('dashboard.spentInMonth') }}</div>
      <div v-if="finance.loading && !finance.stats.daily" class="skeleton mt-1 h-10 w-44" />
      <div v-else class="month-card__spent" :class="{ 'is-zero': spent === 0 }">
        {{ spent > 0 ? '−' : '' }}{{ money(spent) }}
      </div>

      <div v-if="comparison" class="month-card__compare">
        <span
          class="month-card__delta"
          :class="comparison.diff > 0 ? 'is-up' : comparison.diff < 0 ? 'is-down' : ''"
        >
          <component :is="comparison.diff > 0 ? ArrowUpRight : comparison.diff < 0 ? ArrowDownRight : Minus" :size="13" />
          {{ comparison.label }}
        </span>
        <span class="text-text-tertiary">
          {{ monthInfo.isCurrent ? t('dashboard.vsSameDayLastMonth') : t('dashboard.vsLastMonth') }}
          <template v-if="!ui.hideBalances">({{ comparison.diff >= 0 ? '+' : '−' }}{{ formatVNDShort(Math.abs(comparison.diff)) }})</template>
        </span>
      </div>
    </div>

    <div class="month-card__stats">
      <div class="month-stat">
        <span class="month-stat__label">{{ t('dashboard.income') }}</span>
        <span class="month-stat__value text-success">{{ finance.monthIncome > 0 ? '+' : '' }}{{ money(finance.monthIncome) }}</span>
      </div>
      <div class="month-stat">
        <span class="month-stat__label">{{ t('dashboard.leftover') }}</span>
        <span class="month-stat__value" :class="net >= 0 ? 'text-text-primary' : 'text-error'">
          {{ net < 0 ? '−' : '' }}{{ money(Math.abs(net)) }}
        </span>
      </div>
      <div class="month-stat">
        <span class="month-stat__label">{{ t('dashboard.dailyAverage') }}</span>
        <span class="month-stat__value">{{ money(dailyAverage) }}</span>
      </div>
    </div>

    <!-- Budget (only when one is set for this month) -->
    <router-link v-if="budget" to="/budget" class="month-card__budget">
      <div class="flex items-center justify-between gap-2 text-xs">
        <span class="flex items-center gap-1.5 text-text-secondary">
          <Target :size="13" />
          {{ t('dashboard.budgetUsed', { pct: budget.pct, limit: money(budget.limit) }) }}
        </span>
        <span :class="budget.over ? 'text-error' : 'text-text-tertiary'">
          <template v-if="budget.over">{{ t('dashboard.budgetOver', { amount: money(-budget.remaining) }) }}</template>
          <template v-else-if="budget.perDay > 0">{{ t('dashboard.budgetPerDay', { amount: money(budget.perDay) }) }}</template>
          <template v-else>{{ t('dashboard.budgetLeft', { amount: money(budget.remaining) }) }}</template>
        </span>
      </div>
      <div class="month-card__bar">
        <div
          class="month-card__bar-fill"
          :class="{ 'is-warn': budget.warn && !budget.over, 'is-over': budget.over }"
          :style="{ transform: `scaleX(${budget.pct / 100})` }"
        />
      </div>
    </router-link>
  </div>
</template>

<style scoped>
.month-card {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem 1.5rem;
  height: 100%;
  padding: 1.25rem;
  border-radius: 1rem;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

@media (min-width: 640px) {
  .month-card {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    align-items: center;
  }
}

.month-card__label {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.month-card__spent {
  margin-top: 0.25rem;
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--error);
  font-variant-numeric: tabular-nums;
}

.month-card__spent.is-zero {
  color: var(--text-primary);
}

.month-card__compare {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
}

.month-card__delta {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-weight: 600;
}

/* Spending more than last month is the "bad" direction */
.month-card__delta.is-up {
  background: color-mix(in srgb, var(--error) 14%, transparent);
  color: var(--error);
}

.month-card__delta.is-down {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.month-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.month-stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: var(--bg-elevated);
}

.month-stat__label {
  font-size: 0.6875rem;
  line-height: 1.3;
  color: var(--text-tertiary);
  overflow-wrap: break-word;
}

.month-stat__value {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.month-card__budget {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--border-subtle);
  color: inherit;
  text-decoration: none;
}

.month-card__bar {
  height: 0.375rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-elevated);
}

/* scaleX instead of width: no layout work when the value changes */
.month-card__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transform-origin: left;
  transition: transform 0.4s ease;
}

.month-card__bar-fill.is-warn {
  background: var(--warning);
}

.month-card__bar-fill.is-over {
  background: var(--error);
}
</style>
