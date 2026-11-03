<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowUpRight, ArrowDownRight, ArrowRight, Plus, Wallet } from 'lucide-vue-next'
import { useFinancePolling } from '@/composables/useFinancePolling'
import { formatVNDShort, formatVND, getCategoryConfig } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'

import DailyTrendCard from './DailyTrendCard.vue'
import CategoryBreakdownCard from './CategoryBreakdownCard.vue'

const { t } = useI18n()
const router = useRouter()
const finance = useFinancePolling()

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('time.justNow')
  if (m < 60) return t('time.minutesAgo', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('time.hoursAgo', { n: h })
  return t('time.daysAgo', { n: Math.floor(h / 24) })
}

// ── Expense by Wallet ──
interface WalletStat {
  walletId: string
  name: string
  total: number
  percentage: number
  color: string
  logoUrl: string
}

const expenseByWallet = computed<WalletStat[]>(() => {
  return finance.stats.expenseByWallet.map(stat => {
    const walletName = finance.getWalletName(stat.walletId)
    const brand = getWalletBrand(walletName)
    const wallet = finance.wallets.find((w: any) => w.id === stat.walletId)
    return {
      ...stat,
      name: walletName,
      color: brand?.bgColor && brand.bgColor !== '#ffffff' ? brand.bgColor : (wallet?.color || '#6366f1'),
      logoUrl: wallet?.customLogoUrl || brand?.logoUrl || ''
    }
  })
})

const incomeByWallet = computed<WalletStat[]>(() => {
  return finance.stats.incomeByWallet.map(stat => {
    const walletName = finance.getWalletName(stat.walletId)
    const brand = getWalletBrand(walletName)
    const wallet = finance.wallets.find((w: any) => w.id === stat.walletId)
    return {
      ...stat,
      name: walletName,
      color: brand?.bgColor && brand.bgColor !== '#ffffff' ? brand.bgColor : (wallet?.color || '#10b981'),
      logoUrl: wallet?.customLogoUrl || brand?.logoUrl || ''
    }
  })
})

// Spending is what people check most: open on it
const walletBreakdownTab = ref<'expense' | 'income'>('expense')
const activeWalletStats = computed(() => walletBreakdownTab.value === 'expense' ? expenseByWallet.value : incomeByWallet.value)
</script>
<template>
    <!-- Trend (daily / cumulative vs last month) + where the money went -->
    <div class="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
      <DailyTrendCard class="xl:col-span-3" />
      <CategoryBreakdownCard class="xl:col-span-2" />
    </div>

    <div class="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <!-- Spending by Wallet -->
      <div class="bg-bg-surface border-border-default rounded-xl border p-5">
        <!-- Header with tabs -->
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold">{{ t('dashboard.walletBreakdown') }}</h3>
          <div class="flex items-center gap-1 rounded-lg bg-bg-elevated p-0.5">
            <button
              class="rounded-md px-2.5 py-1 text-[0.6875rem] font-medium transition-all"
              :class="walletBreakdownTab === 'expense' ? 'bg-bg-surface text-error shadow-sm' : 'text-text-tertiary hover:text-text-secondary'"
              @click="walletBreakdownTab = 'expense'"
            >{{ t('dashboard.expense') }}</button>
            <button
              class="rounded-md px-2.5 py-1 text-[0.6875rem] font-medium transition-all"
              :class="walletBreakdownTab === 'income' ? 'bg-bg-surface text-success shadow-sm' : 'text-text-tertiary hover:text-text-secondary'"
              @click="walletBreakdownTab = 'income'"
            >{{ t('dashboard.income') }}</button>
          </div>
        </div>

        <div v-if="activeWalletStats.length" class="space-y-3">
          <div
            v-for="ws in activeWalletStats"
            :key="ws.walletId"
            class="group cursor-pointer"
            @click="finance.filter = { walletId: ws.walletId }; router.push('/transactions')"
          >
            <div class="flex items-center gap-3 mb-1.5">
              <!-- Wallet logo -->
              <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white shadow-sm">
                <img
                  v-if="ws.logoUrl"
                  :src="ws.logoUrl"
                  :alt="ws.name"
                  class="h-5 w-5 object-contain"
                  loading="lazy"
                />
                <span v-else class="text-[9px] font-bold" :style="{ color: ws.color }">{{ ws.name.substring(0, 2).toUpperCase() }}</span>
              </div>
              <!-- Name + Amount -->
              <span class="text-text-secondary text-[0.8125rem] font-medium group-hover:text-text-primary transition-colors truncate">{{ ws.name }}</span>
              <span class="text-text-primary ml-auto text-[0.8125rem] font-bold tabular-nums whitespace-nowrap">{{ formatVNDShort(ws.total) }}</span>
              <span class="text-text-disabled text-[0.6875rem] w-[2.5rem] text-right tabular-nums">{{ ws.percentage.toFixed(0) }}%</span>
            </div>
            <!-- Progress bar -->
            <div class="bg-bg-elevated h-1.5 overflow-hidden rounded-full">
              <div
                class="h-full origin-left rounded-full transition-transform duration-500"
                :style="{ transform: `scaleX(${ws.percentage / 100})`, backgroundColor: walletBreakdownTab === 'expense' ? 'var(--error)' : 'var(--success)' }"
              ></div>
            </div>
          </div>
        </div>

        <div v-else class="text-text-disabled flex h-[9.5rem] items-center justify-center text-sm">
          {{ t('dashboard.noDataThisMonth') }}
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="bg-bg-surface border-border-default rounded-xl border p-5">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-semibold">{{ t('dashboard.recentTransactions') }}</h3>
        <router-link
          to="/transactions"
          class="text-accent hover:text-accent-text flex items-center gap-1 text-sm transition-colors"
        >
          {{ t('dashboard.viewAll') }}
          <ArrowRight :size="14" />
        </router-link>
      </div>

      <div
        v-if="finance.recentTransactions.length"
        class="divide-border-subtle -mx-2 divide-y"
      >
        <div
          v-for="tx in finance.recentTransactions.slice(0, 5)"
          :key="tx.id"
          class="hover:bg-bg-hover flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors cursor-pointer"
          @click="router.push('/transactions')"
        >
          <!-- Wallet Logo / Category Icon -->
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden border border-border-default/30"
            :style="{ backgroundColor: (finance.wallets.find(w => w.id === tx.walletId)?.customLogoUrl || getWalletBrand(finance.getWalletName(tx.walletId))?.logoUrl) ? '#fff' : getCategoryConfig(tx.category).color + '12' }"
          >
            <img
              v-if="finance.wallets.find(w => w.id === tx.walletId)?.customLogoUrl"
              :src="finance.wallets.find(w => w.id === tx.walletId)!.customLogoUrl"
              :alt="finance.getWalletName(tx.walletId)"
              class="h-6 w-6 object-contain"
              loading="lazy"
            />
            <img
              v-else-if="getWalletBrand(finance.getWalletName(tx.walletId))?.logoUrl"
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
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-text-primary truncate">
                {{ t(`categories.${tx.category}`) }}
              </span>
              <span
                v-if="tx.source && tx.source !== 'manual'"
                class="inline-flex items-center text-[0.625rem] font-bold px-1.5 py-px rounded shrink-0"
                :class="{
                  'bg-success/10 text-success': tx.source === 'sms',
                  'bg-info/10 text-info': tx.source === 'telegram',
                  'bg-warning/10 text-warning': tx.source === 'notification' || tx.source === 'routine'
                }"
              >
                {{ tx.source === 'sms' ? 'SMS' : tx.source === 'telegram' ? 'TG' : tx.source === 'routine' ? 'Routine' : 'Auto' }}
              </span>
            </div>
            <div class="text-text-disabled flex items-center gap-1.5 text-[0.6875rem] mt-0.5">
              <span>{{ finance.getWalletName(tx.walletId) }}</span>
              <span class="opacity-40">·</span>
              <span>{{ timeSince(tx.createdAt) }}</span>
            </div>
          </div>
          <div
            class="text-[0.8125rem] font-bold whitespace-nowrap tabular-nums"
            :class="tx.type === 'income' ? 'text-success' : 'text-error'"
          >
            <span class="flex items-center gap-0.5">
              <ArrowUpRight v-if="tx.type === 'income'" :size="14" />
              <ArrowDownRight v-else :size="14" />
              {{ formatVND(tx.amount) }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-else
        class="flex flex-col items-center py-8 text-center"
      >
        <Wallet
          :size="48"
          class="text-text-disabled mb-4"
        />
        <h4 class="mb-2 text-lg font-semibold">{{ t('dashboard.noTransactions') }}</h4>
        <p class="text-text-tertiary mb-6 text-sm">
          {{ t('dashboard.noTransactionsHint') }}
        </p>
        <button
          @click="router.push('/transactions/add')"
          class="btn-secondary"
        >
          <Plus :size="16" />
          {{ t('dashboard.addTransaction') }}
        </button>
      </div>
    </div>
    </div>
</template>

