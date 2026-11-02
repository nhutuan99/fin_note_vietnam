<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip
} from 'chart.js'
import { BarChart3, TrendingUp } from 'lucide-vue-next'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { formatMoneyShort } from '@/composables/useCurrency'
import { useChartTheme, withAlpha } from '@/composables/useChartTheme'
import type { DayTotals } from '@/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip)

/**
 * Month trend:
 * - "Daily": a bar per day of the selected month (money out or in), hover/tap for the day's figure.
 * - "Cumulative": running total this month vs last month — shows at a glance whether
 *   spending is ahead of or behind last month's pace.
 */
type Kind = 'expense' | 'income'
type Mode = 'daily' | 'cumulative'

const { t, tm } = useI18n()
const finance = useFinanceStore()
const ui = useUiStore()
const theme = useChartTheme()

const kind = ref<Kind>('expense')
const mode = ref<Mode>('daily')
const hoverIndex = ref<number | null>(null)

const days = computed<DayTotals[]>(() => finance.stats.daily ?? [])
const prevDays = computed<DayTotals[]>(() => finance.stats.prevDaily ?? [])

/** Last day with data for the current month (today); the whole month for past months */
const lastIndex = computed(() => {
  const [y, m] = finance.selectedMonth.split('-').map(Number)
  const now = new Date()
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m
  return isCurrent ? now.getDate() - 1 : days.value.length - 1
})

const values = computed(() => days.value.map((d) => d[kind.value]))
const prevValues = computed(() => prevDays.value.map((d) => d[kind.value]))
const monthTotal = computed(() => values.value.reduce((s, v) => s + v, 0))

function running(list: number[], upTo: number): (number | null)[] {
  let sum = 0
  return list.map((v, i) => {
    if (i > upTo) return null
    sum += v
    return sum
  })
}

const cumulative = computed(() => running(values.value, lastIndex.value))
const prevCumulative = computed(() => running(prevValues.value, prevValues.value.length - 1).slice(0, days.value.length))

const isEmpty = computed(
  () => monthTotal.value === 0 && (mode.value === 'daily' || prevValues.value.every((v) => v === 0))
)

const peak = computed(() => {
  let best = -1
  values.value.forEach((v, i) => {
    if (v > 0 && (best === -1 || v > values.value[best])) best = i
  })
  return best === -1 ? null : { index: best, value: values.value[best] }
})

function dayLabel(index: number) {
  const d = days.value[index]
  if (!d) return ''
  const date = new Date(`${d.date}T00:00:00`)
  const weekday = (tm('days.short') as string[])[date.getDay()]
  return `${weekday}, ${date.getDate()}/${date.getMonth() + 1}`
}

/** Header line: the hovered day, or the month summary */
const headline = computed(() => {
  const i = hoverIndex.value
  if (i !== null && days.value[i]) {
    if (mode.value === 'cumulative') {
      const cur = cumulative.value[i]
      const prev = prevCumulative.value[i]
      return {
        title: dayLabel(i),
        value: cur ?? prev ?? 0,
        extra: prev != null ? t('dashboard.trend.lastMonthSameDay', { amount: formatMoneyShort(prev) }) : ''
      }
    }
    return { title: dayLabel(i), value: values.value[i], extra: '' }
  }
  return {
    title: kind.value === 'expense' ? t('dashboard.trend.totalOut') : t('dashboard.trend.totalIn'),
    value: monthTotal.value,
    extra: peak.value ? t('dashboard.trend.peak', { day: dayLabel(peak.value.index), amount: formatMoneyShort(peak.value.value) }) : ''
  }
})

const color = computed(() => (kind.value === 'expense' ? theme.value.expense : theme.value.income))
const labels = computed(() => days.value.map((d) => String(parseInt(d.date.substring(8, 10), 10))))

const barData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      data: values.value,
      // Today is solid, the rest softer; hover highlighting is Chart.js' own (no data re-render)
      backgroundColor: values.value.map((_, i) => (i === lastIndex.value ? color.value : withAlpha(color.value, 0.5))),
      hoverBackgroundColor: color.value,
      borderRadius: 4,
      borderSkipped: false as const,
      maxBarThickness: 18,
      minBarLength: 0
    }
  ]
}))

const lineData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: 'current',
      data: cumulative.value,
      borderColor: color.value,
      backgroundColor: withAlpha(color.value, 0.12),
      fill: 'origin' as const,
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: color.value,
      spanGaps: false
    },
    {
      label: 'previous',
      data: prevCumulative.value,
      borderColor: theme.value.muted,
      borderDash: [5, 4],
      borderWidth: 1.5,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointHoverBackgroundColor: theme.value.muted,
      fill: false
    }
  ]
}))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  // Re-rendering on resize shouldn't replay the animation
  transitions: { resize: { animation: { duration: 0 } } },
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: false,
      // The header shows the hovered value: cheaper and steadier than a floating tooltip
      external: ({ tooltip }: { tooltip: { opacity: number; dataPoints?: { dataIndex: number }[] } }) => {
        hoverIndex.value = tooltip.opacity === 0 ? null : (tooltip.dataPoints?.[0]?.dataIndex ?? null)
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: theme.value.text, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
    },
    y: {
      beginAtZero: true,
      // Keep a sane axis when everything is 0 (Chart.js would otherwise show -1…1)
      suggestedMax: isEmpty.value ? 1 : undefined,
      grid: { color: theme.value.grid, drawTicks: false },
      border: { display: false },
      ticks: {
        color: theme.value.text,
        font: { size: 10 },
        padding: 6,
        maxTicksLimit: 4,
        callback: (v: number | string) => (Number(v) === 0 ? '0' : formatMoneyShort(Number(v)))
      }
    }
  }
}))

const crosshair = {
  id: 'trendCrosshair',
  afterDraw(chart: ChartJS) {
    const active = chart.tooltip?.getActiveElements()
    if (!active?.length || mode.value !== 'cumulative') return
    const { ctx, chartArea } = chart
    const x = active[0].element.x
    ctx.save()
    ctx.strokeStyle = theme.value.crosshair
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  }
}
</script>

<template>
  <div class="trend-card">
    <div class="trend-card__header">
      <div class="trend-card__title">
        <component :is="mode === 'daily' ? BarChart3 : TrendingUp" :size="16" class="text-text-tertiary" />
        <h3>{{ t('dashboard.trend.title') }}</h3>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="trend-seg" role="tablist" :aria-label="t('dashboard.trend.kind')">
          <button
            role="tab"
            :aria-selected="kind === 'expense'"
            :class="{ 'is-active is-expense': kind === 'expense' }"
            @click="kind = 'expense'"
          >
            {{ t('dashboard.expense') }}
          </button>
          <button
            role="tab"
            :aria-selected="kind === 'income'"
            :class="{ 'is-active is-income': kind === 'income' }"
            @click="kind = 'income'"
          >
            {{ t('dashboard.income') }}
          </button>
        </div>
        <div class="trend-seg" role="tablist" :aria-label="t('dashboard.trend.mode')">
          <button
            role="tab"
            :aria-selected="mode === 'daily'"
            :class="{ 'is-active': mode === 'daily' }"
            :title="t('dashboard.trend.daily')"
            @click="mode = 'daily'"
          >
            {{ t('dashboard.trend.daily') }}
          </button>
          <button
            role="tab"
            :aria-selected="mode === 'cumulative'"
            :class="{ 'is-active': mode === 'cumulative' }"
            :title="t('dashboard.trend.cumulative')"
            @click="mode = 'cumulative'"
          >
            {{ t('dashboard.trend.cumulative') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Live headline: hovered day or month summary -->
    <div class="trend-card__headline">
      <span class="trend-card__headline-title">{{ headline.title }}</span>
      <span class="trend-card__headline-value" :style="{ color }">
        {{ ui.hideBalances ? '••••' : formatMoneyShort(headline.value) }}
      </span>
      <span v-if="headline.extra && !ui.hideBalances" class="trend-card__headline-extra">{{ headline.extra }}</span>
    </div>

    <div v-if="mode === 'cumulative'" class="trend-card__legend">
      <span><i :style="{ background: color }" />{{ t('dashboard.trend.thisMonth') }}</span>
      <span><i class="is-dashed" />{{ t('dashboard.trend.lastMonth') }}</span>
    </div>

    <div class="trend-card__chart" @mouseleave="hoverIndex = null">
      <Bar v-if="mode === 'daily'" :data="barData" :options="options" />
      <Line v-else :data="lineData" :options="options" :plugins="[crosshair]" />
      <div v-if="isEmpty && !finance.loading" class="trend-card__empty">
        {{ t('dashboard.noDataThisMonth') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.trend-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.25rem;
  border-radius: 1rem;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.trend-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.trend-card__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.trend-card__title h3 {
  font-size: 0.875rem;
  font-weight: 600;
}

.trend-seg {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 0.5rem;
  background: var(--bg-elevated);
}

.trend-seg button {
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary);
  white-space: nowrap;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.trend-seg button:hover {
  color: var(--text-secondary);
}

.trend-seg button.is-active {
  background: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.trend-seg button.is-expense {
  color: var(--error);
}

.trend-seg button.is-income {
  color: var(--success);
}

.trend-card__headline {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.625rem;
  margin: 0.875rem 0 0.25rem;
  min-height: 1.75rem;
}

.trend-card__headline-title {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.trend-card__headline-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.trend-card__headline-extra {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.trend-card__legend {
  display: flex;
  gap: 1rem;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.trend-card__legend span {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.trend-card__legend i {
  display: inline-block;
  width: 0.875rem;
  height: 2px;
  border-radius: 2px;
}

.trend-card__legend i.is-dashed {
  background: repeating-linear-gradient(90deg, var(--text-disabled) 0 4px, transparent 4px 7px);
}

.trend-card__chart {
  position: relative;
  flex: 1;
  min-height: 12rem;
  margin-top: 0.5rem;
}

.trend-card__empty {
  position: absolute;
  inset: 0 0 1.5rem 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  color: var(--text-disabled);
  pointer-events: none;
}
</style>
