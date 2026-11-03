<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Bell, Pencil, Trash2, Repeat, Clock, ArrowDownLeft, ArrowUpRight, Zap, X } from 'lucide-vue-next'
import type { Routine, RoutineInput, RoutineRepeat, RecurringTransaction } from '@/types'
import { useRoutinesStore, type RoutineItem } from '@/stores/routines'
import { useFinanceStore } from '@/stores/finance'
import { useQuickAddStore } from '@/stores/quickAdd'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { usePushNotifications } from '@/composables/usePushNotifications'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatVND, getCategoryConfig } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'
import CurrencyInput from '@/components/ui/CurrencyInput.vue'

/**
 * Routines: recurring money in/out with a push reminder at a set time.
 * Unanswered by the end of the day → recorded automatically (unless set to remind only).
 */
const { t, locale } = useI18n()
const store = useRoutinesStore()
const finance = useFinanceStore()
const quickAdd = useQuickAddStore()
const ui = useUiStore()
const push = usePushNotifications()
// Reminders and auto-recording run on the server: guests can't create routines
const isGuest = useAuthStore().isGuest

onMounted(() => {
  if (!finance.wallets.length) void finance.fetchWallets()
  void store.fetchInbox()
})

// ── Push opt-in ──
const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
const showPushBanner = computed(
  () => store.routines.length > 0 && push.isSupported.value && !push.isSubscribed.value && push.permissionState.value !== 'denied'
)

// ── Form ──
const AUTO_ONLY = new Set(['bank_transfer', 'bank_receive', 'bank_fee'])
const TIME_PRESETS = ['07:00', '12:00', '18:00', '21:00']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WORKDAYS = [1, 2, 3, 4, 5]

type RepeatMode = 'daily' | 'workdays' | 'custom' | 'monthly'

const PRESETS: (Partial<RoutineInput> & { name: string; repeatMode?: RepeatMode })[] = [
  { name: 'Ăn sáng', type: 'expense', category: 'food', amount: 30_000, time: '07:00' },
  { name: 'Cà phê', type: 'expense', category: 'food', amount: 25_000, time: '09:00' },
  { name: 'Ăn trưa', type: 'expense', category: 'food', amount: 50_000, time: '12:00' },
  { name: 'Gửi xe', type: 'expense', category: 'transport', amount: 5_000, time: '08:00', repeatMode: 'workdays' },
  { name: 'Tiền nhà', type: 'expense', category: 'rent', amount: 5_000_000, time: '09:00', repeatMode: 'monthly' },
  { name: 'Lương', type: 'income', category: 'salary', amount: 15_000_000, time: '09:00', repeatMode: 'monthly' }
]

const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

function blankForm() {
  return {
    name: '',
    type: 'expense' as 'income' | 'expense',
    amount: 0,
    category: 'food',
    walletId: finance.cashWallets[0]?.id ?? '',
    note: '',
    repeatMode: 'daily' as RepeatMode,
    days: [...WORKDAYS],
    monthDay: new Date().getDate(),
    time: '07:00',
    onMissed: 'record' as 'record' | 'skip'
  }
}
const form = ref(blankForm())

const categories = computed(() =>
  (form.value.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).filter((c) => !AUTO_ONLY.has(c.key))
)

function openCreate() {
  editingId.value = null
  form.value = blankForm()
  showForm.value = true
}

function openEdit(r: Routine) {
  editingId.value = r.id
  const workdays = r.repeat.kind === 'weekdays' && r.repeat.days.join() === WORKDAYS.join()
  form.value = {
    ...blankForm(),
    name: r.name,
    type: r.type,
    amount: r.amount,
    category: r.category,
    walletId: r.walletId,
    note: r.note,
    repeatMode: r.repeat.kind === 'daily' ? 'daily' : r.repeat.kind === 'monthly' ? 'monthly' : workdays ? 'workdays' : 'custom',
    days: r.repeat.kind === 'weekdays' ? [...r.repeat.days] : [...WORKDAYS],
    monthDay: r.repeat.kind === 'monthly' ? r.repeat.day : new Date().getDate(),
    time: r.time,
    onMissed: r.onMissed
  }
  showForm.value = true
}

function applyPreset(p: (typeof PRESETS)[number]) {
  form.value = {
    ...form.value,
    name: p.name,
    type: p.type ?? form.value.type,
    category: p.category ?? form.value.category,
    amount: p.amount ?? form.value.amount,
    time: p.time ?? form.value.time,
    repeatMode: p.repeatMode ?? 'daily'
  }
}

function setType(type: 'income' | 'expense') {
  if (form.value.type === type) return
  form.value.type = type
  form.value.category = type === 'income' ? 'salary' : 'food'
}

function toggleDay(d: number) {
  const days = form.value.days
  form.value.days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()
}

/** <input type="time"> with 15-minute steps; typed values are snapped to the slot */
function setTime(value: string) {
  const [h, m] = value.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return
  form.value.time = `${String(h).padStart(2, '0')}:${String(m - (m % 15)).padStart(2, '0')}`
}

function buildRepeat(): RoutineRepeat | null {
  const f = form.value
  if (f.repeatMode === 'daily') return { kind: 'daily' }
  if (f.repeatMode === 'workdays') return { kind: 'weekdays', days: [...WORKDAYS] }
  if (f.repeatMode === 'monthly') return f.monthDay >= 1 && f.monthDay <= 31 ? { kind: 'monthly', day: f.monthDay } : null
  return f.days.length ? { kind: 'weekdays', days: f.days } : null
}

const canSave = computed(() => !!form.value.name.trim() && form.value.amount > 0 && !!form.value.walletId && !!buildRepeat())

async function save() {
  if (!canSave.value || saving.value) return
  saving.value = true
  const f = form.value
  // Same shorthand as quick add: "30" means 30.000 đ
  if (f.amount < 1000) f.amount *= 1000
  const input: RoutineInput = {
    name: f.name.trim(),
    type: f.type,
    amount: f.amount,
    category: f.category,
    walletId: f.walletId,
    note: f.note.trim(),
    repeat: buildRepeat()!,
    time: f.time,
    onMissed: f.onMissed
  }
  try {
    if (editingId.value) {
      await store.update(editingId.value, input)
      ui.showToast('success', t('routine.saved'))
    } else {
      await store.create(input)
      ui.showToast('success', t('routine.created', { name: input.name }))
    }
    showForm.value = false
  } catch {
    // httpClient already showed the error
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(r: Routine) {
  await store.update(r.id, { enabled: !r.enabled })
}

async function remove(r: Routine) {
  const ok = await ui.requestConfirm({
    title: t('routine.deleteTitle'),
    message: t('routine.deleteMessage'),
    danger: true,
    confirmText: t('common.delete')
  })
  if (ok) await store.remove(r.id)
}

// ── Display helpers ──
const dayName = (d: number) => t(`routine.d${d}`)

function scheduleLabel(r: Routine) {
  const rep = r.repeat
  const when =
    rep.kind === 'daily'
      ? t('routine.scheduleDaily')
      : rep.kind === 'monthly'
        ? t('routine.scheduleMonthly', { day: rep.day })
        : rep.days.join() === WORKDAYS.join()
          ? t('routine.scheduleWorkdays')
          : WEEK_ORDER.filter((d) => rep.days.includes(d)).map(dayName).join(', ')
  return `${when} · ${r.time}`
}

const localeTag = computed(() => (locale.value === 'vi' ? 'vi-VN' : 'en-GB'))

function relativeDay(date: Date) {
  const today = new Date()
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((startOf(date) - startOf(today)) / 86_400_000)
  if (diff === 0) return t('routine.today')
  if (diff === 1) return t('routine.tomorrow')
  return date.toLocaleDateString(localeTag.value, { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function nextLabel(r: Routine) {
  if (!r.nextDueAt) return ''
  const d = new Date(r.nextDueAt)
  return t('routine.next', { when: `${relativeDay(d)} ${d.toLocaleTimeString(localeTag.value, { hour: '2-digit', minute: '2-digit' })}` })
}

function occurrenceDay(date: string) {
  return relativeDay(new Date(`${date}T00:00:00`))
}

const signedMoney = (type: 'income' | 'expense', amount: number) => `${type === 'income' ? '+' : '−'}${formatVND(amount)}`

const monthlyEstimate = computed(() =>
  store.routines.reduce((sum, r) => {
    if (!r.enabled) return sum
    const perMonth = r.repeat.kind === 'daily' ? 30 : r.repeat.kind === 'monthly' ? 1 : r.repeat.days.length * 4.33
    return sum + (r.type === 'income' ? 1 : -1) * Math.round(r.amount * perMonth)
  }, 0)
)

function walletOf(id: string) {
  return finance.wallets.find((w) => w.id === id)
}

function walletLogo(id: string) {
  const w = walletOf(id)
  return w ? w.customLogoUrl || getWalletBrand(w.name)?.logoUrl || '' : ''
}

// ── Waiting items ──
function openInPopup(item: RoutineItem) {
  store.queue = [item]
  quickAdd.open('routine')
}

async function quickRecord(item: RoutineItem) {
  const { occurrence, routine } = item
  try {
    await store.confirm(occurrence.id, {
      amount: occurrence.amount,
      walletId: routine.walletId,
      category: routine.category,
      note: routine.note || routine.name
    })
    ui.showToast('success', t('routine.confirmed', { amount: formatVND(occurrence.amount), name: routine.name }))
  } catch {
    /* toast shown by httpClient */
  }
}

async function quickSkip(item: RoutineItem) {
  try {
    await store.skip(item.occurrence.id)
    ui.showToast('info', t(item.occurrence.status === 'auto' ? 'routine.undone' : 'routine.skipped', { name: item.routine.name }))
  } catch {
    /* toast shown by httpClient */
  }
}

// ── Old "recurring" items (browser-only, never executed) → routines ──
const LEGACY_KEY = 'finnote_recurring'
const legacy = ref<RecurringTransaction[]>(readLegacy())
const importing = ref(false)

function readLegacy(): RecurringTransaction[] {
  try {
    return (JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]') as RecurringTransaction[]).filter((i) => i.frequency !== 'yearly')
  } catch {
    return []
  }
}

async function importLegacy() {
  importing.value = true
  let n = 0
  for (const item of legacy.value) {
    const start = new Date(`${item.nextDate}T00:00:00`)
    const repeat: RoutineRepeat =
      item.frequency === 'daily'
        ? { kind: 'daily' }
        : item.frequency === 'weekly'
          ? { kind: 'weekdays', days: [start.getDay()] }
          : { kind: 'monthly', day: start.getDate() }
    const walletId = finance.cashWallets.some((w) => w.id === item.walletId) ? item.walletId : finance.cashWallets[0]?.id
    if (!walletId) continue
    try {
      await store.create({
        name: item.note || t(`categories.${item.category}`),
        type: item.type,
        amount: item.amount,
        category: item.category,
        walletId,
        note: item.note,
        repeat,
        time: '09:00',
        onMissed: 'record'
      })
      n++
    } catch {
      /* keep going */
    }
  }
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
  legacy.value = []
  importing.value = false
  ui.showToast('success', t('routine.imported', { n }))
}
</script>

<template>
  <div class="mx-auto max-w-[64rem]">
    <!-- Header -->
    <div class="mb-6 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('routine.title') }}</h1>
        <p class="text-text-tertiary mt-1 text-sm">{{ t('routine.subtitle') }}</p>
      </div>
      <button v-if="!isGuest" class="btn-primary shrink-0" @click="openCreate">
        <Plus :size="16" />
        <span class="hidden sm:inline">{{ t('routine.add') }}</span>
      </button>
    </div>

    <div v-if="isGuest" class="rt-banner mb-4">
      <div class="rt-banner__icon"><Bell :size="18" /></div>
      <div class="min-w-0 flex-1 text-sm">{{ t('routine.guestHint') }}</div>
    </div>

    <!-- Push opt-in -->
    <div v-if="showPushBanner" class="rt-banner rt-banner--accent mb-4">
      <div class="rt-banner__icon"><Bell :size="18" /></div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">{{ t('routine.pushTitle') }}</div>
        <div class="text-text-tertiary mt-0.5 text-xs">
          {{ isIos && !push.isStandalone.value ? t('routine.pushIosHint') : t('routine.pushHint') }}
        </div>
      </div>
      <button
        v-if="!isIos || push.isStandalone.value"
        class="btn-primary shrink-0 py-2 text-xs"
        :disabled="push.loading.value"
        @click="push.subscribe()"
      >
        {{ t('routine.pushEnable') }}
      </button>
    </div>

    <!-- Old recurring items -->
    <div v-if="legacy.length" class="rt-banner mb-4">
      <div class="rt-banner__icon"><Repeat :size="18" /></div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">{{ t('routine.importTitle', { n: legacy.length }) }}</div>
        <div class="text-text-tertiary mt-0.5 text-xs">{{ t('routine.importHint') }}</div>
      </div>
      <button class="btn-primary shrink-0 py-2 text-xs" :disabled="importing" @click="importLegacy">
        {{ t('routine.importAction') }}
      </button>
    </div>

    <!-- Waiting for the user -->
    <section v-if="store.attention.length" class="mb-6">
      <h2 class="rt-section-title">{{ t('routine.pendingTitle') }}</h2>
      <div class="space-y-2">
        <div v-for="item in store.attention" :key="item.occurrence.id" class="rt-pending">
          <button class="rt-pending__main" @click="openInPopup(item)">
            <span class="rt-emoji font-emoji">{{ getCategoryConfig(item.routine.category).icon }}</span>
            <span class="min-w-0 flex-1 text-left">
              <span class="block truncate text-sm font-semibold">{{ item.routine.name }}</span>
              <span class="text-text-tertiary block text-xs">
                {{ occurrenceDay(item.occurrence.date) }}
                <template v-if="item.occurrence.status === 'auto'"> · <span class="text-warning">{{ t('routine.autoTitle') }}</span></template>
              </span>
            </span>
            <span class="text-sm font-bold tabular-nums" :class="item.routine.type === 'income' ? 'text-success' : 'text-error'">
              {{ signedMoney(item.routine.type, item.occurrence.amount) }}
            </span>
          </button>
          <div class="rt-pending__actions">
            <template v-if="item.occurrence.status === 'pending'">
              <button class="rt-chip-btn" @click="quickSkip(item)">{{ t('routine.skip') }}</button>
              <button class="rt-chip-btn rt-chip-btn--primary" @click="quickRecord(item)">{{ t('routine.record') }}</button>
            </template>
            <template v-else>
              <button class="rt-chip-btn" @click="quickSkip(item)">{{ t('routine.undo') }}</button>
              <button class="rt-chip-btn rt-chip-btn--primary" @click="openInPopup(item)">{{ t('routine.review') }}</button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Create / edit -->
    <transition name="expand">
      <div v-if="showForm" class="rt-form mb-6">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold">{{ editingId ? t('routine.editTitle') : t('routine.newTitle') }}</h3>
          <button class="rt-icon-btn" :aria-label="t('common.close')" @click="showForm = false"><X :size="16" /></button>
        </div>

        <div class="flex flex-col gap-5">
          <!-- Presets -->
          <div v-if="!editingId">
            <div class="rt-label">{{ t('routine.presets') }}</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="p in PRESETS"
                :key="p.name"
                class="rt-chip"
                :class="{ 'is-active': form.name === p.name }"
                @click="applyPreset(p)"
              >
                <span class="font-emoji">{{ getCategoryConfig(p.category!).icon }}</span> {{ p.name }}
              </button>
            </div>
          </div>

          <!-- Name + type -->
          <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input v-model="form.name" maxlength="60" class="rt-input" :placeholder="t('routine.namePlaceholder')" :aria-label="t('routine.name')" />
            <div class="rt-seg" role="tablist">
              <button role="tab" class="rt-seg__btn" :class="{ 'is-active is-income': form.type === 'income' }" @click="setType('income')">
                <ArrowDownLeft :size="14" /> {{ t('quickAdd.moneyIn') }}
              </button>
              <button role="tab" class="rt-seg__btn" :class="{ 'is-active is-expense': form.type === 'expense' }" @click="setType('expense')">
                <ArrowUpRight :size="14" /> {{ t('quickAdd.moneyOut') }}
              </button>
            </div>
          </div>

          <!-- Amount -->
          <div>
            <div class="rt-label">{{ t('routine.amount') }}</div>
            <div class="relative">
              <CurrencyInput v-model="form.amount" placeholder="0" class-name="rt-input rt-input--amount" />
              <span class="text-text-tertiary pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                <template v-if="form.amount > 0 && form.amount < 1000">.000 </template>đ
              </span>
            </div>
          </div>

          <!-- Wallet -->
          <div>
            <div class="rt-label">{{ t('routine.wallet') }}</div>
            <div class="rt-wallets">
              <button
                v-for="w in finance.cashWallets"
                :key="w.id"
                class="rt-wallet"
                :class="{ 'is-active': form.walletId === w.id }"
                @click="form.walletId = w.id"
              >
                <img v-if="walletLogo(w.id)" :src="walletLogo(w.id)" alt="" class="rt-wallet__logo" loading="lazy" />
                <span v-else class="rt-wallet__logo rt-wallet__logo--emoji">{{ w.icon }}</span>
                <span class="truncate">{{ w.name }}</span>
              </button>
            </div>
          </div>

          <!-- Category -->
          <div>
            <div class="rt-label">{{ t('routine.category') }}</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="c in categories"
                :key="c.key"
                class="rt-chip"
                :class="{ 'is-active': form.category === c.key }"
                @click="form.category = c.key"
              >
                <span class="font-emoji">{{ c.icon }}</span> {{ t(`categories.${c.key}`) }}
              </button>
            </div>
          </div>

          <!-- Repeat -->
          <div>
            <div class="rt-label">{{ t('routine.repeat') }}</div>
            <div class="rt-seg rt-seg--4">
              <button
                v-for="mode in (['daily', 'workdays', 'custom', 'monthly'] as const)"
                :key="mode"
                class="rt-seg__btn"
                :class="{ 'is-active': form.repeatMode === mode }"
                @click="form.repeatMode = mode"
              >
                {{ t(`routine.repeat${mode[0].toUpperCase()}${mode.slice(1)}`) }}
              </button>
            </div>
            <div v-if="form.repeatMode === 'custom'" class="mt-2 grid grid-cols-7 gap-1.5">
              <button
                v-for="d in WEEK_ORDER"
                :key="d"
                class="rt-day"
                :class="{ 'is-active': form.days.includes(d) }"
                @click="toggleDay(d)"
              >
                {{ dayName(d) }}
              </button>
            </div>
            <label v-else-if="form.repeatMode === 'monthly'" class="mt-2 flex items-center gap-3 text-sm">
              <span class="text-text-secondary">{{ t('routine.dayOfMonth') }}</span>
              <input v-model.number="form.monthDay" type="number" min="1" max="31" inputmode="numeric" class="rt-input w-20 text-center" />
            </label>
          </div>

          <!-- Time -->
          <div>
            <div class="rt-label">{{ t('routine.time') }}</div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button v-for="tp in TIME_PRESETS" :key="tp" class="rt-chip" :class="{ 'is-active': form.time === tp }" @click="form.time = tp">
                {{ tp }}
              </button>
              <label class="rt-time" :class="{ 'is-active': !TIME_PRESETS.includes(form.time) }">
                <Clock :size="14" />
                <input type="time" step="900" :value="form.time" @change="setTime(($event.target as HTMLInputElement).value)" />
              </label>
            </div>
          </div>

          <!-- When ignored -->
          <label class="rt-toggle-row">
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium">{{ t('routine.onMissed') }}</span>
              <span class="text-text-tertiary mt-0.5 block text-xs">{{ t('routine.onMissedHint') }}</span>
            </span>
            <input
              type="checkbox"
              class="rt-switch"
              :checked="form.onMissed === 'record'"
              @change="form.onMissed = ($event.target as HTMLInputElement).checked ? 'record' : 'skip'"
            />
          </label>

          <input v-model="form.note" maxlength="200" class="rt-input" :placeholder="t('routine.note')" />

          <div class="flex gap-2">
            <button class="border-border-default text-text-secondary hover:bg-bg-hover flex-1 rounded-lg border py-2.5 text-sm" @click="showForm = false">
              {{ t('common.cancel') }}
            </button>
            <button class="btn-primary flex-1 justify-center py-2.5 disabled:opacity-40" :disabled="!canSave || saving" @click="save">
              {{ editingId ? t('routine.save') : t('routine.create') }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Summary -->
    <div v-if="store.routines.length" class="rt-summary mb-4">
      <div>
        <div class="text-text-tertiary text-[0.6875rem] font-medium">{{ t('routine.monthlyEstimate') }}</div>
        <div class="text-lg font-bold tabular-nums" :class="monthlyEstimate >= 0 ? 'text-success' : 'text-error'">
          {{ monthlyEstimate >= 0 ? '+' : '−' }}{{ formatVND(Math.abs(monthlyEstimate)) }}
        </div>
      </div>
      <div class="text-text-disabled text-[0.6875rem]">{{ t('routine.activeCount', { n: store.routines.filter((r) => r.enabled).length }) }}</div>
    </div>

    <!-- Routines -->
    <div v-if="store.routines.length" class="space-y-2">
      <div v-for="r in store.routines" :key="r.id" class="rt-card" :class="{ 'is-off': !r.enabled }">
        <span class="rt-emoji font-emoji">{{ getCategoryConfig(r.category).icon }}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-semibold">{{ r.name }}</span>
            <span v-if="r.onMissed === 'record'" class="rt-tag"><Zap :size="10" /> {{ t('routine.autoRecord') }}</span>
          </div>
          <div class="text-text-tertiary mt-0.5 truncate text-xs">
            {{ scheduleLabel(r) }}
            <template v-if="walletOf(r.walletId)"> · {{ walletOf(r.walletId)!.name }}</template>
          </div>
          <div class="text-text-disabled mt-0.5 text-[0.6875rem]">{{ r.enabled ? nextLabel(r) : t('routine.off') }}</div>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1.5">
          <span class="text-sm font-bold tabular-nums" :class="r.type === 'income' ? 'text-success' : 'text-error'">
            {{ signedMoney(r.type, r.amount) }}
          </span>
          <div class="flex items-center gap-0.5">
            <input
              type="checkbox"
              class="rt-switch rt-switch--sm"
              :checked="r.enabled"
              :aria-label="r.enabled ? t('routine.disable') : t('routine.enable')"
              @change="toggleEnabled(r)"
            />
            <button class="rt-icon-btn" :aria-label="t('routine.editTitle')" @click="openEdit(r)"><Pencil :size="14" /></button>
            <button class="rt-icon-btn hover:text-error" :aria-label="t('routine.deleteTitle')" @click="remove(r)"><Trash2 :size="14" /></button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="store.loaded && !showForm" class="rt-empty">
      <div class="rt-empty__icon"><Repeat :size="22" /></div>
      <div class="text-sm font-semibold">{{ t('routine.empty') }}</div>
      <p class="text-text-tertiary mx-auto mt-1 max-w-sm text-xs">{{ t('routine.emptyHint') }}</p>
      <button v-if="!isGuest" class="btn-primary mx-auto mt-4" @click="openCreate"><Plus :size="16" /> {{ t('routine.add') }}</button>
    </div>
  </div>
</template>

<style scoped>
.rt-section-title {
  margin-bottom: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.rt-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.875rem;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.rt-banner--accent {
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  background: color-mix(in srgb, var(--accent) 7%, var(--bg-surface));
}

.rt-banner__icon,
.rt-empty__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.625rem;
  background: var(--accent-subtle);
  color: var(--accent);
}

/* ── Waiting items ── */
.rt-pending {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.875rem;
  border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border-default));
  background: color-mix(in srgb, var(--warning) 6%, var(--bg-surface));
}

.rt-pending__main {
  display: flex;
  flex: 1 1 14rem;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.rt-pending__actions {
  display: flex;
  gap: 0.375rem;
  margin-left: auto;
}

.rt-chip-btn {
  height: 2.25rem;
  padding: 0 0.875rem;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
}

.rt-chip-btn:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.rt-chip-btn--primary {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
}

.rt-chip-btn--primary:hover {
  color: #fff;
  opacity: 0.9;
}

/* ── Cards ── */
.rt-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border-radius: 0.875rem;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  transition: border-color 0.15s, opacity 0.15s;
}

.rt-card:hover {
  border-color: var(--border-strong);
}

.rt-card.is-off {
  opacity: 0.55;
}

.rt-emoji {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  font-size: 1.25rem;
}

.rt-tag {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 999px;
  background: var(--accent-subtle);
  color: var(--accent);
  font-size: 0.625rem;
  font-weight: 600;
}

.rt-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  color: var(--text-tertiary);
  transition: background 0.15s, color 0.15s;
}

.rt-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.rt-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-radius: 0.875rem;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.rt-empty {
  padding: 3rem 1rem;
  border-radius: 1rem;
  border: 1px dashed var(--border-strong);
  text-align: center;
}

.rt-empty__icon {
  margin: 0 auto 0.75rem;
  width: 3rem;
  height: 3rem;
}

/* ── Form ── */
.rt-form {
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}

@media (min-width: 640px) {
  .rt-form {
    padding: 1.25rem;
  }
}

.rt-label {
  margin-bottom: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.rt-input,
:deep(.rt-input) {
  width: 100%;
  height: 2.75rem;
  padding: 0 0.875rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.rt-input:focus,
:deep(.rt-input:focus) {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

:deep(.rt-input--amount) {
  height: 3rem;
  padding-right: 4.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.rt-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 2.125rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.rt-chip:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.rt-chip.is-active,
.rt-day.is-active,
.rt-wallet.is-active,
.rt-time.is-active {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent);
}

.rt-seg {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 0.75rem;
  background: var(--bg-elevated);
}

.rt-seg__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  height: 2.25rem;
  padding: 0 0.75rem;
  border-radius: 0.5625rem;
  color: var(--text-tertiary);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.rt-seg__btn.is-active {
  background: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.rt-seg__btn.is-income {
  background: var(--success);
  color: #fff;
}

.rt-seg__btn.is-expense {
  background: var(--error);
  color: #fff;
}

.rt-day {
  height: 2.25rem;
  border-radius: 0.625rem;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}

.rt-wallets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 8rem), 1fr));
  gap: 0.375rem;
}

.rt-wallet {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  height: 2.75rem;
  padding: 0 0.625rem 0 0.375rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
}

.rt-wallet__logo {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.875rem;
  height: 1.875rem;
  padding: 0.1875rem;
  border-radius: 0.5rem;
  background: #fff;
  object-fit: contain;
}

.rt-wallet__logo--emoji {
  background: var(--bg-hover);
  font-size: 1rem;
}

.rt-time {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 2.125rem;
  padding: 0 0.625rem;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.rt-time input {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  outline: none;
  color-scheme: light dark;
}

.rt-toggle-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.875rem;
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  cursor: pointer;
}

/* iOS-style switch on a native checkbox (keyboard + screen reader for free) */
.rt-switch {
  position: relative;
  flex-shrink: 0;
  width: 2.75rem;
  height: 1.625rem;
  border-radius: 999px;
  background: var(--border-strong);
  appearance: none;
  cursor: pointer;
  transition: background 0.2s ease;
}

.rt-switch::after {
  content: '';
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s ease;
}

.rt-switch:checked {
  background: var(--accent);
}

.rt-switch:checked::after {
  transform: translateX(1.125rem);
}

.rt-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.rt-switch--sm {
  width: 2.25rem;
  height: 1.375rem;
  margin-right: 0.25rem;
}

.rt-switch--sm::after {
  width: 1rem;
  height: 1rem;
}

.rt-switch--sm:checked::after {
  transform: translateX(0.875rem);
}
</style>
