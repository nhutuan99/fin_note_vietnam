<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowDownLeft, ArrowUpRight, X, Check, Wallet as WalletIcon, Plus, ChevronRight } from 'lucide-vue-next'
import type { TransactionType, Wallet } from '@/types'
import { useQuickAddStore } from '@/stores/quickAdd'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useEventListener } from '@/composables/useEventListener'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatVND } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'
import CurrencyInput from '@/components/ui/CurrencyInput.vue'

/** Untouched automatic popups close after this long */
const AUTO_CLOSE_MS = 5000
const QUICK_AMOUNTS = [20_000, 50_000, 100_000, 200_000, 500_000]
// Assigned automatically from bank SMS/webhooks, not picked by hand
const AUTO_ONLY_CATEGORIES = new Set(['bank_transfer', 'bank_receive', 'bank_fee'])

const { t } = useI18n()
const router = useRouter()
const store = useQuickAddStore()
const finance = useFinanceStore()
const ui = useUiStore()

const type = ref<TransactionType>('expense')
const walletId = ref('')
const category = ref('')
const amount = ref(0)
const note = ref('')
const submitting = ref(false)
const shake = ref(false)

const dialogRef = ref<HTMLElement | null>(null)

const categories = computed(() =>
  (type.value === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).filter((c) => !AUTO_ONLY_CATEGORIES.has(c.key))
)
const selectedWallet = computed(() => finance.wallets.find((w) => w.id === walletId.value) ?? null)
const canSubmit = computed(() => amount.value > 0 && !!selectedWallet.value && !submitting.value)

/** The input hugs its digits so the sign and "đ" sit right next to the number */
const amountWidth = computed(() => {
  const digits = amount.value > 0 ? new Intl.NumberFormat('vi-VN').format(amount.value).length : 1
  return `${digits + 0.5}ch`
})

/** Bring the selected wallet/category chips into view (they live in horizontal scrollers) */
function revealSelected() {
  dialogRef.value
    ?.querySelectorAll<HTMLElement>('.qa-chips--scroll .is-active')
    .forEach((el) => el.scrollIntoView({ block: 'nearest', inline: 'center' }))
}

// ── Auto close ──
const countingDown = ref(false)
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null

function stopCountdown() {
  if (autoCloseTimer) clearTimeout(autoCloseTimer)
  autoCloseTimer = null
  countingDown.value = false
}

/** Any interaction with the popup means the user is using it: cancel the auto close for good */
function markTouched() {
  if (countingDown.value) stopCountdown()
}

// ── Open / close ──
function today() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().substring(0, 10)
}

function pickWallet(preferred: string | null): string {
  if (preferred && finance.wallets.some((w) => w.id === preferred)) return preferred
  return finance.wallets[0]?.id ?? ''
}

async function initialise() {
  const prefs = store.prefs
  type.value = store.forcedType ?? prefs.type
  category.value = prefs.categories[type.value]
  amount.value = 0
  note.value = ''
  if (!finance.wallets.length) await finance.fetchWallets()
  walletId.value = pickWallet(prefs.walletId)
  if (!categories.value.some((c) => c.key === category.value)) {
    category.value = categories.value[categories.value.length - 1]?.key ?? ''
  }

  if (store.reason !== 'manual') {
    countingDown.value = true
    autoCloseTimer = setTimeout(close, AUTO_CLOSE_MS)
  }
  await nextTick()
  revealSelected()
  dialogRef.value?.querySelector<HTMLInputElement>('.qa-amount-input')?.focus()
}

watch(
  () => store.isOpen,
  (open) => {
    if (open) void initialise()
    else stopCountdown()
  }
)

// Prefs loaded after opening (first visit on this device): adopt the synced choices if untouched
watch(
  () => store.prefs.updatedAt,
  () => {
    if (store.isOpen && countingDown.value && !store.forcedType) {
      type.value = store.prefs.type
      category.value = store.prefs.categories[type.value]
      walletId.value = pickWallet(store.prefs.walletId)
    }
  }
)

function close() {
  stopCountdown()
  store.close()
}

// ── Choices (remembered on the server for every device) ──
function setType(next: TransactionType) {
  if (type.value === next) return
  type.value = next
  category.value = store.prefs.categories[next]
  store.updatePrefs({ type: next })
  nextTick(revealSelected)
}

function setWallet(w: Wallet) {
  walletId.value = w.id
  store.updatePrefs({ walletId: w.id })
}

function setCategory(key: string) {
  category.value = key
  store.updatePrefs({ categories: { ...store.prefs.categories, [type.value]: key } })
}

function setEnabled(enabled: boolean) {
  store.updatePrefs({ enabled })
  ui.showToast('info', enabled ? t('quickAdd.autoOnToast') : t('quickAdd.autoOffToast'))
}

// ── Submit ──
async function submit() {
  if (!canSubmit.value) {
    shake.value = true
    setTimeout(() => (shake.value = false), 400)
    dialogRef.value?.querySelector<HTMLInputElement>('.qa-amount-input')?.focus()
    return
  }
  submitting.value = true
  const wallet = selectedWallet.value!
  const tx = await finance.addTransaction({
    type: type.value,
    amount: amount.value,
    category: category.value,
    note: note.value.trim(),
    walletId: wallet.id,
    source: 'manual',
    date: today()
  })
  submitting.value = false
  if (!tx) {
    ui.showToast('error', t('common.somethingWentWrong'))
    return
  }
  ui.showToast(
    'success',
    t(type.value === 'income' ? 'quickAdd.savedIncome' : 'quickAdd.savedExpense', {
      amount: formatVND(amount.value),
      wallet: wallet.name
    })
  )
  close()
}

function openFullForm() {
  close()
  router.push('/transactions/add')
}

function addWallet() {
  close()
  router.push('/wallets')
}

// ── Keyboard ──
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (!store.isOpen) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === 'Enter' && !e.isComposing && (e.target as HTMLElement)?.tagName === 'INPUT') {
    e.preventDefault()
    void submit()
  }
})

// Leaving the app while an automatic popup is still untouched: drop it
useEventListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'hidden' && store.isOpen && countingDown.value) close()
})

function walletBrand(w: Wallet) {
  return getWalletBrand(w.name)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="qa">
      <div v-if="store.isOpen" class="qa-overlay" @click.self="close">
        <div
          ref="dialogRef"
          class="qa-sheet"
          :class="[`qa-sheet--${type}`, { 'is-shaking': shake }]"
          role="dialog"
          aria-modal="true"
          :aria-label="t('quickAdd.title')"
          @pointerdown="markTouched"
          @keydown="markTouched"
          @input="markTouched"
        >
          <!-- Auto-close countdown -->
          <div v-if="countingDown" class="qa-countdown" :style="{ animationDuration: `${AUTO_CLOSE_MS}ms` }" />

          <div class="qa-grabber" aria-hidden="true" />

          <!-- Header -->
          <div class="qa-header">
            <div>
              <h2 class="qa-title">{{ t('quickAdd.title') }}</h2>
              <p class="qa-subtitle">
                <template v-if="countingDown">{{ t('quickAdd.autoCloseHint') }}</template>
                <template v-else>{{ t('quickAdd.subtitle') }}</template>
              </p>
            </div>
            <button class="qa-icon-btn" :aria-label="t('common.close')" @click="close">
              <X :size="18" />
            </button>
          </div>

          <!-- In / out tabs -->
          <div class="qa-tabs" role="tablist">
            <button
              role="tab"
              class="qa-tab qa-tab--income"
              :class="{ 'is-active': type === 'income' }"
              :aria-selected="type === 'income'"
              @click="setType('income')"
            >
              <ArrowDownLeft :size="18" />
              {{ t('quickAdd.moneyIn') }}
            </button>
            <button
              role="tab"
              class="qa-tab qa-tab--expense"
              :class="{ 'is-active': type === 'expense' }"
              :aria-selected="type === 'expense'"
              @click="setType('expense')"
            >
              <ArrowUpRight :size="18" />
              {{ t('quickAdd.moneyOut') }}
            </button>
          </div>

          <!-- Amount -->
          <div class="qa-amount">
            <span class="qa-amount__sign">{{ type === 'income' ? '+' : '−' }}</span>
            <CurrencyInput
              v-model="amount"
              placeholder="0"
              class-name="qa-amount-input"
              :style="{ width: amountWidth }"
              :aria-label="t('quickAdd.amount')"
            />
            <span class="qa-amount__unit">đ</span>
          </div>
          <div class="qa-chips qa-chips--amounts">
            <button
              v-for="value in QUICK_AMOUNTS"
              :key="value"
              class="qa-chip"
              :class="{ 'is-active': amount === value }"
              @click="amount = value"
            >
              {{ new Intl.NumberFormat('vi-VN').format(value / 1000) }}k
            </button>
          </div>

          <!-- Money source -->
          <div class="qa-section-label">
            <WalletIcon :size="13" />
            {{ type === 'income' ? t('quickAdd.toWallet') : t('quickAdd.fromWallet') }}
          </div>
          <div v-if="finance.wallets.length" class="qa-chips qa-chips--scroll">
            <button
              v-for="w in finance.wallets"
              :key="w.id"
              class="qa-wallet"
              :class="{ 'is-active': walletId === w.id }"
              :aria-pressed="walletId === w.id"
              @click="setWallet(w)"
            >
              <span v-if="w.customLogoUrl || walletBrand(w)?.logoUrl" class="qa-wallet__logo">
                <img :src="w.customLogoUrl || walletBrand(w)!.logoUrl" alt="" loading="lazy" />
              </span>
              <span
                v-else-if="walletBrand(w)"
                class="qa-wallet__logo qa-wallet__logo--abbr"
                :style="{ backgroundColor: walletBrand(w)!.bgColor, color: walletBrand(w)!.textColor }"
              >
                {{ walletBrand(w)!.abbr }}
              </span>
              <span v-else class="qa-wallet__emoji">{{ w.icon }}</span>
              <span class="qa-wallet__text">
                <span class="qa-wallet__name">{{ w.name }}</span>
                <span class="qa-wallet__balance">{{ formatVND(w.balance) }}</span>
              </span>
            </button>
          </div>
          <button v-else class="qa-empty-wallet" @click="addWallet">
            <Plus :size="15" />
            {{ t('quickAdd.noWallet') }}
          </button>

          <!-- Category -->
          <div class="qa-chips qa-chips--scroll qa-chips--categories">
            <button
              v-for="c in categories"
              :key="c.key"
              class="qa-chip qa-chip--category"
              :class="{ 'is-active': category === c.key }"
              @click="setCategory(c.key)"
            >
              <span class="font-emoji">{{ c.icon }}</span>
              {{ t(`categories.${c.key}`) }}
            </button>
          </div>

          <!-- Note -->
          <input
            v-model="note"
            type="text"
            maxlength="200"
            class="qa-note"
            :placeholder="t('quickAdd.notePlaceholder')"
          />

          <!-- Submit -->
          <button class="qa-submit" :disabled="submitting" @click="submit">
            <AppSpinner v-if="submitting" :size="18" />
            <Check v-else :size="18" />
            {{ type === 'income' ? t('quickAdd.saveIncome') : t('quickAdd.saveExpense') }}
          </button>

          <!-- Footer: auto-open switch + full form -->
          <div class="qa-footer">
            <label class="qa-switch">
              <input
                type="checkbox"
                :checked="store.prefs.enabled"
                @change="setEnabled(($event.target as HTMLInputElement).checked)"
              />
              <span class="qa-switch__track" aria-hidden="true" />
              <span>{{ t('quickAdd.autoOpen') }}</span>
            </label>
            <button class="qa-link" @click="openFullForm">
              {{ t('quickAdd.fullForm') }}
              <ChevronRight :size="14" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.qa-overlay {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
}

@media (min-width: 640px) {
  .qa-overlay {
    align-items: center;
    padding: 1rem;
  }
}

/* ── Sheet: bottom sheet on phones, centered card on larger screens ── */
.qa-sheet {
  --qa-color: var(--error);
  position: relative;
  width: 100%;
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  border-radius: 1.5rem 1.5rem 0 0;
  border: 1px solid var(--border-default);
  border-bottom: none;
  background: var(--bg-surface);
  box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.35);
  scrollbar-width: none;
}

.qa-sheet--income {
  --qa-color: var(--success);
}

@media (min-width: 640px) {
  .qa-sheet {
    max-width: 28rem;
    padding: 1.25rem 1.5rem 1.25rem;
    border-radius: 1.5rem;
    border-bottom: 1px solid var(--border-default);
    box-shadow: var(--shadow-lg);
  }
}

/* Soft glow in the tab colour, so money in / out reads at a glance */
.qa-sheet::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 9rem;
  background: radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--qa-color) 16%, transparent), transparent 70%);
  pointer-events: none;
  transition: background 0.3s ease;
}

.qa-sheet > * {
  position: relative;
}

.qa-sheet.is-shaking {
  animation: qaShake 0.35s ease;
}

@keyframes qaShake {
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.qa-countdown {
  position: absolute;
  top: 0;
  left: 0;
  height: 3px;
  width: 100%;
  background: var(--qa-color);
  transform-origin: left;
  animation: qaCountdown linear forwards;
}

@keyframes qaCountdown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

.qa-grabber {
  width: 2.5rem;
  height: 0.25rem;
  margin: 0 auto 0.75rem;
  border-radius: 999px;
  background: var(--border-strong);
}

@media (min-width: 640px) {
  .qa-grabber {
    display: none;
  }
}

.qa-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.qa-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.qa-subtitle {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.qa-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.qa-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ── Tabs ── */
.qa-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  padding: 0.25rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  background: var(--bg-elevated);
}

.qa-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  height: 2.75rem;
  border-radius: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-tertiary);
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.qa-tab:hover:not(.is-active) {
  color: var(--text-primary);
}

.qa-tab--income.is-active {
  background: var(--success);
  color: #fff;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--success) 35%, transparent);
}

.qa-tab--expense.is-active {
  background: var(--error);
  color: #fff;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--error) 35%, transparent);
}

/* ── Amount ── */
.qa-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  color: var(--qa-color);
}

.qa-amount__sign,
.qa-amount__unit {
  font-size: 1.75rem;
  font-weight: 700;
  opacity: 0.8;
}

.qa-amount :deep(.qa-amount-input) {
  min-width: 1.5ch;
  max-width: 100%;
  border: none;
  background: transparent;
  color: var(--qa-color);
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1.1;
  text-align: center;
  letter-spacing: -0.02em;
  caret-color: var(--qa-color);
  outline: none;
  font-variant-numeric: tabular-nums;
}

.qa-amount :deep(.qa-amount-input::placeholder) {
  color: color-mix(in srgb, var(--qa-color) 35%, transparent);
}

/* ── Chips ── */
.qa-chips {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 1rem;
}

.qa-chips--amounts {
  justify-content: center;
  flex-wrap: wrap;
}

.qa-chips--scroll {
  overflow-x: auto;
  scrollbar-width: none;
  margin-left: -1.25rem;
  margin-right: -1.25rem;
  padding: 0 1.25rem 2px;
}

@media (min-width: 640px) {
  .qa-chips--scroll {
    margin-left: -1.5rem;
    margin-right: -1.5rem;
    padding: 0 1.5rem 2px;
  }
}

.qa-chips--scroll::-webkit-scrollbar {
  display: none;
}

.qa-chip {
  flex-shrink: 0;
  height: 2rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.qa-chip:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.qa-chip.is-active {
  border-color: var(--qa-color);
  background: color-mix(in srgb, var(--qa-color) 14%, transparent);
  color: var(--qa-color);
}

.qa-chip--category {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.qa-section-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

/* ── Wallets ── */
.qa-wallet {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
  min-width: 9rem;
  padding: 0.5rem 0.75rem 0.5rem 0.5rem;
  border-radius: 0.875rem;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  text-align: left;
  transition: all var(--transition-fast);
}

.qa-wallet:hover {
  border-color: var(--border-strong);
}

.qa-wallet.is-active {
  border-color: var(--qa-color);
  background: color-mix(in srgb, var(--qa-color) 10%, var(--bg-elevated));
  box-shadow: 0 0 0 1px var(--qa-color) inset;
}

.qa-wallet__logo,
.qa-wallet__emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 0.5rem;
  background: #fff;
  font-size: 0.625rem;
  font-weight: 700;
}

.qa-wallet__logo img {
  width: 100%;
  height: 100%;
  padding: 0.25rem;
  object-fit: contain;
}

.qa-wallet__emoji {
  background: var(--bg-hover);
  font-size: 1.125rem;
}

.qa-wallet__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.qa-wallet__name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.qa-wallet__balance {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.qa-empty-wallet {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  height: 3rem;
  margin-bottom: 1rem;
  border-radius: 0.875rem;
  border: 1px dashed var(--border-strong);
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

/* ── Note & submit ── */
.qa-note {
  width: 100%;
  height: 2.75rem;
  margin-bottom: 1rem;
  padding: 0 0.875rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.qa-note::placeholder {
  color: var(--text-disabled);
}

.qa-note:focus {
  outline: none;
  border-color: var(--qa-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--qa-color) 18%, transparent);
}

.qa-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  height: 3.25rem;
  border-radius: 1rem;
  background: var(--qa-color);
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--qa-color) 30%, transparent);
  transition: transform 0.1s ease, opacity var(--transition-fast), background 0.2s ease;
}

.qa-submit:hover {
  opacity: 0.92;
}

.qa-submit:active {
  transform: scale(0.98);
}

.qa-submit:disabled {
  opacity: 0.6;
}

/* ── Footer ── */
.qa-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.qa-switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.qa-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.qa-switch__track {
  position: relative;
  width: 2rem;
  height: 1.125rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--border-strong);
  transition: background 0.2s ease;
}

.qa-switch__track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.qa-switch input:checked + .qa-switch__track {
  background: var(--accent);
}

.qa-switch input:checked + .qa-switch__track::after {
  transform: translateX(0.875rem);
}

.qa-switch input:focus-visible + .qa-switch__track {
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.qa-link {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.qa-link:hover {
  color: var(--text-primary);
}

/* ── Transitions ── */
.qa-enter-active,
.qa-leave-active {
  transition: opacity 0.25s ease;
}

.qa-enter-active .qa-sheet,
.qa-leave-active .qa-sheet {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease;
}

.qa-enter-from,
.qa-leave-to {
  opacity: 0;
}

.qa-enter-from .qa-sheet,
.qa-leave-to .qa-sheet {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .qa-enter-from .qa-sheet,
  .qa-leave-to .qa-sheet {
    transform: translateY(12px) scale(0.97);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .qa-enter-active .qa-sheet,
  .qa-leave-active .qa-sheet,
  .qa-sheet.is-shaking {
    transition: none;
    animation: none;
  }
}
</style>
