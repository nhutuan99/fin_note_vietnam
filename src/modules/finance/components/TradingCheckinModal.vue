<script setup lang="ts">
// 1. Vue core
import { ref, computed, watch } from 'vue'
// 2. Vue ecosystem
import { useI18n } from 'vue-i18n'
// 3. Stores & composables
import { useTradingCheckin } from '@/composables/useTradingCheckin'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
// 4. Types
import type { TradingCheckinEntry } from '@/types'
// 5. Utils
import { getWalletBrand } from '@/constants/walletBrands'
// 6. Components & icons
import CurrencyInput from '@/components/ui/CurrencyInput.vue'
import { X, TrendingUp, TrendingDown, DollarSign, Percent, Check, ChevronRight, BookOpen } from 'lucide-vue-next'
import { useCurrency } from '@/composables/useCurrency'

const { exchangeRate, currency: globalCurrency, rateLoading: usdRateLoading, rateError: usdRateError, fetchExchangeRate, formatMoney, formatMoneyShort } = useCurrency()
// exchangeRate = 1 VND in USD → 1 USD in VND = 1/exchangeRate
const usdToVnd = computed(() => exchangeRate.value > 0 ? Math.round(1 / exchangeRate.value) : 0)

const { t } = useI18n()

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const ui = useUiStore()
const financeStore = useFinanceStore()
const { trading, finance, getSelectedWallets } = useTradingCheckin()

// ── Edit mode detection ──
// isEditMode = true when there's already a check-in for today
const isEditMode = computed(() => trading.hasDoneCheckinToday)

// ── Step management ──
type Step = 'setup' | 'input' | 'summary'
const step = ref<Step>('input')

watch(() => props.modelValue, (open) => {
  if (!open) return
  step.value = trading.hasWalletsConfigured ? 'input' : 'setup'
  pendingWalletIds.value = [...trading.config.selectedWalletIds]
}, { immediate: true })

// ── Step 1: Wallet setup ──
const pendingWalletIds = ref<string[]>([...trading.config.selectedWalletIds])
const isSavingConfig = ref(false)

function toggleWallet(id: string) {
  const idx = pendingWalletIds.value.indexOf(id)
  if (idx === -1) pendingWalletIds.value.push(id)
  else pendingWalletIds.value.splice(idx, 1)
}

async function confirmSetup() {
  if (pendingWalletIds.value.length === 0) {
    ui.showToast('warning', t('trading.walletRequired'))
    return
  }
  isSavingConfig.value = true
  await trading.saveConfig(pendingWalletIds.value)
  isSavingConfig.value = false
  step.value = 'input'
}

// ── Step 2: P&L input per wallet ──
interface EntryDraft {
  walletId: string
  walletName: string
  customLogoUrl: string
  inputMode: 'percent' | 'amount' | 'usd'
  inputValue: number
  depositAmount: number
  balanceBefore: number
}

const drafts = ref<EntryDraft[]>([])
const showDeposit = ref<boolean[]>([])
const walletStep = ref(0)
const sessionNote = ref('')

watch(
  [() => step.value, () => trading.config.selectedWalletIds, () => finance.wallets],
  ([s]) => {
    if (s !== 'input') return
    // Ensure exchange rate is available for USD mode
    fetchExchangeRate()
    const wallets = getSelectedWallets()
    const existing = trading.todayCheckin

    drafts.value = wallets.map((w) => {
      // Pre-fill from today's existing entry when in edit mode
      const prev = existing?.entries.find((e) => e.walletId === w.id)
      return {
        walletId: w.id,
        walletName: w.name,
        customLogoUrl: w.customLogoUrl ?? getWalletBrand(w.name)?.logoUrl ?? '',
        inputMode: prev?.inputMode ?? 'percent' as const,
        inputValue: prev?.inputValue ?? 0,
        depositAmount: prev?.depositAmount ?? 0,
        // Use balanceBefore from existing record when editing so P&L recalc is correct
        balanceBefore: prev?.balanceBefore ?? w.balance,
      }
    })

    // Reset deposit visibility and wallet step
    showDeposit.value = wallets.map(() => false)
    walletStep.value = 0

    // Pre-fill note
    sessionNote.value = existing?.note ?? ''
  },
  { immediate: true }
)

function calcPnl(d: EntryDraft): number {
  if (d.inputMode === 'percent') return Math.round(d.balanceBefore * (d.inputValue / 100))
  if (d.inputMode === 'usd') return Math.round(d.inputValue * usdToVnd.value)
  return d.inputValue
}

function calcBalanceAfter(d: EntryDraft): number {
  return d.balanceBefore + calcPnl(d) + d.depositAmount
}

const isLastWallet = computed(() => walletStep.value === drafts.value.length - 1)

function walletNext() {
  if (!isLastWallet.value) {
    walletStep.value++
    showDeposit.value[walletStep.value] = showDeposit.value[walletStep.value] ?? false
  } else {
    const hasInput = drafts.value.some((d) => d.inputValue !== 0 || d.depositAmount !== 0)
    if (!hasInput) {
      ui.showToast('warning', t('trading.inputRequired'))
      return
    }
    step.value = 'summary'
  }
}

function walletPrev() {
  if (walletStep.value > 0) {
    walletStep.value--
  } else {
    step.value = 'setup'
  }
}

// ── Step 3: Summary ──
const summaryEntries = computed<TradingCheckinEntry[]>(() =>
  drafts.value.map((d) => ({
    walletId: d.walletId,
    walletName: d.walletName,
    inputMode: d.inputMode,
    inputValue: d.inputValue,
    pnlAmount: calcPnl(d),
    depositAmount: d.depositAmount,
    balanceBefore: d.balanceBefore,
    balanceAfter: calcBalanceAfter(d),
  }))
)

const totalPnl = computed(() => summaryEntries.value.reduce((s, e) => s + e.pnlAmount, 0))
const totalDeposit = computed(() => summaryEntries.value.reduce((s, e) => s + e.depositAmount, 0))
const isSubmitting = ref(false)

async function submit() {
  isSubmitting.value = true
  let ok: boolean

  if (isEditMode.value && trading.todayCheckin) {
    ok = await trading.updateCheckin(trading.todayCheckin.date, summaryEntries.value, sessionNote.value)
  } else {
    ok = await trading.submitCheckin(summaryEntries.value, sessionNote.value)
  }

  isSubmitting.value = false

  if (ok) {
    // Eagerly update wallet balances to bypass KV eventual consistency
    summaryEntries.value.forEach(e => {
      const w = financeStore.wallets.find(w => w.id === e.walletId)
      if (w) {
        w.balance = e.balanceAfter
      }
    })

    // Refresh wallets from backend
    financeStore.fetchAll()
    ui.showToast('success', isEditMode.value ? t('trading.successUpdate') : t('trading.successCheckin'))
    emit('update:modelValue', false)
  } else {
    ui.showToast('error', isEditMode.value ? t('trading.errorUpdate') : t('trading.errorCheckin'))
  }
}

function getWalletLogo(name: string, customUrl?: string): string {
  if (customUrl) return customUrl
  return getWalletBrand(name)?.logoUrl ?? ''
}

function close() { emit('update:modelValue', false) }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        @click.self="close"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close" />

        <div
          class="relative z-10 w-full sm:max-w-lg bg-bg-surface rounded-t-2xl sm:rounded-2xl border border-border-default shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkin-modal-title"
        >
          <!-- Header -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-border-subtle shrink-0">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <BookOpen :size="16" class="text-accent" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 id="checkin-modal-title" class="text-sm font-bold text-text-primary">
                {{ t('trading.modalTitle') }}
                <span v-if="isEditMode" class="ml-1.5 text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">EDIT</span>
              </h2>
              <p class="text-[11px] text-text-tertiary">
                {{ step === 'setup' ? t('trading.stepSetup') : step === 'input' ? t('trading.stepInput') : t('trading.stepSummary') }}
              </p>
            </div>
            <!-- Step dots -->
            <div class="flex items-center gap-1 mr-2">
              <span
                v-for="s in ['setup', 'input', 'summary']"
                :key="s"
                class="h-1.5 rounded-full transition-all duration-300"
                :class="s === step ? 'w-4 bg-accent' : 'w-1.5 bg-border-strong'"
              />
            </div>
            <button
              @click="close"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
              :aria-label="t('common.close')"
            >
              <X :size="16" />
            </button>
          </div>

          <!-- Scrollable content -->
          <div class="flex-1 overflow-y-auto overscroll-contain">

            <!-- STEP 1: Wallet Setup -->
            <div v-if="step === 'setup'" class="p-5 space-y-3">
              <p class="text-xs text-text-secondary leading-relaxed">{{ t('trading.setupDesc') }}</p>

              <div v-if="finance.loading" class="space-y-2">
                <div v-for="i in 3" :key="i" class="skeleton h-14 rounded-xl" />
              </div>
              <div v-else-if="finance.wallets.length === 0" class="text-center py-8 text-text-tertiary text-sm">
                {{ t('trading.noWallets') }}
              </div>
              <div v-else class="space-y-2">
                <button
                  v-for="w in finance.wallets"
                  :key="w.id"
                  @click="toggleWallet(w.id)"
                  class="w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left"
                  :class="pendingWalletIds.includes(w.id)
                    ? 'border-accent bg-accent/5'
                    : 'border-border-default bg-bg-elevated hover:border-border-strong'"
                >
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white border border-border-default/30">
                    <img v-if="getWalletLogo(w.name, w.customLogoUrl)" :src="getWalletLogo(w.name, w.customLogoUrl)" :alt="w.name" class="h-6 w-6 object-contain" loading="lazy" />
                    <span v-else class="text-sm" :style="{ color: w.color }">{{ w.icon }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-text-primary truncate">{{ w.name }}</div>
                    <div class="text-[11px] text-text-tertiary">{{ formatMoney(w.balance) }}</div>
                  </div>
                  <div
                    class="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                    :class="pendingWalletIds.includes(w.id) ? 'border-accent bg-accent' : 'border-border-strong'"
                  >
                    <Check v-if="pendingWalletIds.includes(w.id)" :size="11" class="text-white" />
                  </div>
                </button>
              </div>
            </div>

            <!-- STEP 2: P&L Input (one wallet at a time) -->
            <div v-else-if="step === 'input'" class="p-5 space-y-4">
              <div v-if="trading.configLoading" class="space-y-3">
                <div v-for="i in 2" :key="i" class="skeleton h-28 rounded-xl" />
              </div>
              <div v-else-if="drafts.length === 0" class="text-center py-8 text-text-tertiary text-sm">
                {{ t('trading.noWalletsSelected') }}
              </div>

              <template v-else>
                <!-- Wallet progress dots -->
                <div v-if="drafts.length > 1" class="flex items-center justify-center gap-1.5">
                  <button
                    v-for="(d, i) in drafts" :key="d.walletId"
                    @click="walletStep = i; showDeposit[i] = showDeposit[i] ?? false"
                    class="h-1.5 rounded-full transition-all duration-300"
                    :class="i === walletStep ? 'w-6 bg-accent' : i < walletStep ? 'w-2 bg-accent/40' : 'w-2 bg-border-strong'"
                  />
                </div>

                <!-- Single wallet card -->
                <div class="rounded-xl border border-border-default bg-bg-elevated p-4 space-y-3">
                  <!-- Wallet header -->
                  <div class="flex items-center gap-2.5">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white border border-border-default/30">
                      <img v-if="getWalletLogo(drafts[walletStep].walletName, drafts[walletStep].customLogoUrl)" :src="getWalletLogo(drafts[walletStep].walletName, drafts[walletStep].customLogoUrl)" :alt="drafts[walletStep].walletName" class="h-5 w-5 object-contain" loading="lazy" />
                      <span v-else class="text-xs font-bold text-text-secondary">{{ drafts[walletStep].walletName.substring(0,2) }}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-bold text-text-primary">{{ drafts[walletStep].walletName }}</div>
                      <div class="text-[11px] text-text-disabled">{{ t('trading.balanceBefore', { amount: formatMoney(drafts[walletStep].balanceBefore) }) }}</div>
                    </div>
                    <!-- Live P&L preview -->
                    <div class="text-sm font-bold tabular-nums" :class="calcPnl(drafts[walletStep]) >= 0 ? 'text-success' : 'text-error'">
                      {{ calcPnl(drafts[walletStep]) >= 0 ? '+' : '' }}{{ formatMoney(calcPnl(drafts[walletStep])) }}
                    </div>
                  </div>

                  <!-- Input mode toggle -->
                  <div class="flex items-center gap-1 p-0.5 bg-bg-surface rounded-lg border border-border-default">
                    <button
                      @click="drafts[walletStep].inputMode = 'percent'; drafts[walletStep].inputValue = 0"
                      class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all"
                      :class="drafts[walletStep].inputMode === 'percent' ? 'bg-accent text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'"
                    >
                      <Percent :size="11" /> %
                    </button>
                    <button
                      @click="drafts[walletStep].inputMode = 'amount'; drafts[walletStep].inputValue = 0"
                      class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all"
                      :class="drafts[walletStep].inputMode === 'amount' ? 'bg-accent text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'"
                    >
                      <span class="text-[10px] font-bold">₫</span> VND
                    </button>
                    <button
                      @click="drafts[walletStep].inputMode = 'usd'; drafts[walletStep].inputValue = 0; fetchExchangeRate()"
                      class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all"
                      :class="drafts[walletStep].inputMode === 'usd' ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'"
                    >
                      <DollarSign :size="11" /> USD
                    </button>
                  </div>

                  <!-- P&L input -->
                  <div class="space-y-1">
                    <label class="text-[11px] text-text-tertiary font-medium">
                      {{ t('trading.pnlLabel') }} <span class="text-text-disabled">{{ t('trading.pnlHint') }}</span>
                    </label>
                    <div class="relative">
                      <input
                        v-if="drafts[walletStep].inputMode === 'percent'"
                        v-model.number="drafts[walletStep].inputValue"
                        type="number" step="0.01" placeholder="0.00"
                        class="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 pr-8 text-sm text-right focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
                      />
                      <input
                        v-else-if="drafts[walletStep].inputMode === 'usd'"
                        v-model.number="drafts[walletStep].inputValue"
                        type="number" step="0.01" placeholder="0.00"
                        class="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 pr-8 text-sm text-right focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                      />
                      <CurrencyInput
                        v-else
                        :modelValue="drafts[walletStep].inputValue"
                        @update:modelValue="drafts[walletStep].inputValue = $event"
                        :allowNegative="true"
                        :placeholder="'0'"
                        :className="'w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 pr-8 text-sm text-right focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors'"
                      />
                      <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                        :class="drafts[walletStep].inputMode === 'usd' ? 'text-emerald-400 font-medium' : 'text-text-disabled'"
                      >
                        {{ drafts[walletStep].inputMode === 'percent' ? '%' : drafts[walletStep].inputMode === 'usd' ? '$' : '₫' }}
                      </span>
                    </div>
                    <!-- USD live conversion hint -->
                    <div v-if="drafts[walletStep].inputMode === 'usd'" class="flex items-center text-[11px] px-1">
                      <span v-if="usdRateLoading" class="text-text-disabled italic">{{ t('trading.loadingRate') }}</span>
                      <template v-else-if="usdToVnd > 0">
                        <!-- If user is in VND mode → show VND equivalent -->
                        <span v-if="globalCurrency === 'VND'" class="text-emerald-400 font-medium">
                          ≈ {{ formatMoneyShort(calcPnl(drafts[walletStep])) }} &nbsp;·&nbsp; 1$ = {{ new Intl.NumberFormat('vi-VN').format(usdToVnd) }}₫
                        </span>
                        <!-- If user is in USD mode → just confirm the rate -->
                        <span v-else class="text-emerald-400 font-medium">
                          1$ = {{ new Intl.NumberFormat('vi-VN').format(usdToVnd) }}₫ {{ t('trading.usingUsd') }}
                        </span>
                      </template>
                      <span v-else-if="usdRateError" class="text-error text-[10px]">{{ usdRateError }}</span>
                      <span v-else class="text-text-disabled text-[10px]">{{ t('trading.noExchangeRate') }}</span>
                    </div>
                  </div>

                  <!-- Deposit input: collapsed by default -->
                  <div>
                    <button
                      type="button"
                      @click="showDeposit[walletStep] = !showDeposit[walletStep]"
                      class="flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-text-primary transition-colors py-0.5"
                    >
                      <span class="inline-block transition-transform duration-200" :class="showDeposit[walletStep] ? 'rotate-90' : ''">&#9656;</span>
                      {{ t('trading.depositLabel') }}
                      <span class="text-text-disabled">{{ t('trading.depositHint') }}</span>
                      <span v-if="drafts[walletStep].depositAmount !== 0" class="ml-1 text-accent font-semibold">{{ formatMoney(drafts[walletStep].depositAmount) }}</span>
                    </button>
                    <Transition
                      enter-active-class="transition-all duration-200 ease-out"
                      leave-active-class="transition-all duration-150 ease-in"
                      enter-from-class="opacity-0 -translate-y-1"
                      leave-to-class="opacity-0 -translate-y-1"
                    >
                      <div v-if="showDeposit[walletStep]" class="mt-1.5 relative">
                        <CurrencyInput
                          :modelValue="drafts[walletStep].depositAmount"
                          @update:modelValue="drafts[walletStep].depositAmount = $event"
                          placeholder="0"
                          :className="'w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 pr-6 text-sm text-right focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors'"
                        />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-disabled pointer-events-none">₫</span>
                      </div>
                    </Transition>
                  </div>

                  <!-- Balance after preview -->
                  <div class="flex items-center justify-between text-[11px] rounded-lg bg-bg-surface px-3 py-2 border border-border-subtle">
                    <span class="text-text-tertiary">{{ t('trading.balanceAfter') }}</span>
                    <span class="font-bold tabular-nums" :class="calcBalanceAfter(drafts[walletStep]) >= 0 ? 'text-text-primary' : 'text-error'">
                      {{ formatMoney(calcBalanceAfter(drafts[walletStep])) }}
                    </span>
                  </div>
                </div>

                <!-- Session note: only on last wallet -->
                <div v-if="isLastWallet" class="space-y-1">
                  <label class="text-[11px] text-text-tertiary font-medium">{{ t('trading.noteLabel') }}</label>
                  <textarea
                    v-model="sessionNote"
                    rows="2"
                    :placeholder="t('trading.notePlaceholder')"
                    maxlength="500"
                    class="w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled resize-none focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
                  />
                </div>
              </template>
            </div>



            <!-- STEP 3: Summary -->
            <div v-else-if="step === 'summary'" class="p-5 space-y-4">
              <!-- Total P&L card -->
              <div
                class="rounded-2xl p-4 text-center border"
                :class="totalPnl >= 0 ? 'bg-success/5 border-success/20' : 'bg-error/5 border-error/20'"
              >
                <p class="text-xs text-text-tertiary mb-1">{{ t('trading.summaryTotal') }}</p>
                <div
                  class="text-2xl font-bold tabular-nums flex items-center justify-center gap-1"
                  :class="totalPnl >= 0 ? 'text-success' : 'text-error'"
                >
                  <TrendingUp v-if="totalPnl >= 0" :size="20" />
                  <TrendingDown v-else :size="20" />
                  {{ totalPnl >= 0 ? '+' : '' }}{{ formatMoney(totalPnl) }}
                </div>
                <p v-if="totalDeposit > 0" class="mt-1 text-[11px] text-text-disabled">
                  {{ t('trading.summaryDeposit', { amount: formatMoney(totalDeposit) }) }}
                </p>
              </div>

              <!-- Per-wallet breakdown -->
              <div class="space-y-2">
                <div
                  v-for="e in summaryEntries"
                  :key="e.walletId"
                  class="flex items-center gap-3 rounded-xl border border-border-default bg-bg-elevated px-3.5 py-3"
                >
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white border border-border-default/30">
                    <img
                      v-if="getWalletLogo(e.walletName, drafts.find(d => d.walletId === e.walletId)?.customLogoUrl)"
                      :src="getWalletLogo(e.walletName, drafts.find(d => d.walletId === e.walletId)?.customLogoUrl)"
                      :alt="e.walletName"
                      class="h-5 w-5 object-contain"
                      loading="lazy"
                    />
                    <span v-else class="text-xs font-bold text-text-secondary">{{ e.walletName.substring(0,2) }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-text-primary">{{ e.walletName }}</div>
                    <div class="text-[11px] text-text-disabled">
                      {{ t('trading.balanceChange', { before: formatMoney(e.balanceBefore), after: formatMoney(e.balanceAfter) }) }}
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="text-sm font-bold tabular-nums" :class="e.pnlAmount >= 0 ? 'text-success' : 'text-error'">
                      {{ e.pnlAmount >= 0 ? '+' : '' }}{{ formatMoney(e.pnlAmount) }}
                    </div>
                    <div v-if="e.depositAmount > 0" class="text-[10px] text-text-disabled">
                      {{ t('trading.deposit', { amount: formatMoney(e.depositAmount) }) }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Note preview -->
              <div v-if="sessionNote" class="rounded-lg border border-border-subtle bg-bg-elevated px-3.5 py-2.5">
                <p class="text-[11px] text-text-tertiary mb-0.5">{{ t('trading.summaryNote') }}</p>
                <p class="text-sm text-text-secondary">{{ sessionNote }}</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="shrink-0 px-5 py-4 border-t border-border-subtle">

            <!-- Step 1 -->
            <div v-if="step === 'setup'" class="flex gap-2">
              <button @click="close" class="flex-1 rounded-xl border border-border-default py-2.5 text-sm text-text-secondary hover:bg-bg-hover transition-colors">
                {{ t('trading.cancel') }}
              </button>
              <button
                @click="confirmSetup"
                :disabled="isSavingConfig || pendingWalletIds.length === 0"
                class="flex-1 btn-primary justify-center py-2.5 disabled:opacity-40"
              >
                <span v-if="isSavingConfig" class="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <template v-else>
                  <span>{{ t('trading.next') }}</span>
                  <ChevronRight :size="14" />
                </template>
              </button>
            </div>

            <!-- Step 2 footer: per-wallet navigation -->
            <div v-else-if="step === 'input'" class="flex gap-2">
              <button @click="walletPrev" class="rounded-xl border border-border-default px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover transition-colors">
                {{ walletStep === 0 ? t('trading.backToWallets') : '← ' + (walletStep) + '/' + drafts.length }}
              </button>
              <button @click="walletNext" class="flex-1 btn-primary justify-center py-2.5">
                <template v-if="isLastWallet">
                  {{ t('trading.viewSummary') }}
                  <ChevronRight :size="14" />
                </template>
                <template v-else>
                  <span>{{ drafts[walletStep + 1]?.walletName ?? t('trading.next') }}</span>
                  <ChevronRight :size="14" />
                </template>
              </button>
            </div>

            <!-- Step 3 -->
            <div v-else-if="step === 'summary'" class="flex gap-2">
              <button @click="step = 'input'" class="rounded-xl border border-border-default px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover transition-colors">
                {{ t('trading.backToEdit') }}
              </button>
              <button
                @click="submit"
                :disabled="isSubmitting"
                class="flex-1 btn-primary justify-center py-2.5 disabled:opacity-40"
                :class="isEditMode ? 'bg-amber-500 hover:bg-amber-400' : ''"
              >
                <span v-if="isSubmitting" class="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <template v-else>
                  <Check :size="14" />
                  <span>{{ isEditMode ? t('trading.update') : t('trading.confirm') }}</span>
                </template>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 200ms ease;
}
.modal-fade-enter-active .relative,
.modal-fade-leave-active .relative {
  transition: transform 200ms ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .relative {
  transform: translateY(24px);
}
</style>
