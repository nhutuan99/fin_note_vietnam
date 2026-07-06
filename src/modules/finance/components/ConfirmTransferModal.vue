<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { X, ArrowRightLeft, Check, ArrowLeft } from 'lucide-vue-next'
import type { PendingTransfer } from '@/types'

const { t } = useI18n()
const financeStore = useFinanceStore()
const uiStore = useUiStore()

const props = defineProps<{
  transfer: PendingTransfer
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'resolved'): void
}>()

const step = ref(1)
const selectedTargetWalletId = ref('')
const confirmAmount = ref(props.transfer.amount)
const disableFuture = ref(false)
const isResolving = ref(false)

const otherWallets = computed(() => {
  return financeStore.wallets.filter(w => w.id !== props.transfer.walletId)
})

function formatMoney(amount: number) {
  return amount.toLocaleString('vi-VN') + 'đ'
}

async function handleConfirmTransfer() {
  if (!selectedTargetWalletId.value) {
    uiStore.showToast('error', t('transfer.selectTargetWallet'))
    return
  }
  isResolving.value = true
  try {
    await financeStore.resolvePendingTransfer(
      props.transfer.id,
      true,
      selectedTargetWalletId.value,
      confirmAmount.value,
      disableFuture.value
    )
    uiStore.showToast('success', t('transfer.internalTransferSuccess'))
    emit('resolved')
    emit('close')
  } catch (error) {
    uiStore.showToast('error', t('transfer.recordError'))
  } finally {
    isResolving.value = false
  }
}

async function handleConfirmExpense() {
  isResolving.value = true
  try {
    await financeStore.resolvePendingTransfer(
      props.transfer.id,
      false,
      undefined,
      undefined,
      disableFuture.value
    )
    uiStore.showToast('success', t('transfer.confirmedAsExpense'))
    emit('resolved')
    emit('close')
  } catch (error) {
    uiStore.showToast('error', t('transfer.recordError'))
  } finally {
    isResolving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

      <div
        class="relative z-10 w-full sm:max-w-md bg-bg-surface rounded-t-2xl sm:rounded-2xl border border-border-default shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
            <ArrowRightLeft :size="16" class="text-warning" />
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-bold text-text-primary">
              {{ t('transfer.confirmLargeTitle') }}
            </h2>
            <p class="text-[11px] text-text-tertiary">
              {{ t('transfer.largeTransactionDetected') }}
            </p>
          </div>
          <button
            @click="emit('close')"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
          >
            <X :size="16" />
          </button>
        </div>

        <!-- Body: Step 1 -->
        <div v-if="step === 1" class="p-5 space-y-4">
          <div class="bg-bg-elevated border border-border-default rounded-xl p-4 space-y-2">
            <div class="flex justify-between items-baseline">
              <span class="text-xs text-text-tertiary">{{ t('transfer.amountSent') }}</span>
              <span class="text-lg font-bold text-error">-{{ formatMoney(transfer.amount) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-xs text-text-tertiary">{{ t('transfer.fromWallet') }}</span>
              <span class="text-xs font-semibold text-text-primary">{{ transfer.walletName }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-xs text-text-tertiary">{{ t('transfer.content') }}</span>
              <span class="text-xs text-text-secondary text-right truncate max-w-[200px]">{{ transfer.note }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-xs text-text-tertiary">{{ t('transfer.date') }}</span>
              <span class="text-xs text-text-secondary">{{ transfer.date }}</span>
            </div>
          </div>

          <div class="space-y-1 text-center">
            <p class="text-sm font-bold text-text-primary">
              {{ t('transfer.isInternalQuestion') }}
            </p>
            <p class="text-xs text-text-tertiary leading-relaxed">
              {{ t('transfer.isInternalHint') }}
            </p>
          </div>

          <!-- Future Setting Opt-out -->
          <label class="flex items-start gap-2.5 cursor-pointer rounded-lg hover:bg-bg-hover p-2 transition-colors">
            <input
              type="checkbox"
              v-model="disableFuture"
              class="mt-0.5 rounded border-border-strong text-accent focus:ring-accent-subtle"
            />
            <span class="text-xs text-text-secondary leading-tight">
              {{ t('transfer.disableFutureHint') }}
            </span>
          </label>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-2 pt-2">
            <button
              @click="step = 2"
              class="w-full btn-primary justify-center py-2.5"
            >
              <Check :size="15" />
              <span>{{ t('transfer.yesInternal') }}</span>
            </button>
            <button
              @click="handleConfirmExpense"
              :disabled="isResolving"
              class="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border-default py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
            >
              <span v-if="isResolving" class="inline-block h-3.5 w-3.5 rounded-full border-2 border-text-secondary/30 border-t-text-secondary animate-spin" />
              <template v-else>
                <span>{{ t('transfer.noItIsExpense') }}</span>
              </template>
            </button>
          </div>
        </div>

        <!-- Body: Step 2 -->
        <div v-else-if="step === 2" class="p-5 space-y-4">
          <button
            @click="step = 1"
            class="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-text transition-colors"
          >
            <ArrowLeft :size="12" />
            <span>{{ t('common.back') }}</span>
          </button>

          <div class="space-y-3">
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-text-secondary">{{ t('transfer.sourceWallet') }}</label>
              <div class="w-full rounded-xl border border-border-default bg-bg-elevated px-3.5 py-2.5 text-sm text-text-primary font-medium">
                {{ transfer.walletName }}
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-text-secondary">{{ t('transfer.targetWallet') }}</label>
              <select
                v-model="selectedTargetWalletId"
                class="w-full rounded-xl border border-border-default bg-bg-elevated px-3.5 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              >
                <option value="" disabled selected>{{ t('transfer.selectWalletPlaceholder') }}</option>
                <option v-for="w in otherWallets" :key="w.id" :value="w.id">
                  {{ w.icon }} {{ w.name }} ({{ t('transfer.balance') }}: {{ formatMoney(w.balance) }})
                </option>
              </select>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-text-secondary">{{ t('transfer.transferAmount') }}</label>
              <div class="relative">
                <input
                  v-model.number="confirmAmount"
                  type="number"
                  class="w-full rounded-xl border border-border-default bg-bg-elevated pl-3.5 pr-12 py-2.5 text-sm text-text-primary font-bold focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
                />
                <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-tertiary">VND</span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="pt-2">
            <button
              @click="handleConfirmTransfer"
              :disabled="isResolving || !selectedTargetWalletId"
              class="w-full btn-primary justify-center py-2.5 disabled:opacity-40"
            >
              <span v-if="isResolving" class="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <template v-else>
                <Check :size="15" />
                <span>{{ t('transfer.confirmAndFinish') }}</span>
              </template>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Modal fade animations */
.fixed {
  animation: fadeIn 0.15s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.relative {
  animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideUp {
  from { transform: translateY(30px); }
  to { transform: translateY(0); }
}
</style>
