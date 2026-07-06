<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSavingsStore } from '@/stores/savings'
import { useFinanceStore } from '@/stores/finance'
import { formatVND } from '@/constants/finance'
import { Target, Zap, ArrowRight, PartyPopper } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const savingsStore = useSavingsStore()
const router = useRouter()
const financeStore = useFinanceStore()
const loading = ref(false)

onMounted(async () => {
  if (savingsStore.goals.length === 0) {
    await savingsStore.fetch()
  }
})

// Find an active savings goal that is not fully funded
const suggestedGoal = computed(() => {
  return savingsStore.goals.find(g => g.currentAmount < g.targetAmount && g.autoSaveEnabled) || 
         savingsStore.goals.find(g => g.currentAmount < g.targetAmount)
})

async function quickSave() {
  if (!suggestedGoal.value) return
  const g = suggestedGoal.value
  const amount = g.autoSaveAmount || 0
  const walletId = g.autoSaveWalletId || financeStore.wallets[0]?.id
  
  if (!walletId || amount <= 0) return // Need a wallet and positive amount

  loading.value = true
  try {
    await savingsStore.deposit(g.id, amount, walletId)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="suggestedGoal" class="bg-gradient-to-r from-accent/10 to-accent-subtle/30 border border-accent/20 rounded-2xl p-5 mb-6 relative overflow-hidden group">
    <div class="absolute -right-6 -top-6 text-accent/10 group-hover:scale-110 transition-transform duration-500">
      <Target :size="120" />
    </div>
    
    <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="h-12 w-12 rounded-xl bg-white dark:bg-bg-elevated flex items-center justify-center text-2xl shadow-sm border border-border-default">
          {{ suggestedGoal.icon }}
        </div>
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-bold text-text-primary">{{ suggestedGoal.name }}</h3>
            <span v-if="suggestedGoal.autoSaveEnabled" class="bg-accent/10 text-accent text-[0.625rem] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Zap :size="10" /> Auto-Save
            </span>
          </div>
          <div class="text-sm text-text-secondary">
            {{ t('savings.targetLabel') }}: <span class="font-semibold text-text-primary">{{ formatVND(suggestedGoal.targetAmount) }}</span>
            <span class="mx-2 text-text-tertiary">•</span>
            {{ t('savings.achievedLabel') }}: <span class="font-semibold text-success">{{ formatVND(suggestedGoal.currentAmount) }}</span>
          </div>
          
          <div class="w-full max-w-xs bg-bg-surface/50 h-1.5 mt-2 rounded-full overflow-hidden">
            <div class="h-full bg-accent rounded-full transition-all duration-1000" :style="{ width: Math.min((suggestedGoal.currentAmount / suggestedGoal.targetAmount) * 100, 100) + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <button 
          v-if="suggestedGoal.autoSaveEnabled && suggestedGoal.autoSaveAmount"
          @click="quickSave"
          :disabled="loading"
          class="btn-primary py-2 px-4 whitespace-nowrap shadow-md shadow-accent/20 flex items-center gap-2"
        >
          <Zap :size="16" />
          {{ t('savings.autoSaveExtractBtn', { amount: formatVND(suggestedGoal.autoSaveAmount) }) }}
        </button>
        <button 
          v-else
          @click="router.push('/savings')" 
          class="bg-white dark:bg-bg-elevated border border-border-default hover:border-accent text-text-primary py-2 px-4 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap"
        >
          {{ t('savings.autoSaveEnable') }}
        </button>
        <button @click="router.push('/savings')" class="p-2 text-text-tertiary hover:text-text-primary hover:bg-white dark:hover:bg-bg-elevated rounded-lg transition-all border border-transparent hover:border-border-default">
          <ArrowRight :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>
