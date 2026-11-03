<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowDownLeft, ArrowUpRight, X, Check, Wallet as WalletIcon, Plus, Tag } from 'lucide-vue-next'
import type { TransactionType, Wallet } from '@/types'
import { useQuickAddStore } from '@/stores/quickAdd'
import { useRoutinesStore } from '@/stores/routines'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useEventListener } from '@/composables/useEventListener'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatVND } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'
import CurrencyInput from '@/components/ui/CurrencyInput.vue'

/** Untouched automatic popups close after this long */
const AUTO_CLOSE_MS = 5000
const QUICK_AMOUNTS = [20_000, 50_000, 100_000, 200_000, 500_000]
/** Amounts typed below this are read as thousands: "44" → 44.000 đ */
const THOUSANDS_BELOW = 1000
/** How long the filled-in amount stays on screen before saving, so the user sees what is saved */
const FILL_PREVIEW_MS = 450
// Assigned automatically from bank SMS/webhooks, not picked by hand
const AUTO_ONLY_CATEGORIES = new Set(['bank_transfer', 'bank_receive', 'bank_fee'])

const { t } = useI18n()
const router = useRouter()
const store = useQuickAddStore()
const finance = useFinanceStore()
const ui = useUiStore()
const routines = useRoutinesStore()

const type = ref<TransactionType>('expense')
const walletId = ref('')
const category = ref('')
const amount = ref(0)
const note = ref('')
const submitting = ref(false)
const shake = ref(false)
const filled = ref(false)

const dialogRef = ref<HTMLElement | null>(null)

const pickableCategories = {
  income: INCOME_CATEGORIES.filter((c) => !AUTO_ONLY_CATEGORIES.has(c.key)),
  expense: EXPENSE_CATEGORIES.filter((c) => !AUTO_ONLY_CATEGORIES.has(c.key))
} as const
const categories = computed(() => pickableCategories[type.value])

// ── Routine mode: confirming (or editing) a routine occurrence instead of a blank entry ──
const routineItem = computed(() => (store.reason === 'routine' ? routines.current : null))
const routineMore = computed(() => Math.max(0, routines.queue.length - 1))

function dayLabel(date: string) {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return date === iso ? t('routine.today') : date.split('-').reverse().slice(0, 2).join('/')
}

const routineSubtitle = computed(() => {
  const item = routineItem.value
  if (!item) return ''
  const { occurrence: o, routine: r } = item
  if (o.status === 'pending') return t('routine.popupPending', { when: `${dayLabel(o.date)} · ${r.time}` })
  if (o.status === 'auto') return t('routine.popupAuto', { date: dayLabel(o.date) })
  if (o.status === 'confirmed') return t('routine.popupDone', { date: dayLabel(o.date) })
  return t('routine.popupMissed', { date: dayLabel(o.date) })
})

/** Fill the form from the routine occurrence at the head of the queue */
function fillFromRoutine() {
  const item = routineItem.value
  if (!item) return
  type.value = item.routine.type
  amount.value = item.occurrence.amount
  walletId.value = pickWallet(item.routine.walletId)
  category.value = item.routine.category
  note.value = item.routine.note
  filled.value = false
}

// Next item in the queue, or an untouched quick-add popup switched to routine mode in place
watch(
  () => routineItem.value?.occurrence.id,
  (id) => {
    if (!id || !store.isOpen) return
    stopCountdown()
    fillFromRoutine()
  }
)

const selectedWallet = computed(() => finance.cashWallets.find((w) => w.id === walletId.value) ?? null)
const canSubmit = computed(() => amount.value > 0 && !!selectedWallet.value && !submitting.value)

/** "44" is shown as 44 + a faint ".000": what will actually be saved */
const showThousands = computed(() => amount.value > 0 && amount.value < THOUSANDS_BELOW)

/** The input hugs its digits so the sign and "đ" sit right next to the number */
const amountWidth = computed(() => {
  const digits = amount.value > 0 ? new Intl.NumberFormat('vi-VN').format(amount.value).length : 1
  return `${digits + 0.5}ch`
})

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
  store.markInteracted()
  if (countingDown.value) stopCountdown()
}

// ── Open / close ──
function today() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().substring(0, 10)
}

function pickWallet(preferred: string | null): string {
  if (preferred && finance.cashWallets.some((w) => w.id === preferred)) return preferred
  return finance.cashWallets[0]?.id ?? ''
}

function focusAmount() {
  dialogRef.value?.querySelector<HTMLInputElement>('.qa-amount-input')?.focus({ preventScroll: true })
}

async function initialise() {
  const prefs = store.prefs
  type.value = store.forcedType ?? prefs.type
  category.value = prefs.categories[type.value]
  amount.value = 0
  note.value = ''
  filled.value = false
  if (!finance.wallets.length) await finance.fetchWallets()
  walletId.value = pickWallet(prefs.walletId)
  if (routineItem.value) {
    fillFromRoutine()
    await nextTick()
    focusAmount()
    return
  }
  if (!categories.value.some((c) => c.key === category.value)) {
    category.value = categories.value[categories.value.length - 1]?.key ?? ''
  }

  if (store.reason !== 'manual') {
    countingDown.value = true
    autoCloseTimer = setTimeout(close, AUTO_CLOSE_MS)
  }
  await nextTick()
  focusAmount()
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
  // Auto-recorded routine items that were shown count as seen (kept as recorded)
  if (store.reason === 'routine') {
    void routines.acknowledge(routines.queue.filter((i) => i.occurrence.status === 'auto').map((i) => i.occurrence.id))
    routines.queue = []
  }
  store.close()
}

/** Next routine occurrence in the queue, or close when done */
function advanceRoutine() {
  routines.queue = routines.queue.slice(1)
  if (!routines.queue.length) close()
}

async function skipRoutine() {
  const item = routineItem.value
  if (!item || submitting.value) return
  submitting.value = true
  try {
    await routines.skip(item.occurrence.id)
    ui.showToast('info', t(item.occurrence.txId ? 'routine.undone' : 'routine.skipped', { name: item.routine.name }))
    advanceRoutine()
  } catch {
    // httpClient already showed the error
  } finally {
    submitting.value = false
  }
}

// ── Choices (remembered on the server for every device) ──
function setType(next: TransactionType) {
  if (type.value === next) return
  type.value = next
  category.value = store.prefs.categories[next]
  if (!routineItem.value) store.updatePrefs({ type: next })
}

function setWallet(w: Wallet) {
  walletId.value = w.id
  if (!routineItem.value) store.updatePrefs({ walletId: w.id })
}

function setCategory(key: string) {
  category.value = key
  if (!routineItem.value) store.updatePrefs({ categories: { ...store.prefs.categories, [type.value]: key } })
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
    focusAmount()
    return
  }
  submitting.value = true

  // "44" means 44.000 đ: fill it in on screen first, then save
  if (amount.value < THOUSANDS_BELOW) {
    amount.value *= 1000
    filled.value = true
    await new Promise((resolve) => setTimeout(resolve, FILL_PREVIEW_MS))
  }

  const wallet = selectedWallet.value!

  const item = routineItem.value
  if (item) {
    try {
      await routines.confirm(item.occurrence.id, {
        amount: amount.value,
        walletId: wallet.id,
        category: category.value,
        note: note.value.trim()
      })
      ui.showToast('success', t('routine.confirmed', { amount: formatVND(amount.value), name: item.routine.name }))
      advanceRoutine()
    } catch {
      // httpClient already showed the error
    } finally {
      submitting.value = false
    }
    return
  }

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
    <!-- Durations given explicitly: the overlay itself never fades (see .qa-scrim) -->
    <Transition name="qa" :duration="{ enter: 280, leave: 160 }">
      <div v-if="store.isOpen" class="qa-overlay">
        <div class="qa-scrim" @click="close" />
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

          <!-- Header -->
          <header class="qa-header">
            <div class="min-w-0">
              <h2 class="qa-title">{{ routineItem ? routineItem.routine.name : t('quickAdd.title') }}</h2>
              <p class="qa-subtitle">{{ routineItem ? routineSubtitle : t('quickAdd.subtitle') }}</p>
            </div>
            <button class="qa-icon-btn" :aria-label="t('common.close')" @click="close">
              <X :size="18" />
            </button>
          </header>

          <!-- Scrolling content -->
          <div class="qa-body">
            <!-- In / out tabs -->
            <div v-if="!routineItem" class="qa-tabs" role="tablist">
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
            <div class="qa-amount" :class="{ 'is-filled': filled }">
              <span class="qa-amount__sign">{{ type === 'income' ? '+' : '−' }}</span>
              <CurrencyInput
                v-model="amount"
                placeholder="0"
                class-name="qa-amount-input"
                :style="{ width: amountWidth }"
                :aria-label="t('quickAdd.amount')"
              />
              <span v-if="showThousands" class="qa-amount__ghost" aria-hidden="true">.000</span>
              <span class="qa-amount__unit">đ</span>
            </div>
            <div class="qa-amounts">
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
            <!-- Every option visible at once: no hidden horizontal scrolling (unreachable with a mouse) -->
            <div v-if="finance.cashWallets.length" class="qa-wallets">
              <button
                v-for="w in finance.cashWallets"
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
                  <span class="qa-wallet__name" :title="w.name">{{ w.name }}</span>
                  <span class="qa-wallet__balance">{{ formatVND(w.balance) }}</span>
                </span>
              </button>
            </div>
            <button v-else class="qa-empty-wallet" @click="addWallet">
              <Plus :size="15" />
              {{ t('quickAdd.noWallet') }}
            </button>

            <!-- Category: chips on larger screens, an icon grid on phones -->
            <div class="qa-section-label">
              <Tag :size="13" />
              {{ t('quickAdd.category') }}
            </div>
            <!--
              Both lists share one grid cell; the other tab's list stays laid out but invisible,
              so the panel is as tall as the longer list and doesn't jump when switching in/out.
            -->
            <div class="qa-cats-stack">
              <div
                v-for="kind in (['income', 'expense'] as const)"
                :key="kind"
                class="qa-cats"
                :class="{ 'is-hidden': kind !== type }"
                :inert="kind !== type"
                :aria-hidden="kind !== type"
              >
                <button
                  v-for="c in pickableCategories[kind]"
                  :key="c.key"
                  class="qa-cat"
                  :class="{ 'is-active': kind === type && category === c.key }"
                  :aria-pressed="kind === type && category === c.key"
                  @click="setCategory(c.key)"
                >
                  <span class="qa-cat__icon font-emoji">{{ c.icon }}</span>
                  <span class="qa-cat__label">{{ t(`categories.${c.key}`) }}</span>
                </button>
              </div>
            </div>

            <!-- Note -->
            <input
              v-model="note"
              type="text"
              maxlength="200"
              class="qa-note"
              :placeholder="t('quickAdd.notePlaceholder')"
            />
          </div>

          <!-- Save + auto-open switch, always in reach at the bottom -->
          <footer class="qa-actions">
            <button class="qa-submit" :disabled="submitting" @click="submit">
              <AppSpinner v-if="submitting" :size="18" />
              <Check v-else :size="18" />
              <template v-if="routineItem && routineItem.occurrence.txId">{{ t('routine.save') }}</template>
              <template v-else>{{ type === 'income' ? t('quickAdd.saveIncome') : t('quickAdd.saveExpense') }}</template>
            </button>
            <!-- Routine: skip this time / undo what was recorded -->
            <div v-if="routineItem" class="qa-routine-row">
              <button class="qa-secondary" :disabled="submitting" @click="skipRoutine">
                {{ routineItem.occurrence.txId ? t('routine.undo') : t('routine.skipThis') }}
              </button>
              <span v-if="routineMore" class="qa-routine-more">{{ t('routine.more', { n: routineMore }) }}</span>
            </div>
            <label v-else class="qa-switch">
              <input
                type="checkbox"
                :checked="store.prefs.enabled"
                @change="setEnabled(($event.target as HTMLInputElement).checked)"
              />
              <span class="qa-switch__track" aria-hidden="true" />
              <span>{{ t('quickAdd.autoOpen') }}</span>
            </label>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Overlay: dims and blurs the page behind so the eye lands on the panel ── */
.qa-overlay {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: center;
}

/*
 * ── Performance ──
 * No backdrop-filter anywhere in this popup. With a blurred backdrop, every frame of the
 * countdown (and every repaint of the page behind, e.g. the dashboard refreshing on return)
 * forced the whole blurred area to be recomputed — that was the lag. The dim and the panel are
 * plain painted layers now, so opening and the countdown run on the compositor alone.
 */
.qa-scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

:global([data-theme='light'] .qa-scrim) {
  background: rgba(15, 23, 42, 0.38);
}

@media (min-width: 640px) {
  .qa-overlay {
    padding: 1rem;
  }
}

/*
 * ── Liquid glass panel (static material) ──
 * A glass look without sampling the page: a tinted vertical gradient, a bright specular rim on
 * the top edge, a hairline stroke and a soft sheen — painted once. Controls inside are lighter
 * glass layers (--qa-fill).
 */
.qa-sheet {
  --qa-color: var(--error);
  --qa-glass: linear-gradient(180deg, #26262b 0%, #1b1b1f 48%, #151518 100%);
  --qa-fill: rgba(255, 255, 255, 0.06);
  --qa-fill-strong: rgba(255, 255, 255, 0.11);
  --qa-stroke: rgba(255, 255, 255, 0.08);
  --qa-rim: rgba(255, 255, 255, 0.16);
  --qa-sheen: rgba(255, 255, 255, 0.05);
  --qa-pad: 1.25rem;

  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: var(--qa-glass);
  box-shadow: inset 0 1px 0 var(--qa-rim), inset 0 0 0 1px var(--qa-stroke);
  /* Repaints inside (caret, chip states) stay inside the panel */
  contain: layout paint;
  isolation: isolate;
}

/* Light: iOS-style pale grey glass with white glass controls on top */
:global([data-theme='light'] .qa-sheet) {
  --qa-glass: linear-gradient(180deg, #fcfcfe 0%, #f4f4f8 52%, #eeeef3 100%);
  --qa-fill: rgba(255, 255, 255, 0.9);
  --qa-fill-strong: #fff;
  --qa-stroke: rgba(15, 23, 42, 0.09);
  --qa-rim: rgba(255, 255, 255, 1);
  --qa-sheen: rgba(255, 255, 255, 0.7);
}

.qa-sheet--income {
  --qa-color: var(--success);
}

/* Sheen: light catching the top-left corner of the glass */
.qa-sheet::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: radial-gradient(90% 55% at 0% 0%, var(--qa-sheen), transparent 70%);
  pointer-events: none;
}

/* Larger screens: a floating card */
@media (min-width: 640px) {
  .qa-sheet {
    --qa-pad: 1.5rem;
    max-width: 36rem;
    height: auto;
    max-height: calc(100dvh - 2rem);
    border-radius: 1rem;
    box-shadow:
      inset 0 1px 0 var(--qa-rim),
      inset 0 0 0 1px var(--qa-stroke),
      0 30px 80px rgba(0, 0, 0, 0.45);
  }

  :global([data-theme='light'] .qa-sheet) {
    box-shadow:
      inset 0 1px 0 var(--qa-rim),
      inset 0 0 0 1px var(--qa-stroke),
      0 30px 80px rgba(15, 23, 42, 0.18);
  }
}

.qa-sheet.is-shaking {
  animation: qaShake 0.35s ease;
}

@keyframes qaShake {
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

/*
 * Auto-close countdown: a transform-only animation on its own layer — runs on the compositor,
 * no paint per frame. Inset from the edges so it never needs the rounded-corner clip.
 */
.qa-countdown {
  position: absolute;
  top: 0;
  left: 1.25rem;
  right: 1.25rem;
  z-index: 3;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--qa-color);
  transform-origin: left;
  will-change: transform;
  animation: qaCountdown linear forwards;
}

@keyframes qaCountdown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

/* ── Header ── */
.qa-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: calc(env(safe-area-inset-top) + 1rem) var(--qa-pad) 0.875rem;
}

@media (min-width: 640px) {
  .qa-header {
    padding-top: 1.25rem;
  }
}

.qa-title {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
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
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--qa-fill);
  box-shadow: inset 0 0 0 1px var(--qa-stroke);
  color: var(--text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.qa-icon-btn:hover {
  background: var(--qa-fill-strong);
  color: var(--text-primary);
}

/* ── Body: the only part that scrolls ── */
.qa-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.25rem var(--qa-pad) 1rem;
  scrollbar-width: none;
}

.qa-body::-webkit-scrollbar {
  display: none;
}

/* ── Tabs ── */
.qa-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.375rem;
  padding: 0.25rem;
  margin-bottom: 1.25rem;
  border-radius: 0.75rem;
  background: var(--qa-fill);
  box-shadow: inset 0 0 0 1px var(--qa-stroke);
}

.qa-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  height: 2.875rem;
  border-radius: 0.5625rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-tertiary);
  transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.qa-tab:hover:not(.is-active) {
  color: var(--text-primary);
}

.qa-tab.is-active {
  color: #fff;
}

.qa-tab--income.is-active {
  background: var(--success);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 6px 18px color-mix(in srgb, var(--success) 32%, transparent);
}

.qa-tab--expense.is-active {
  background: var(--error);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 6px 18px color-mix(in srgb, var(--error) 32%, transparent);
}

/* ── Amount ── */
.qa-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.25rem;
  margin: 0.5rem 0 1rem;
  color: var(--qa-color);
}

/* The filled-in thousands get a short pop so the change is noticed before saving */
.qa-amount.is-filled {
  animation: qaFilled 0.45s cubic-bezier(0.32, 0.72, 0, 1);
}

@keyframes qaFilled {
  40% { transform: scale(1.08); }
}

.qa-amount__sign,
.qa-amount__unit {
  font-size: 1.75rem;
  font-weight: 700;
  opacity: 0.8;
}

.qa-amount__ghost {
  margin-left: -0.25rem;
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  opacity: 0.3;
  font-variant-numeric: tabular-nums;
}

.qa-amount :deep(.qa-amount-input) {
  min-width: 1.5ch;
  max-width: 100%;
  border: none;
  background: transparent;
  color: var(--qa-color);
  font-size: 3rem;
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

/* Quick amounts: an even row on phones, centered pills on larger screens */
.qa-amounts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.375rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 640px) {
  .qa-amounts {
    display: flex;
    justify-content: center;
    margin-bottom: 1.25rem;
  }
}

.qa-chip {
  height: 2.5rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  background: var(--qa-fill);
  box-shadow: inset 0 0 0 1px var(--qa-stroke);
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}

@media (min-width: 640px) {
  .qa-chip {
    height: 2.125rem;
    font-size: 0.8125rem;
  }
}

.qa-chip:hover {
  background: var(--qa-fill-strong);
  color: var(--text-primary);
}

.qa-chip.is-active {
  background: color-mix(in srgb, var(--qa-color) 16%, transparent);
  box-shadow: inset 0 0 0 1.5px var(--qa-color);
  color: var(--qa-color);
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
.qa-wallets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.qa-wallet {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
  min-height: 3.25rem;
  padding: 0.5rem 0.625rem 0.5rem 0.5rem;
  border-radius: 0.625rem;
  background: var(--qa-fill);
  box-shadow: inset 0 0 0 1px var(--qa-stroke);
  text-align: left;
  transition: background var(--transition-fast), box-shadow var(--transition-fast);
}

.qa-wallet:hover {
  background: var(--qa-fill-strong);
}

.qa-wallet.is-active {
  background: color-mix(in srgb, var(--qa-color) 12%, var(--qa-fill));
  box-shadow: inset 0 0 0 1.5px var(--qa-color);
}

.qa-wallet__logo,
.qa-wallet__emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 0.4375rem;
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
  background: var(--qa-fill-strong);
  font-size: 1.125rem;
}

.qa-wallet__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Names wrap so a long wallet name stays readable; the balance stays on one line */
.qa-wallet__name {
  overflow-wrap: break-word;
}

.qa-wallet__balance {
  white-space: nowrap;
}

.qa-wallet__name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.qa-wallet__balance {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.qa-empty-wallet {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  height: 3rem;
  margin-bottom: 1.25rem;
  border-radius: 0.625rem;
  border: 1px dashed var(--border-strong);
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

/* ── Categories: icon grid on phones (big, thumb-sized targets), wrapping chips above ── */
.qa-cats-stack {
  display: grid;
  margin-bottom: 1.25rem;
}

.qa-cats-stack > .qa-cats {
  grid-area: 1 / 1;
  align-self: start;
}

.qa-cats.is-hidden {
  visibility: hidden;
}

.qa-cats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.qa-cat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 0;
  min-height: 4.25rem;
  padding: 0.5rem 0.25rem;
  border-radius: 0.625rem;
  background: var(--qa-fill);
  box-shadow: inset 0 0 0 1px var(--qa-stroke);
  color: var(--text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}

.qa-cat__icon {
  font-size: 1.375rem;
  line-height: 1;
}

.qa-cat__label {
  max-width: 100%;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: break-word;
}

.qa-cat:hover {
  background: var(--qa-fill-strong);
  color: var(--text-primary);
}

.qa-cat.is-active {
  background: color-mix(in srgb, var(--qa-color) 16%, transparent);
  box-shadow: inset 0 0 0 1.5px var(--qa-color);
  color: var(--qa-color);
}

@media (min-width: 640px) {
  .qa-cats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .qa-cat {
    flex-direction: row;
    gap: 0.375rem;
    min-height: 0;
    height: 2rem;
    padding: 0 0.75rem;
    border-radius: 999px;
  }

  .qa-cat__icon {
    font-size: 0.875rem;
  }

  .qa-cat__label {
    display: block;
    font-size: 0.75rem;
    white-space: nowrap;
  }
}

/* ── Note ── */
.qa-note {
  width: 100%;
  height: 3rem;
  padding: 0 0.875rem;
  border: none;
  border-radius: 0.625rem;
  background: var(--qa-fill);
  box-shadow: inset 0 0 0 1px var(--qa-stroke);
  color: var(--text-primary);
  font-size: 1rem;
  transition: box-shadow var(--transition-fast);
}

@media (min-width: 640px) {
  .qa-note {
    height: 2.75rem;
    font-size: 0.875rem;
  }
}

.qa-note::placeholder {
  color: var(--text-disabled);
}

.qa-note:focus {
  outline: none;
  box-shadow: inset 0 0 0 1.5px var(--qa-color), 0 0 0 4px color-mix(in srgb, var(--qa-color) 16%, transparent);
}

/* ── Actions: pinned below the scrolling body ── */
.qa-actions {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 0.875rem;
  padding: 0.75rem var(--qa-pad) calc(env(safe-area-inset-bottom) + 1rem);
  border-top: 1px solid var(--qa-stroke);
}

@media (min-width: 640px) {
  .qa-actions {
    padding-bottom: 1.25rem;
  }
}

.qa-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  height: 3.5rem;
  border-radius: 0.75rem;
  background: var(--qa-color);
  color: #fff;
  font-size: 1.0625rem;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 10px 26px color-mix(in srgb, var(--qa-color) 30%, transparent);
  transition: transform 0.1s ease, opacity var(--transition-fast), background 0.2s ease;
}

@media (min-width: 640px) {
  .qa-submit {
    height: 3.25rem;
    font-size: 1rem;
  }
}

.qa-submit:hover {
  opacity: 0.92;
}

.qa-submit:active {
  transform: scale(0.98);
}

.qa-submit:disabled {
  opacity: 0.7;
}

/* ── Routine mode: secondary action under the save button ── */
.qa-routine-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.qa-secondary {
  height: 2.5rem;
  padding: 0 1rem;
  border-radius: 999px;
  background: var(--qa-fill);
  box-shadow: inset 0 0 0 1px var(--qa-stroke);
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.qa-secondary:hover {
  background: var(--qa-fill-strong);
  color: var(--text-primary);
}

.qa-routine-more {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* ── Auto-open switch ── */
.qa-switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
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

/*
 * ── Transitions ──
 * Only opacity/transform are animated, on plain painted layers (compositor-only).
 */
.qa-enter-active .qa-scrim {
  transition: opacity 0.18s ease-out;
}

.qa-leave-active .qa-scrim {
  transition: opacity 0.14s ease-in;
}

.qa-enter-active .qa-sheet {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.18s ease-out;
}

.qa-leave-active .qa-sheet {
  transition: transform 0.16s ease-in, opacity 0.14s ease-in;
}

.qa-enter-from .qa-scrim,
.qa-leave-to .qa-scrim {
  opacity: 0;
}

/* Phones: the full-screen panel rises slightly into place */
.qa-enter-from .qa-sheet,
.qa-leave-to .qa-sheet {
  transform: translate3d(0, 2.5rem, 0);
  opacity: 0;
}

/* Larger screens: the card fades in with a short lift */
@media (min-width: 640px) {
  .qa-enter-from .qa-sheet,
  .qa-leave-to .qa-sheet {
    transform: translate3d(0, 10px, 0) scale(0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  .qa-enter-active .qa-sheet,
  .qa-leave-active .qa-sheet,
  .qa-sheet.is-shaking,
  .qa-amount.is-filled {
    transition: none;
    animation: none;
  }
}
</style>
