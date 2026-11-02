<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowUpRight, ArrowDownRight, ChevronDown, LayoutList } from 'lucide-vue-next'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { getCategoryConfig } from '@/constants/finance'
import { categoryColor, otherColor } from '@/constants/categoryPalette'
import { formatMoneyShort } from '@/composables/useCurrency'

/**
 * Where the money went, as an allocation bar (one 100% bar split by category) + a ranked list.
 *
 * Part-to-whole reads better as a single stacked bar than a donut: segment lengths compare
 * directly, it takes little height and it lines up with the list below. Up to five categories
 * keep their own color; the rest fold into a gray "Other" (no generated 6th+ hues).
 * Hovering a segment or row highlights the pair; rows open the filtered transaction list.
 */
type Kind = 'expense' | 'income'

interface Row {
  key: string
  icon: string
  color: string
  total: number
  count: number
  share: number
  /** % change vs the same period last month; null = nothing last month */
  change: number | null
}

const MAX_NAMED = 5
const OTHER_KEY = '__other'

const { t } = useI18n()
const router = useRouter()
const finance = useFinanceStore()
const ui = useUiStore()

const kind = ref<Kind>('expense')
const activeKey = ref<string | null>(null)
const showOtherMembers = ref(false)

const theme = computed(() => (ui.theme === 'light' ? 'light' : 'dark'))

const allRows = computed<Row[]>(() => {
  const list = (kind.value === 'expense' ? finance.stats.expenseByCategory : finance.stats.incomeByCategory) ?? []
  const prev = finance.stats.prevCategoryTotals?.[kind.value] ?? {}
  return list.map((c) => {
    const before = prev[c.category] ?? 0
    return {
      key: c.category,
      icon: getCategoryConfig(c.category).icon,
      color: categoryColor(c.category, theme.value),
      total: c.total,
      count: c.count,
      share: c.percentage,
      change: before > 0 ? Math.round(((c.total - before) / before) * 100) : null
    }
  })
})

const total = computed(() => allRows.value.reduce((s, r) => s + r.total, 0))
const txCount = computed(() => allRows.value.reduce((s, r) => s + r.count, 0))

/** Named rows keep their color; rows without a color slot or past the 5th fold into "Other" */
const split = computed(() => {
  const named: Row[] = []
  const folded: Row[] = []
  for (const row of allRows.value) {
    if (named.length < MAX_NAMED && row.color !== otherColor(theme.value)) named.push(row)
    else folded.push(row)
  }
  return { named, folded }
})

const otherRow = computed<Row | null>(() => {
  const folded = split.value.folded
  if (!folded.length) return null
  const sum = folded.reduce((s, r) => s + r.total, 0)
  return {
    key: OTHER_KEY,
    icon: '',
    color: otherColor(theme.value),
    total: sum,
    count: folded.reduce((s, r) => s + r.count, 0),
    share: total.value > 0 ? (sum / total.value) * 100 : 0,
    change: null
  }
})

/** Segments of the allocation bar, in list order */
const segments = computed(() => [...split.value.named, ...(otherRow.value ? [otherRow.value] : [])])

/** Month total vs the same stretch of last month */
const totalChange = computed(() => {
  const prev = Object.values(finance.stats.prevCategoryTotals?.[kind.value] ?? {}).reduce((s, v) => s + v, 0)
  return prev > 0 ? Math.round(((total.value - prev) / prev) * 100) : null
})

/** "×14" instead of "1317%" when the change is huge */
function changeLabel(change: number) {
  const ratio = 1 + change / 100
  if (ratio >= 3) return `×${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}`
  return `${Math.abs(change)}%`
}

const headline = computed(() => {
  const row = segments.value.find((r) => r.key === activeKey.value)
  if (row) return { label: rowName(row), value: row.total, sub: `${row.share.toFixed(1)}% · ${t('dashboard.categories.txCount', { n: row.count })}` }
  return {
    label: kind.value === 'expense' ? t('dashboard.trend.totalOut') : t('dashboard.trend.totalIn'),
    value: total.value,
    sub: t('dashboard.categories.txCount', { n: txCount.value })
  }
})

function rowName(row: Row) {
  return row.key === OTHER_KEY ? t('dashboard.categories.other') : t(`categories.${row.key}`)
}

function setKind(next: Kind) {
  kind.value = next
  activeKey.value = null
  showOtherMembers.value = false
}

function open(row: Row) {
  if (row.key === OTHER_KEY) {
    showOtherMembers.value = !showOtherMembers.value
    return
  }
  finance.filter = { type: kind.value, category: row.key }
  router.push('/transactions')
}

/** Spending going up is the "bad" direction; for income it's the good one */
function tone(change: number) {
  return (kind.value === 'expense') === change > 0 ? 'is-bad' : 'is-good'
}

const money = (v: number) => (ui.hideBalances ? '••••' : formatMoneyShort(v))
</script>

<template>
  <div class="cat-card">
    <div class="cat-card__header">
      <div class="flex items-center gap-2">
        <LayoutList :size="16" class="text-text-tertiary" />
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

    <template v-if="allRows.length">
      <!-- Headline: total, or the hovered category -->
      <div class="cat-head">
        <span class="cat-head__label">{{ headline.label }}</span>
        <div class="cat-head__row">
          <span class="cat-head__value">{{ money(headline.value) }}</span>
          <span
            v-if="!activeKey && totalChange !== null && totalChange !== 0"
            class="cat-change"
            :class="tone(totalChange)"
            :title="t('dashboard.vsSameDayLastMonth')"
          >
            <component :is="totalChange > 0 ? ArrowUpRight : ArrowDownRight" :size="12" />
            {{ changeLabel(totalChange) }}
          </span>
        </div>
        <span class="cat-head__sub">{{ headline.sub }}</span>
      </div>

      <!-- Allocation bar -->
      <div class="cat-bar" role="img" :aria-label="t('dashboard.categories.title')" @mouseleave="activeKey = null">
        <div
          v-for="seg in segments"
          :key="seg.key"
          class="cat-bar__seg"
          :class="{ 'is-dim': activeKey && activeKey !== seg.key }"
          :style="{ flexGrow: seg.total, background: seg.color }"
          @mouseenter="activeKey = seg.key"
        />
      </div>

      <!-- Ranked list (direct labels for every colored segment) -->
      <ul class="cat-list" @mouseleave="activeKey = null">
        <template v-for="row in segments" :key="row.key">
          <li
            class="cat-row"
            :class="{ 'is-active': activeKey === row.key, 'is-dim': activeKey && activeKey !== row.key }"
            tabindex="0"
            role="button"
            :aria-expanded="row.key === OTHER_KEY ? showOtherMembers : undefined"
            @mouseenter="activeKey = row.key"
            @focus="activeKey = row.key"
            @click="open(row)"
            @keydown.enter="open(row)"
          >
            <span class="cat-row__dot" :style="{ background: row.color }" />
            <span class="cat-row__name">
              <span v-if="row.icon" class="font-emoji">{{ row.icon }}</span>
              {{ rowName(row) }}
              <ChevronDown v-if="row.key === OTHER_KEY" :size="13" class="cat-row__chevron" :class="{ 'rotate-180': showOtherMembers }" />
            </span>
            <span v-if="row.change !== null && row.change !== 0" class="cat-change" :class="tone(row.change)">
              <component :is="row.change > 0 ? ArrowUpRight : ArrowDownRight" :size="11" />
              {{ changeLabel(row.change) }}
            </span>
            <span class="cat-row__share">{{ row.share.toFixed(0) }}%</span>
            <span class="cat-row__amount">{{ money(row.total) }}</span>
          </li>

          <!-- Members of "Other", on demand -->
          <template v-if="row.key === OTHER_KEY && showOtherMembers">
            <li
              v-for="member in split.folded"
              :key="member.key"
              class="cat-row cat-row--member"
              tabindex="0"
              role="button"
              @click="open(member)"
              @keydown.enter="open(member)"
            >
              <span class="cat-row__dot is-hollow" />
              <span class="cat-row__name">
                <span class="font-emoji">{{ member.icon }}</span>
                {{ rowName(member) }}
              </span>
              <span class="cat-row__share">{{ member.share.toFixed(0) }}%</span>
              <span class="cat-row__amount">{{ money(member.total) }}</span>
            </li>
          </template>
        </template>
      </ul>
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

/* ── Headline ── */
.cat-head {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin: 1rem 0 0.875rem;
  min-height: 4.25rem;
}

.cat-head__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.cat-head__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cat-head__value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.cat-head__sub {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

/* ── Allocation bar: 2px surface gaps between segments, rounded outer ends ── */
.cat-bar {
  display: flex;
  gap: 2px;
  height: 0.75rem;
  margin-bottom: 1rem;
  overflow: hidden;
  border-radius: 999px;
}

.cat-bar__seg {
  flex-basis: 0;
  min-width: 4px;
  border-radius: 2px;
  transition: opacity 0.15s ease;
  cursor: pointer;
}

.cat-bar__seg.is-dim {
  opacity: 0.25;
}

/* ── List ── */
.cat-list {
  display: flex;
  flex-direction: column;
}

.cat-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.5rem;
  padding: 0 0.5rem;
  margin: 0 -0.5rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.cat-row + .cat-row {
  border-top: 1px solid var(--border-subtle);
}

.cat-row:hover,
.cat-row.is-active,
.cat-row:focus-visible {
  background: var(--bg-hover);
  outline: none;
}

.cat-row.is-dim {
  opacity: 0.55;
}

.cat-row__dot {
  width: 0.5rem;
  height: 0.5rem;
  flex-shrink: 0;
  border-radius: 2px;
}

.cat-row__dot.is-hollow {
  border: 1px solid var(--border-strong);
}

.cat-row__name {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-primary);
}

.cat-row__chevron {
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.cat-row--member {
  padding-left: 1.25rem;
  font-size: 0.75rem;
}

.cat-row--member .cat-row__name {
  color: var(--text-secondary);
}

.cat-row__share {
  width: 2.5rem;
  flex-shrink: 0;
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.cat-row__amount {
  min-width: 3.75rem;
  flex-shrink: 0;
  text-align: right;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.cat-change {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
  padding: 0 0.3125rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.cat-change.is-bad {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  color: var(--error);
}

.cat-change.is-good {
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
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
