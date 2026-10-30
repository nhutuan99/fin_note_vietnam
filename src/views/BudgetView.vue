<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { formatVND, getCategoryConfig } from '@/constants/finance'
import { useI18n } from 'vue-i18n'
import { useAi } from '@/composables/useGemini'
import { formatMoneyShort } from '@/composables/useCurrency'
import { Target, AlertTriangle, Bot, Sparkles, TrendingDown } from 'lucide-vue-next'
import type { BudgetGoal, CategoryBudget } from '@/types'
import CurrencyInput from '@/components/ui/CurrencyInput.vue'

const { t } = useI18n()
const finance = useFinanceStore()
const { streamText: aiText, loading: aiLoading, askFinance } = useAi()

onMounted(() => finance.fetchAll())

const STORAGE_KEY = 'finnote_budget'
const currentMonth = new Date().toISOString().substring(0, 7)

function loadBudget(): BudgetGoal | null { try { const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return d?.month === currentMonth ? d : null } catch { return null } }
function saveBudget(b: BudgetGoal) { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)) }

const budget = ref<BudgetGoal | null>(loadBudget())
const showSetup = ref(!budget.value)
const budgetInput = ref<number>(0)
const aiPlanGenerated = ref(false)

// Computed stats
const spent = computed(() => finance.monthExpense)
const remaining = computed(() => budget.value ? Math.max(0, budget.value.totalLimit - spent.value) : 0)
const pct = computed(() => budget.value && budget.value.totalLimit > 0 ? Math.min((spent.value / budget.value.totalLimit) * 100, 100) : 0)
const daysLeft = computed(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() })
const dailyRemaining = computed(() => daysLeft.value > 0 ? Math.round(remaining.value / daysLeft.value) : 0)

const categoryStats = computed<(CategoryBudget & { icon: string; color: string; pct: number })[]>(() => {
  if (!budget.value) return []
  return budget.value.categoryBudgets.map(cb => {
    const cfg = getCategoryConfig(cb.category)
    const stat = finance.expenseByCategoryThisMonth.find(c => c.category === cb.category)
    const actualSpent = stat ? stat.total : 0
    return { ...cb, spent: actualSpent, icon: cfg.icon, color: cfg.color, pct: cb.limit > 0 ? Math.min((actualSpent / cb.limit) * 100, 100) : 0 }
  }).sort((a, b) => b.pct - a.pct)
})

const alerts = computed(() => {
  return categoryStats.value.filter(c => c.pct >= 80).map(c => ({
    category: c.category, icon: c.icon, pct: c.pct,
    level: c.pct >= 100 ? 'danger' : 'warning' as 'danger' | 'warning'
  }))
})

async function setupBudget() {
  const amt = budgetInput.value
  if (amt <= 0) return

  // Create budget with AI-generated category allocation
  const catTotals = finance.expenseByCategoryThisMonth

  const categoryBudgets: CategoryBudget[] = catTotals.length > 0
    ? catTotals.map(c => ({ category: c.category, limit: Math.round(amt * (c.percentage / 100)), spent: c.total }))
    : [{ category: 'food', limit: Math.round(amt * 0.35), spent: 0 }, { category: 'transport', limit: Math.round(amt * 0.15), spent: 0 }, { category: 'entertainment', limit: Math.round(amt * 0.1), spent: 0 }, { category: 'shopping', limit: Math.round(amt * 0.15), spent: 0 }, { category: 'bills', limit: Math.round(amt * 0.15), spent: 0 }, { category: 'other_expense', limit: Math.round(amt * 0.1), spent: 0 }]

  const newBudget: BudgetGoal = { id: crypto.randomUUID(), month: currentMonth, totalLimit: amt, categoryBudgets, alertThreshold: 0.8, createdAt: new Date().toISOString() }
  budget.value = newBudget
  saveBudget(newBudget)
  showSetup.value = false

  // Ask AI for analysis
  const catLines = categoryBudgets.map(c => `  ${getCategoryConfig(c.category).icon} ${t(`categories.${c.category}`)}: ${formatMoneyShort(c.limit)}`).join('\n')
  const prompt = `Người dùng vừa đặt ngân sách tháng ${currentMonth}: ${formatMoneyShort(amt)}.\nĐã chi: ${formatMoneyShort(spent.value)} | Còn lại: ${formatMoneyShort(remaining.value)} | Còn ${daysLeft.value} ngày\nPhân bổ theo danh mục:\n${catLines}\n\nHãy đưa ra 3-4 lời khuyên ngắn gọn, thực tế dựa trên dữ liệu trên. Dùng emoji, Markdown.`
  aiPlanGenerated.value = true
  await askFinance(prompt)
}

function resetBudget() { budget.value = null; showSetup.value = true; localStorage.removeItem(STORAGE_KEY); aiPlanGenerated.value = false }
</script>

<template>
  <div class="mx-auto max-w-[64rem]">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('budget.title') }}</h1>
        <p class="text-text-tertiary mt-1 text-sm">{{ new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }}</p>
      </div>
      <button v-if="budget" @click="resetBudget" class="btn-secondary text-xs">{{ t('budget.reset') }}</button>
    </div>

    <!-- Setup -->
    <div v-if="showSetup" class="card-premium p-6 mb-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="bg-accent/10 flex h-10 w-10 items-center justify-center rounded-xl"><Target :size="20" class="text-accent" /></div>
        <div><h3 class="font-semibold">{{ t('budget.setupTitle') }}</h3><p class="text-text-tertiary text-sm">{{ t('budget.setupHint') }}</p></div>
      </div>
      <CurrencyInput v-model="budgetInput" :placeholder="t('budget.inputPlaceholder')" className="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-3 text-center text-2xl font-bold transition-all focus:ring-2 focus:outline-none mb-4 tracking-wide" />
      <button @click="setupBudget" :disabled="budgetInput <= 0 || aiLoading" class="btn-primary w-full justify-center py-3 disabled:opacity-40">
        <Sparkles :size="16" /> {{ aiLoading ? t('dashboard.aiAnalyzing') : t('budget.saveAndAnalyze') }}
      </button>
    </div>

    <!-- Main Budget Display -->
    <template v-if="budget">
      <!-- Overview Card -->
      <div class="card-premium p-5 mb-6 border-accent/30 relative overflow-hidden">
        <div class="absolute -right-8 -top-8 w-32 h-32 bg-accent/15 rounded-full blur-3xl pointer-events-none"></div>
        <div class="flex items-center justify-between mb-4 relative z-10">
          <div>
            <div class="text-text-tertiary text-[0.6875rem] font-medium">{{ t('budget.monthlyBudget') }}</div>
            <div class="text-2xl font-bold">{{ formatVND(budget.totalLimit) }}</div>
          </div>
          <div class="text-right">
            <div class="text-text-tertiary text-[0.6875rem]">{{ t('budget.remaining') }}</div>
            <div class="text-xl font-bold" :class="remaining > 0 ? 'text-success' : (remaining < 0 ? 'text-error' : 'text-text-primary')">{{ formatVND(remaining) }}</div>
          </div>
        </div>
        <div class="bg-bg-elevated h-3 overflow-hidden rounded-full mb-2 relative z-10">
          <div class="h-full rounded-full transition-all duration-700" :class="pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-warning' : 'bg-accent'" :style="{ width: pct + '%' }"></div>
        </div>
        <div class="flex justify-between text-[0.6875rem] relative z-10">
          <span class="text-text-tertiary">{{ t('budget.spent') }}: {{ formatVND(spent) }} ({{ pct.toFixed(0) }}%)</span>
          <span class="text-text-tertiary">~{{ formatVND(dailyRemaining) }}/{{ t('savings.perDay') }}</span>
        </div>
      </div>

      <!-- Alerts -->
      <div v-if="alerts.length" class="mb-6 space-y-2">
        <div v-for="a in alerts" :key="a.category" class="flex items-center gap-3 rounded-xl p-3 text-sm" :class="a.level === 'danger' ? 'bg-error/10 border border-error/20' : 'bg-warning/10 border border-warning/20'">
          <AlertTriangle :size="16" :class="a.level === 'danger' ? 'text-error' : 'text-warning'" />
          <span>{{ a.icon }} {{ t(`categories.${a.category}`) }}: <strong>{{ a.pct.toFixed(0) }}%</strong> {{ t('budget.ofBudget') }}</span>
        </div>
      </div>

      <!-- Category Breakdown -->
      <div class="bg-bg-surface border-border-default rounded-xl border p-5 mb-6">
        <h3 class="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingDown :size="16" class="text-text-tertiary" /> {{ t('budget.byCategory') }}</h3>
        <div class="space-y-4">
          <div v-for="c in categoryStats" :key="c.category">
            <div class="flex items-center justify-between mb-1">
              <span class="flex items-center gap-2 text-sm"><span>{{ c.icon }}</span><span class="text-text-secondary">{{ t(`categories.${c.category}`) }}</span></span>
              <span class="text-[0.75rem] font-semibold">{{ formatVND(c.spent) }} <span class="text-text-disabled font-normal">/ {{ formatVND(c.limit) }}</span></span>
            </div>
            <div class="bg-bg-elevated h-1.5 overflow-hidden rounded-full">
              <div class="h-full rounded-full transition-all duration-500" :class="c.pct >= 100 ? 'bg-error' : c.pct >= 80 ? 'bg-warning' : 'bg-accent'" :style="{ width: c.pct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI Analysis -->
      <div v-if="aiPlanGenerated && (aiText || aiLoading)" class="card-premium p-5">
        <div class="flex items-center gap-2 mb-3">
          <div class="bg-info/10 flex h-7 w-7 items-center justify-center rounded-lg"><Bot :size="14" class="text-info" /></div>
          <span class="text-sm font-semibold">{{ t('budget.aiAnalysis') }}</span>
        </div>
        <div v-if="aiLoading && !aiText" class="space-y-2"><div class="skeleton h-3 w-full rounded-lg" /><div class="skeleton h-3 w-5/6 rounded-lg" /><div class="skeleton h-3 w-4/5 rounded-lg" /></div>
        <div v-if="aiText" class="text-text-secondary text-[0.8125rem] leading-relaxed whitespace-pre-wrap">{{ aiText }}</div>
      </div>
    </template>
  </div>
</template>
