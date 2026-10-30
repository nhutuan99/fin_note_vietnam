<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-vue-next'
import { useEventListener } from '@/composables/useEventListener'

const props = defineProps<{
  modelValue: string // 'YYYY-MM-DD'
  label?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const { t, tm } = useI18n()

// ─── State ────────────────────────────────────────
const showPicker = ref(false)
const pickerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

// View mode: 'days' (default) | 'months' (pick month+year)
const viewMode = ref<'days' | 'months'>('days')

const today = new Date()
const currentMonth = ref(today.getMonth())
const currentYear = ref(today.getFullYear())
// For year page navigation in month view
const yearPage = ref(today.getFullYear())

// ─── Sync view to selected value ──────────────────
watch(() => props.modelValue, (val) => {
  if (val) {
    const [y, m] = val.split('-').map(Number)
    currentYear.value = y
    currentMonth.value = m - 1
    yearPage.value = y
  }
}, { immediate: true })

// ─── Calendar grid ────────────────────────────────
const blankDays = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1).getDay()
  return firstDay === 0 ? 6 : firstDay - 1 // Mon-start
})

const daysInMonth = computed(() =>
  new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
)

// ─── Display helpers ──────────────────────────────
function getDisplayDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const monthNames = computed(() => tm('months') as string[])

// Short month labels that actually work for Vietnamese
// "Tháng 1" → "T1", "January" → "Jan"
const shortMonths = computed(() => {
  const full = monthNames.value
  return full.map((name, idx) => {
    // Vietnamese: "Tháng X" → "T" + number
    if (name.startsWith('Tháng')) return `T${idx + 1}`
    // English/other: take first 3 chars
    return name.substring(0, 3)
  })
})

// Week days (Mon-start)
const weekDays = computed(() => {
  const d = [...(tm('days.short') as string[])] // Sun Mon Tue … Sat
  d.push(d.shift()!) // Mon Tue … Sat Sun
  return d
})

// ─── Navigation ───────────────────────────────────
function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function pickMonth(m: number) {
  currentMonth.value = m
  currentYear.value = yearPage.value
  viewMode.value = 'days'
}

function toggleView() {
  viewMode.value = viewMode.value === 'days' ? 'months' : 'days'
  yearPage.value = currentYear.value
}

function handlePrev() {
  if (viewMode.value === 'days') {
    prevMonth()
  } else {
    yearPage.value--
  }
}

function handleNext() {
  if (viewMode.value === 'days') {
    nextMonth()
  } else {
    yearPage.value++
  }
}

// ─── Selection ────────────────────────────────────
function isSameDate(day: number) {
  if (!props.modelValue) return false
  const [y, m, d] = props.modelValue.split('-').map(Number)
  return d === day && m === currentMonth.value + 1 && y === currentYear.value
}

function isToday(day: number) {
  return day === today.getDate() &&
    currentMonth.value === today.getMonth() &&
    currentYear.value === today.getFullYear()
}

function selectDate(day: number) {
  const y = currentYear.value
  const m = String(currentMonth.value + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  emit('update:modelValue', `${y}-${m}-${d}`)
  showPicker.value = false
  viewMode.value = 'days'
}

function selectToday() {
  const d = new Date()
  const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().substring(0, 10)
  emit('update:modelValue', iso)
  currentMonth.value = d.getMonth()
  currentYear.value = d.getFullYear()
  showPicker.value = false
  viewMode.value = 'days'
}

// ─── Outside-click close ──────────────────────────
useEventListener(document, 'click', (e: MouseEvent) => {
  const target = e.target as Node
  // Check both the wrapper ref and the trigger ref
  if (pickerRef.value && !pickerRef.value.contains(target)) {
    // Also check if click is inside the teleported dropdown
    const dropdown = document.getElementById(dropdownId)
    if (dropdown && dropdown.contains(target)) return
    showPicker.value = false
    viewMode.value = 'days'
  }
})

// ─── Unique ID for the teleported dropdown ────────
const dropdownId = `cdp-${Math.random().toString(36).substring(2, 8)}`

// ─── Position calculation ─────────────────────────
function updateDropdownPosition() {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const dropdownH = 340 // approximate max height of dropdown
  const dropdownW = 280 // 17.5rem
  const spaceAbove = rect.top
  const spaceBelow = window.innerHeight - rect.bottom

  let top: number
  if (spaceAbove >= dropdownH || spaceAbove > spaceBelow) {
    // Place above
    top = rect.top - dropdownH - 8
    if (top < 4) top = 4
  } else {
    // Place below
    top = rect.bottom + 8
  }

  let left = rect.left
  if (left + dropdownW > window.innerWidth - 8) {
    left = window.innerWidth - dropdownW - 8
  }
  if (left < 8) left = 8

  dropdownStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${dropdownW}px`,
    zIndex: '9999',
  }
}

// Reposition on scroll/resize
function onScrollOrResize() {
  if (showPicker.value) updateDropdownPosition()
}
useEventListener(window, 'scroll', onScrollOrResize, true)
useEventListener(window, 'resize', onScrollOrResize)

function togglePicker() {
  showPicker.value = !showPicker.value
  if (!showPicker.value) {
    viewMode.value = 'days'
  } else {
    // Reset to selected date or today when opening
    if (props.modelValue) {
      const [y, m] = props.modelValue.split('-').map(Number)
      currentYear.value = y
      currentMonth.value = m - 1
      yearPage.value = y
    } else {
      const d = new Date()
      currentYear.value = d.getFullYear()
      currentMonth.value = d.getMonth()
      yearPage.value = d.getFullYear()
    }
    nextTick(() => updateDropdownPosition())
  }
}
</script>

<template>
  <div ref="pickerRef">
    <!-- Label -->
    <label v-if="label" class="block text-sm font-medium text-text-secondary mb-2">
      {{ label }}
    </label>

    <!-- Trigger -->
    <button
      ref="triggerRef"
      type="button"
      class="flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium text-left transition-all duration-150
             border-border-default bg-bg-surface text-text-primary
             hover:border-border-strong
             focus:border-accent focus:ring-2 focus:ring-accent-subtle focus:outline-none"
      :class="showPicker ? 'border-accent ring-2 ring-accent-subtle' : ''"
      @click="togglePicker"
    >
      <span :class="modelValue ? '' : 'text-text-disabled font-normal'">
        {{ modelValue ? getDisplayDate(modelValue) : (placeholder || t('addTx.date')) }}
      </span>
      <Calendar :size="16" class="text-text-tertiary shrink-0" />
    </button>

    <!-- Dropdown (teleported to body to escape overflow clipping) -->
    <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-[0.97]"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-[0.98]"
    >
      <div
        v-if="showPicker"
        :id="dropdownId"
        :style="dropdownStyle"
        class="rounded-xl border border-border-default bg-bg-elevated p-3.5 shadow-2xl"
        @click.stop
      >
        <!-- ════════ HEADER ════════ -->
        <div class="flex items-center justify-between mb-3">
          <!-- Prev -->
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            @click.stop="handlePrev"
          >
            <ChevronLeft :size="16" />
          </button>

          <!-- Title (clickable → toggle month/year view) -->
          <button
            type="button"
            class="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold transition-colors"
            :class="viewMode === 'months'
              ? 'bg-accent/15 text-accent'
              : 'text-text-primary hover:bg-bg-hover'"
            @click.stop="toggleView"
          >
            <template v-if="viewMode === 'days'">
              {{ monthNames[currentMonth] }} {{ currentYear }}
            </template>
            <template v-else>
              {{ yearPage }}
            </template>
          </button>

          <!-- Next -->
          <button
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            @click.stop="handleNext"
          >
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- ════════ MONTH PICKER VIEW ════════ -->
        <div v-if="viewMode === 'months'" class="grid grid-cols-4 gap-1.5">
          <button
            v-for="(label, idx) in shortMonths"
            :key="idx"
            type="button"
            class="py-2 rounded-lg text-xs font-semibold transition-all duration-100"
            :class="[
              idx === currentMonth && yearPage === currentYear
                ? 'bg-accent-subtle text-accent font-bold'
                : idx === today.getMonth() && yearPage === today.getFullYear()
                  ? 'text-accent font-bold hover:bg-bg-hover'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            ]"
            @click.stop="pickMonth(idx)"
          >
            {{ label }}
          </button>
        </div>

        <!-- ════════ DAY PICKER VIEW ════════ -->
        <template v-else>
          <!-- Weekday headers -->
          <div class="grid grid-cols-7 gap-0.5 mb-1.5">
            <span
              v-for="d in weekDays"
              :key="d"
              class="text-center text-[0.625rem] font-bold text-text-disabled tracking-wider"
            >{{ d }}</span>
          </div>

          <!-- Day grid -->
          <div class="grid grid-cols-7 gap-0.5">
            <!-- Blanks -->
            <div v-for="b in blankDays" :key="'b' + b" class="aspect-square" />
            <!-- Days -->
            <button
              v-for="day in daysInMonth"
              :key="day"
              type="button"
              class="aspect-square flex items-center justify-center rounded-lg text-[0.8125rem] font-medium transition-all duration-100"
              :class="[
                isSameDate(day)
                  ? 'bg-accent-subtle text-accent font-bold'
                  : isToday(day)
                    ? 'text-accent font-bold ring-1 ring-accent/30'
                    : 'text-text-primary hover:bg-bg-hover'
              ]"
              @click.stop="selectDate(day)"
            >{{ day }}</button>
          </div>
        </template>

        <!-- ════════ FOOTER ════════ -->
        <div class="flex gap-2 mt-3 pt-3 border-t border-border-subtle">
          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            @click.stop="selectToday"
          >
            {{ t('common.today') }}
          </button>
          <button
            type="button"
            class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            @click.stop="showPicker = false; viewMode = 'days'"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>
