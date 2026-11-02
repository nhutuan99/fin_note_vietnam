<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { formatVND, getCategoryConfig, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import type { RecurringTransaction, RecurringFrequency } from '@/types'
import { Plus, Trash2, Repeat, ToggleLeft, ToggleRight, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-vue-next'
import CurrencyInput from '@/components/ui/CurrencyInput.vue'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'

const { t } = useI18n()
const finance = useFinanceStore()
const ui = useUiStore()
onMounted(() => finance.fetchWallets())

const STORAGE_KEY = 'finnote_recurring'
function loadData(): RecurringTransaction[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] } }
function persist(items: RecurringTransaction[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) }

const items = ref<RecurringTransaction[]>(loadData())
const showAdd = ref(false)
const form = ref({ type: 'expense' as 'income'|'expense', amount: 0, category: 'food', walletId: '', note: '', frequency: 'monthly' as RecurringFrequency, nextDate: new Date().toISOString().substring(0, 10) })
onMounted(() => { if (finance.cashWallets.length && !form.value.walletId) form.value.walletId = finance.cashWallets[0].id })

const freqOpts: { key: RecurringFrequency; icon: string }[] = [
  { key: 'daily', icon: '📅' }, { key: 'weekly', icon: '📆' }, { key: 'monthly', icon: '🗓️' }, { key: 'yearly', icon: '🎯' }
]
const cats = computed(() => form.value.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)
const valid = computed(() => form.value.amount > 0 && form.value.walletId && form.value.nextDate)

function add() {
  if (!valid.value) return
  items.value.push({ id: crypto.randomUUID(), type: form.value.type, amount: form.value.amount, category: form.value.category, walletId: form.value.walletId, note: form.value.note, frequency: form.value.frequency, nextDate: form.value.nextDate, enabled: true, createdAt: new Date().toISOString() })
  persist(items.value); showAdd.value = false
  form.value = { type: 'expense', amount: 0, category: 'food', walletId: finance.cashWallets[0]?.id || '', note: '', frequency: 'monthly', nextDate: new Date().toISOString().substring(0, 10) }
}
function toggle(id: string) { const i = items.value.find(r => r.id === id); if (i) i.enabled = !i.enabled; persist(items.value) }
async function del(id: string) {
  const ok = await ui.requestConfirm({ title: t('recurring.deleteTitle'), message: t('recurring.deleteMessage'), danger: true, confirmText: t('common.delete') })
  if (!ok) return; items.value = items.value.filter(r => r.id !== id); persist(items.value)
}
function fmtDate(d: string) { const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}` }
const monthlyEst = computed(() => {
  let tot = 0
  for (const i of items.value) { if (!i.enabled) continue; let m = i.amount; if (i.frequency === 'daily') m *= 30; else if (i.frequency === 'weekly') m *= 4; else if (i.frequency === 'yearly') m = Math.round(m/12); tot += i.type === 'expense' ? -m : m }
  return tot
})
</script>

<template>
  <div class="mx-auto max-w-[64rem]">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('recurring.title') }}</h1>
        <p class="text-text-tertiary mt-1 text-sm">{{ t('recurring.count', { n: items.length }) }}</p>
      </div>
      <button @click="showAdd = !showAdd" class="btn-primary"><Plus :size="16" /> {{ t('recurring.add') }}</button>
    </div>

    <div v-if="items.length" class="card-premium mb-6 flex items-center justify-between p-4">
      <div class="flex items-center gap-3">
        <div class="bg-accent/10 flex h-9 w-9 items-center justify-center rounded-lg"><Repeat :size="18" class="text-accent" /></div>
        <div>
          <div class="text-text-tertiary text-[0.6875rem] font-medium">{{ t('recurring.monthlyEstimate') }}</div>
          <div class="text-lg font-bold" :class="monthlyEst >= 0 ? 'text-success' : 'text-error'">{{ monthlyEst >= 0 ? '+' : '' }}{{ formatVND(monthlyEst) }}</div>
        </div>
      </div>
      <div class="text-text-disabled text-[0.6875rem]">{{ t('recurring.activeCount', { n: items.filter(r => r.enabled).length }) }}</div>
    </div>

    <transition name="expand">
      <div v-if="showAdd" class="bg-bg-surface border-border-default mb-6 rounded-xl border p-5">
        <h3 class="mb-4 text-sm font-semibold">{{ t('recurring.addNew') }}</h3>
        <div class="flex flex-col gap-4">
          <div class="border-border-default flex overflow-hidden rounded-xl border">
            <button class="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all" :class="form.type === 'expense' ? 'bg-error/10 text-error' : 'bg-bg-surface text-text-tertiary hover:bg-bg-hover'" @click="form.type = 'expense'; form.category = 'food'"><ArrowDownRight :size="14" /> {{ t('addTx.expense') }}</button>
            <button class="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all" :class="form.type === 'income' ? 'bg-success/10 text-success' : 'bg-bg-surface text-text-tertiary hover:bg-bg-hover'" @click="form.type = 'income'; form.category = 'salary'"><ArrowUpRight :size="14" /> {{ t('addTx.income') }}</button>
          </div>
          <CurrencyInput v-model="form.amount" :placeholder="t('addTx.amount')" className="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none" />
          <div>
            <label class="text-text-secondary mb-2 block text-sm font-medium">{{ t('recurring.frequency') }}</label>
            <div class="grid grid-cols-4 gap-2">
              <button v-for="o in freqOpts" :key="o.key" class="flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs transition-all" :class="form.frequency === o.key ? 'border-accent bg-accent-subtle' : 'border-border-default bg-bg-surface hover:border-border-strong'" @click="form.frequency = o.key">
                <span>{{ o.icon }}</span><span>{{ t(`recurring.${o.key}`) }}</span>
              </button>
            </div>
          </div>
          <div>
            <label class="text-text-secondary mb-2 block text-sm font-medium">{{ t('addTx.category') }}</label>
            <div class="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
              <button v-for="c in cats" :key="c.key" class="flex flex-col items-center gap-1 rounded-lg border p-2 transition-all" :class="form.category === c.key ? 'border-accent bg-accent-subtle' : 'border-border-default bg-bg-surface hover:border-border-strong'" @click="form.category = c.key">
                <span class="text-sm">{{ c.icon }}</span><span class="text-text-secondary text-[0.625rem] truncate w-full text-center">{{ t(`categories.${c.key}`) }}</span>
              </button>
            </div>
          </div>
          <div>
            <label class="text-text-secondary mb-2 block text-sm font-medium">{{ t('addTx.wallet') }}</label>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="w in finance.cashWallets" :key="w.id" class="flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all" :class="form.walletId === w.id ? 'border-accent bg-accent-subtle' : 'border-border-default bg-bg-surface hover:border-border-strong'" @click="form.walletId = w.id">
                <div v-if="w.customLogoUrl" class="flex h-6 w-6 shrink-0 overflow-hidden rounded-[3px] bg-white border border-border-default/50 p-0.5"><img :src="w.customLogoUrl" class="h-full w-full object-contain" /></div>
                <div v-else-if="getWalletBrand(w.name)?.logoUrl" class="flex h-6 w-6 shrink-0 overflow-hidden rounded-[3px] bg-white border border-border-default/50 p-0.5"><img :src="getWalletBrand(w.name)!.logoUrl" class="h-full w-full object-contain" /></div>
                <span v-else class="text-sm">{{ w.icon }}</span>
                <span class="text-text-secondary w-full truncate text-center text-[0.625rem]">{{ w.name }}</span>
              </button>
            </div>
          </div>
          <input v-model="form.note" type="text" :placeholder="t('addTx.notePlaceholder')" class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none" />
          <div>
            <CustomDatePicker
              v-model="form.nextDate"
              :label="t('recurring.startDate')"
            />
          </div>
          <div class="flex gap-2">
            <button @click="showAdd = false" class="border-border-default text-text-secondary hover:bg-bg-hover flex-1 rounded-lg border py-2 text-sm transition-all">{{ t('common.cancel') }}</button>
            <button @click="add" :disabled="!valid" class="btn-primary flex-1 justify-center py-2 disabled:opacity-40">{{ t('common.add') }}</button>
          </div>
        </div>
      </div>
    </transition>

    <div class="space-y-3">
      <div v-if="!items.length" class="bg-bg-surface border-border-default flex flex-col items-center rounded-2xl border border-dashed py-12 text-center">
        <Repeat :size="48" class="text-text-disabled mb-4" />
        <h4 class="mb-2 text-lg font-semibold">{{ t('recurring.empty') }}</h4>
        <p class="text-text-tertiary mb-6 text-sm">{{ t('recurring.emptyHint') }}</p>
        <button @click="showAdd = true" class="btn-secondary"><Plus :size="16" /> {{ t('recurring.add') }}</button>
      </div>
      <div v-for="item in items" :key="item.id" class="bg-bg-surface border-border-default hover:border-border-strong flex items-center gap-4 rounded-xl border p-4 transition-all duration-150" :class="{ 'opacity-50': !item.enabled }">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg" :style="{ backgroundColor: getCategoryConfig(item.category).color + '15' }">{{ getCategoryConfig(item.category).icon }}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2"><span class="text-sm font-semibold truncate">{{ item.note || t(`categories.${item.category}`) }}</span><span class="text-[0.625rem] font-bold px-1.5 py-px rounded bg-bg-elevated text-text-tertiary">{{ t(`recurring.${item.frequency}`) }}</span></div>
          <div class="text-text-disabled flex items-center gap-2 text-[0.6875rem] mt-0.5"><span class="flex items-center gap-1"><Clock :size="10" /> {{ t('recurring.next') }}: {{ fmtDate(item.nextDate) }}</span><span>·</span><span>{{ finance.getWalletName(item.walletId) }}</span></div>
        </div>
        <div class="text-sm font-bold whitespace-nowrap" :class="item.type === 'income' ? 'text-success' : 'text-error'">{{ item.type === 'income' ? '+' : '-' }}{{ formatVND(item.amount) }}</div>
        <div class="flex items-center gap-1">
          <button @click="toggle(item.id)" class="text-text-tertiary hover:text-accent p-1.5 rounded-lg hover:bg-bg-hover transition-all touch-target"><ToggleRight v-if="item.enabled" :size="20" class="text-accent" /><ToggleLeft v-else :size="20" /></button>
          <button @click="del(item.id)" class="text-text-tertiary hover:text-error p-1.5 rounded-lg hover:bg-bg-hover transition-all touch-target"><Trash2 :size="16" /></button>
        </div>
      </div>
    </div>
  </div>
</template>

