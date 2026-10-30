<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEventListener } from '@/composables/useEventListener'
import { useRouter } from 'vue-router'
import { useFinancePolling } from '@/composables/useFinancePolling'
import { useUiStore } from '@/stores/ui'
import { formatVND, getCategoryConfig } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'
import { useI18n } from 'vue-i18n'
import type { Transaction } from '@/types'
import {
  Plus,
  ChevronDown,
  Check,
  Wallet,
  Download,
  Trash2
} from 'lucide-vue-next'

import TransactionTable from '@/components/finance/TransactionTable.vue'
import ClearTransactionsModal from '@/components/finance/ClearTransactionsModal.vue'
import { useExportCsv } from '@/composables/useExportCsv'
import { onMounted, watch } from 'vue'

const { t, tm } = useI18n()
const router = useRouter()
const finance = useFinancePolling()
const ui = useUiStore()
const { exportTransactions } = useExportCsv()

const showClearModal = ref(false)

const isExporting = ref(false)
async function doExport() {
  if (finance.totalTransactions === 0) return
  isExporting.value = true
  try {
    const data = await finance.getExportTransactions()
    exportTransactions(data)
  } finally {
    isExporting.value = false
  }
}

// Fetch initial page
onMounted(() => {
  finance.fetchPaginatedTransactions()
})

// Watch filter changes to reset page and fetch
watch(() => finance.filter, () => {
  finance.pagination.page = 1
  finance.fetchPaginatedTransactions()
}, { deep: true })

function handlePageChange(page: number) {
  finance.pagination.page = page
  finance.fetchPaginatedTransactions()
}

const AUTO_SOURCES: Transaction['source'][] = ['sms', 'notification', 'telegram']

async function deleteTx(tx: Transaction) {
  // Auto-sourced transactions require PIN to prevent accidental/unauthorized deletion
  if (AUTO_SOURCES.includes(tx.source)) {
    const pinOk = await ui.requestPinValidation(
      t('transactions.pinDeleteTitle'),
      t('transactions.pinDeleteMessage', { source: tx.source.toUpperCase() })
    )
    if (!pinOk) return
  } else {
    // Manual transactions only need regular confirm
    const confirmed = await ui.requestConfirm({
      title: t('transactions.deleteTitle'),
      message: t('transactions.deleteMessage'),
      danger: true,
      confirmText: t('transactions.deleteConfirm')
    })
    if (!confirmed) return
  }

  finance.deleteTransaction(tx.id)
}

// Custom wallet dropdown
const walletDropdownOpen = ref(false)
const walletDropdownRef = ref<HTMLElement | null>(null)

const selectedWallet = computed(() => {
  if (!finance.filter.walletId) return null
  return finance.wallets.find((w) => w.id === finance.filter.walletId) || null
})

function selectWallet(walletId: string | undefined) {
  finance.filter = { ...finance.filter, walletId }
  walletDropdownOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (walletDropdownRef.value && !walletDropdownRef.value.contains(e.target as Node)) {
    walletDropdownOpen.value = false
  }
}

// Auto-cleanup click-outside listener via composable
useEventListener(document, 'click', handleClickOutside)
</script>

<template>
  <div class="mx-auto max-w-[68rem]">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('transactions.title') }}</h1>
        <p class="text-text-tertiary mt-1 text-sm">
          {{ t('transactions.count', { n: finance.totalTransactions }) }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="showClearModal = true"
          class="btn-secondary text-error"
          :title="t('transactions.clearData')"
        >
          <Trash2 :size="16" />
          <span class="hidden sm:inline">{{ t('transactions.clearData') }}</span>
        </button>
        <button
          @click="doExport"
          class="btn-secondary"
          :disabled="finance.totalTransactions === 0 || isExporting"
        >
          <Download v-if="!isExporting" :size="16" />
          <AppSpinner v-else :size="16" />
          <span class="hidden sm:inline">{{ isExporting ? t('common.loading') : t('transactions.export') }}</span>
        </button>
        <button
          @click="router.push('/transactions/add')"
          class="btn-primary"
        >
          <Plus :size="16" />
          {{ t('transactions.add') }}
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="mb-6 flex flex-wrap gap-2">
      <!-- Type filter -->
      <div class="border-border-default flex overflow-hidden rounded-lg border">
        <button
          v-for="f in [
            { key: 'all', labelKey: 'transactions.filterAll' },
            { key: 'expense', labelKey: 'transactions.filterExpense' },
            { key: 'income', labelKey: 'transactions.filterIncome' }
          ]"
          :key="f.key"
          class="bg-bg-surface border-border-default border-r px-3 py-1.5 text-sm transition-all duration-150 last:border-r-0"
          :class="
            (finance.filter.type || 'all') === f.key
              ? 'bg-accent-subtle text-accent'
              : 'text-text-secondary hover:bg-bg-hover'
          "
          @click="finance.filter = { ...finance.filter, type: f.key as any }"
        >
          {{ t(f.labelKey) }}
        </button>
      </div>

      <!-- Wallet filter (custom dropdown) -->
      <div ref="walletDropdownRef" class="relative">
        <button
          @click="walletDropdownOpen = !walletDropdownOpen"
          class="border-border-default bg-bg-surface hover:border-border-strong flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all duration-150"
          :class="walletDropdownOpen ? 'border-accent ring-accent-subtle ring-2' : ''"
        >
          <span v-if="selectedWallet" class="flex items-center gap-1.5">
            <template v-if="getWalletBrand(selectedWallet.name)">
              <div v-if="selectedWallet.customLogoUrl" class="flex h-4 w-4 shrink-0 overflow-hidden rounded-[3px] bg-white border border-border-default/50 p-0.5">
                <img :src="selectedWallet.customLogoUrl" class="h-full w-full object-contain object-center" />
              </div>
              <div v-else-if="getWalletBrand(selectedWallet.name)?.logoUrl" class="flex h-4 w-4 shrink-0 overflow-hidden rounded-[3px] bg-white border border-border-default/50 p-0.5">
                <img
                  :src="getWalletBrand(selectedWallet.name)!.logoUrl"
                  class="h-full w-full object-contain object-center"
                />
              </div>
              <span v-else class="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold"
                :style="{ backgroundColor: getWalletBrand(selectedWallet.name)!.bgColor, color: getWalletBrand(selectedWallet.name)!.textColor }"
              >
                {{ getWalletBrand(selectedWallet.name)!.abbr }}
              </span>
            </template>
            <template v-else-if="selectedWallet.customLogoUrl">
              <div class="flex h-4 w-4 shrink-0 overflow-hidden rounded-[3px] bg-white border border-border-default/50 p-0.5">
                <img :src="selectedWallet.customLogoUrl" class="h-full w-full object-contain object-center" />
              </div>
            </template>
            <span v-else class="text-sm font-emoji">{{ selectedWallet.icon }}</span>
            <span class="text-text-primary">{{ selectedWallet.name }}</span>
          </span>
          <span v-else class="text-text-secondary flex items-center gap-1.5">
            <Wallet :size="14" />
            <span>{{ t('transactions.allWallets') }}</span>
          </span>
          <ChevronDown
            :size="14"
            class="text-text-tertiary ml-1 transition-transform duration-200"
            :class="walletDropdownOpen ? 'rotate-180' : ''"
          />
        </button>

        <!-- Dropdown panel -->
        <transition name="dropdown">
          <div
            v-if="walletDropdownOpen"
            class="bg-bg-surface border-border-default absolute top-full left-0 z-50 mt-1.5 min-w-[12rem] max-h-[16rem] overflow-y-auto overflow-x-hidden rounded-xl border shadow-lg"
          >
            <!-- All wallets option -->
            <button
              @click="selectWallet(undefined)"
              class="hover:bg-bg-hover flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors duration-100"
              :class="!finance.filter.walletId ? 'bg-accent-subtle' : ''"
            >
              <span
                class="flex h-7 w-7 items-center justify-center rounded-lg"
                :class="!finance.filter.walletId ? 'bg-accent/15' : 'bg-bg-elevated'"
              >
                <Wallet :size="14" :class="!finance.filter.walletId ? 'text-accent' : 'text-text-tertiary'" />
              </span>
              <span :class="!finance.filter.walletId ? 'text-accent font-medium' : 'text-text-secondary'">{{ t('transactions.allWallets') }}</span>
              <Check
                v-if="!finance.filter.walletId"
                :size="14"
                class="text-accent ml-auto"
              />
            </button>

            <!-- Divider -->
            <div class="border-border-subtle mx-2 border-t"></div>

            <!-- Wallet options -->
            <button
              v-for="w in finance.wallets"
              :key="w.id"
              @click="selectWallet(w.id)"
              class="hover:bg-bg-hover flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors duration-100"
              :class="finance.filter.walletId === w.id ? 'bg-accent-subtle' : ''"
            >
              <span v-if="getWalletBrand(w.name)" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm bg-bg-elevated overflow-hidden border border-border-default">
                <div v-if="w.customLogoUrl" class="flex h-full w-full bg-white p-1">
                  <img
                    :src="w.customLogoUrl"
                    class="h-full w-full object-contain object-center"
                  />
                </div>
                <div v-else-if="getWalletBrand(w.name)?.logoUrl" class="flex h-full w-full bg-white p-1">
                  <img
                    :src="getWalletBrand(w.name)!.logoUrl"
                    class="h-full w-full object-contain object-center"
                  />
                </div>
                <span v-else class="flex h-full w-full items-center justify-center font-bold text-[10px]"
                  :style="{ backgroundColor: getWalletBrand(w.name)!.bgColor, color: getWalletBrand(w.name)!.textColor }"
                >
                  {{ getWalletBrand(w.name)!.abbr }}
                </span>
              </span>
              <span v-else-if="w.customLogoUrl" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm bg-bg-elevated overflow-hidden border border-border-default">
                <div class="flex h-full w-full bg-white p-1">
                  <img :src="w.customLogoUrl" class="h-full w-full object-contain object-center" />
                </div>
              </span>
              <span v-else
                class="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
                :class="finance.filter.walletId === w.id ? 'bg-accent/15' : 'bg-bg-elevated'"
              >
                {{ w.icon }}
              </span>
              <span :class="finance.filter.walletId === w.id ? 'text-accent font-medium' : 'text-text-secondary'">{{ w.name }}</span>
              <Check
                v-if="finance.filter.walletId === w.id"
                :size="14"
                class="text-accent ml-auto"
              />
            </button>
          </div>
        </transition>
      </div>
    </div>

    <!-- Transaction Table Component -->
    <TransactionTable
      :transactions="finance.paginatedTransactions"
      :total="finance.totalTransactions"
      :current-page="finance.pagination.page"
      :page-size="finance.pagination.limit"
      :loading="finance.loading"
      @delete="deleteTx"
      @add="router.push('/transactions/add')"
      @update:page="handlePageChange"
    />

    <ClearTransactionsModal
      v-if="showClearModal"
      @close="showClearModal = false"
      @cleared="showClearModal = false"
    />
  </div>
</template>

<style>
.dropdown-enter-active {
  transition: opacity 150ms ease, transform 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-leave-active {
  transition: opacity 100ms ease, transform 100ms ease;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-0.375rem) scale(0.97);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem) scale(0.98);
}
</style>
