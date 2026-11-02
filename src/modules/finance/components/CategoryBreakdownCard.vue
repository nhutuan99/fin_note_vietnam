<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { PieChart, ArrowUpRight, ArrowDownRight, ChevronDown } from 'lucide-vue-next'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { getCategoryConfig } from '@/constants/finance'
import { formatMoneyShort } from '@/composables/useCurrency'

ChartJS.register(ArcElement, Tooltip)

/**
 * Where the money went: a donut of category shares plus a ranking list with each category's
 * amount, share, number of transactions and change vs last month. Rows open the transaction list
 * filtered to that category.
 */
type Kind = 'expense' | 'income'

const { t } = useI18n()
const router = useRouter()
const finance = useFinanceStore()
const ui = useUiStore()

const VISIBLE_ROWS = 5

const kind = ref<Kind>('expense')
const expanded = ref(false)
const activeIndex = ref<number | null>(null)

const rows = computed(() => {
  const list = (kind.value === 'expense' ? finance.stats.expenseByCategory : finance.stats.incomeByCategory) ?? []
  const prev = finance.stats.prevCategoryTotals?.[kind.value] ?? {}
  return list.map((c) => {
    const config = getCategoryConfig(c.category)
    const before = prev[c.category] ?? 0
    return {
      key: c.category,
      icon: config.icon,
      color: config.color,
      total: c.total,
      count: c.count,
      percentage: c.percentage,
      // null = no spending in that category last month
      change: before > 0 ? Math.round(((c.total - before) / before) * 100) : null
    }
  })
})

const total = computed(() => rows.value.reduce((s, r) => s + r.total, 0))
const txCount = computed(() => rows.value.reduce((s, r) => s + r.count, 0))
const visibleRows = computed(() => (expanded.value ? rows.value : rows.value.slice(0, VISIBLE_ROWS)))

const chartData = computed(() => ({
  labels: rows.value.map((r) => r.key),
  datasets: [
    {
      data: rows.value.map((r) => r.total),
      backgroundColor: rows.value.map((r) => r.color),
      borderColor: 'transparent',
      borderWidth: 0,
      hoverOffset: 6,
      spacing: rows.value.length > 1 ? 2 : 0,
      borderRadius: 4
    }
  ]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '72%',
  animation: { duration: 300 },
  transitions: { resize: { animation: { duration: 0 } } },
  layout: { padding: 6 },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false }
  },
  onHover: (_: unknown, elements: { index: number }[]) => {
    activeIndex.value = elements.length ? elements[0].index : null
  }
}))

const center = computed(() => {
  const row = activeIndex.value !== null ? rows.value[activeIndex.value] : null
  if (row) return { label: t(`categories.${row.key}`), value: row.total, sub: `${row.percentage.toFixed(0)}%` }
  return {
    label: kind.value === 'expense' ? t('dashboard.trend.totalOut') : t('dashboard.trend.totalIn'),
    value: total.value,
    sub: t('dashboard.categories.txCount', { n: txCount.value })
  }
})

function setKind(next: Kind) {
  kind.value = next
  activeIndex.value = null
  expanded.value = false
}

function openCategory(key: string) {
  finance.filter = { type: kind.value, category: key }
  router.push('/transactions')
}

/** For spending, going up is the "bad" direction; for income it's the good one */
function changeTone(change: number) {
  const up = change > 0
  return (kind.value === 'expense') === up ? 'is-bad' : 'is-good'
}
</script>

<template>
  <div class="cat-card">
    <div class="cat-card__header">
      <div class="flex items-center gap-2">
        <PieChart :size="16" class="text-text-tertiary" />
        <h3>{{ t('dashboard.categories.title') }}</h3>
      </div>
      <div class="cat-seg" role="tablist">
        <button role="tab" :aria-selected="kind === 'expense'" :class="{ 'is-active is-expense': kind === 'expense' }" @click="setKind('expense')">
          {{ t('dashboard.expense') }}
        </button>
        <button role="tab" :aria-selected="kind === 'income'" :class="{ 'is-active is-income': kind === 'income' }" @click="setKind('income')">
          {{ t('dashboard.income') }}
        </button>
      </div>
    </div>

    <template v-if="rows.length">
      <!-- Donut with the total (or hovered category) in the middle -->
      <div class="cat-card__donut" @mouseleave="activeIndex = null">
        <Doughnut :data="chartData" :options="chartOptions" />
        <div class="cat-card__center">
          <span class="cat-card__center-label">{{ center.label }}</span>
          <span class="cat-card__center-value">{{ ui.hideBalances ? '••••' : formatMoneyShort(center.value) }}</span>
          <span class="cat-card__center-sub">{{ center.sub }}</span>
        </div>
      </div>

      <!-- Ranking -->
      <ol class="cat-list">
        <li
          v-for="(row, i) in visibleRows"
          :key="row.key"
          class="cat-row"
          :class="{ 'is-active': activeIndex === i }"
          tabindex="0"
          role="button"
          @mouseenter="activeIndex = i"
          @mouseleave="activeIndex = null"
          @click="openCategory(row.key)"
          @keydown.enter="openCategory(row.key)"
        >
          <span class="cat-row__icon font-emoji" :style="{ background: `${row.color}22` }">{{ row.icon }}</span>
          <div class="cat-row__body">
            <div class="cat-row__top">
              <span class="cat-row__name">{{ t(`categories.${row.key}`) }}</span>
              <span class="cat-row__amount">{{ ui.hideBalances ? '••••' : formatMoneyShort(row.total) }}</span>
            </div>
            <div class="cat-row__bar">
              <div :style="{ transform: `scaleX(${row.percentage / 100})`, background: row.color }" />
            </div>
            <div class="cat-row__meta">
              <span>{{ row.percentage.toFixed(0) }}% · {{ t('dashboard.categories.txCount', { n: row.count }) }}</span>
              <span v-if="row.change !== null && row.change !== 0" class="cat-row__change" :class="changeTone(row.change)">
                <component :is="row.change > 0 ? ArrowUpRight : ArrowDownRight" :size="11" />
                {{ Math.abs(row.change) }}%
              </span>
              <span v-else-if="row.change === null" class="cat-row__change">{{ t('dashboard.new') }}</span>
            </div>
          </div>
        </li>
      </ol>

      <button v-if="rows.length > VISIBLE_ROWS" class="cat-more" @click="expanded = !expanded">
        {{ expanded ? t('dashboard.categories.showLess') : t('dashboard.categories.showAll', { n: rows.length }) }}
        <ChevronDown :size="14" :class="{ 'rotate-180': expanded }" />
      </button>
    </template>

    <div v-else class="cat-card__empty">{{ t('dashboard.noDataThisMonth') }}</div>
  </div>
</template>

<style scoped>
.cat-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.25rem;
  border-radius: 1rem;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.cat-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.cat-card__header h3 {
  font-size: 0.875rem;
  font-weight: 600;
}

.cat-seg {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 0.5rem;
  background: var(--bg-elevated);
}

.cat-seg button {
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.cat-seg button.is-active {
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
}

.cat-seg button.is-expense {
  color: var(--error);
}

.cat-seg button.is-income {
  color: var(--success);
}

.cat-card__donut {
  position: relative;
  height: 11rem;
  margin-bottom: 0.75rem;
}

.cat-card__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text-align: center;
}

.cat-card__center-label {
  max-width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.cat-card__center-value {
  font-size: 1.125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cat-card__center-sub {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.cat-list {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.cat-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin: 0 -0.5rem;
  border-radius: 0.625rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.cat-row:hover,
.cat-row.is-active,
.cat-row:focus-visible {
  background: var(--bg-hover);
  outline: none;
}

.cat-row__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 0.625rem;
  font-size: 1rem;
}

.cat-row__body {
  flex: 1;
  min-width: 0;
}

.cat-row__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.cat-row__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  font-weight: 500;
}

.cat-row__amount {
  font-size: 0.8125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.cat-row__bar {
  height: 0.25rem;
  margin: 0.375rem 0 0.25rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-elevated);
}

.cat-row__bar > div {
  height: 100%;
  border-radius: 999px;
  transform-origin: left;
  transition: transform 0.4s ease;
}

.cat-row__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.cat-row__change {
  display: inline-flex;
  align-items: center;
  gap: 0.0625rem;
  font-weight: 600;
}

.cat-row__change.is-bad {
  color: var(--error);
}

.cat-row__change.is-good {
  color: var(--success);
}

.cat-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding: 0.375rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.cat-more:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.cat-card__empty {
  display: flex;
  flex: 1;
  min-height: 12rem;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  color: var(--text-disabled);
}
</style>
