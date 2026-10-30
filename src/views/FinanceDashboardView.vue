<script setup lang="ts">
// 1. Vue ecosystem
import { useI18n } from 'vue-i18n'
import { onMounted, computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useStockStore } from '@/stores/stock'
import { useFundStore } from '@/stores/fund'
import { useFinanceStore } from '@/stores/finance'

// 3. Finance module components
import FinanceOverview from '@/modules/finance/components/FinanceOverview.vue'
import FinanceWallets from '@/modules/finance/components/FinanceWallets.vue'
import FinanceCharts from '@/modules/finance/components/FinanceCharts.vue'
import HomeRemindersWidget from '@/modules/finance/components/HomeRemindersWidget.vue'
import HomeNotesWidget from '@/modules/finance/components/HomeNotesWidget.vue'
import HomeSavingsWidget from '@/modules/finance/components/HomeSavingsWidget.vue'
import ConfirmTransferModal from '@/modules/finance/components/ConfirmTransferModal.vue'

const auth = useAuthStore()
const ui = useUiStore()
const stockStore = useStockStore()
const fundStore = useFundStore()
const financeStore = useFinanceStore()

const dismissed = ref(false)

onMounted(() => {
  if (auth.isAuthenticated) {
    financeStore.fetchPendingTransfers()
  }
  if (auth.isAuthenticated && ui.enableStocks) {
    // If user has stock module enabled, fetch positions directly on home page
    // so total balance dynamically includes investments.
    stockStore.fetchPositions(true)
    fundStore.fetchPositions(true)
  }
})

const activeTransfer = computed(() => {
  if (dismissed.value) return null
  return financeStore.pendingTransfers.length > 0 ? financeStore.pendingTransfers[0] : null
})
</script>

<template>
  <div class="w-full max-w-[90rem] mx-auto">
    <!-- Balance + Income/Expense + Weather Hero -->
    <FinanceOverview />

    <!-- Wallet scrollable row -->
    <FinanceWallets />

    <!-- Smart Auto-Save Widget -->
    <HomeSavingsWidget />

    <!-- 7-day chart + Spending by wallet -->
    <FinanceCharts />

    <!-- ── Quick Glance Hub: Reminders + Notes ── -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <HomeRemindersWidget />
      <HomeNotesWidget />
    </div>

    <!-- Confirm Transfer Modal for Large Transactions -->
    <ConfirmTransferModal
      v-if="activeTransfer"
      :transfer="activeTransfer"
      @close="dismissed = true"
      @resolved="dismissed = false"
    />
  </div>
</template>
