<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: number | string | null
  placeholder?: string
  className?: string
  allowNegative?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

// Internal display string (raw text user sees while typing)
const displayValue = ref('')

// Format a number to vi-VN locale string (e.g., 5000 → 5.000)
function formatNum(num: number): string {
  if (isNaN(num) || num === 0) return ''
  return new Intl.NumberFormat('vi-VN').format(Math.abs(num))
}

// Parse display string to raw number
function parseDisplay(str: string): number {
  const isNeg = str.startsWith('-')
  const raw = str.replace(/[^0-9]/g, '')
  const num = parseInt(raw || '0', 10)
  return isNeg && props.allowNegative ? -num : num
}

// Sync display when modelValue changes externally
watch(
  () => props.modelValue,
  (val) => {
    const num = Number(val ?? 0)
    if (num === parseDisplay(displayValue.value)) return
    displayValue.value = num < 0
      ? '-' + formatNum(num)
      : formatNum(num)
  },
  { immediate: true }
)

function handleInput(e: Event) {
  const input = e.target as HTMLInputElement
  const raw = input.value

  // Allow leading minus sign when allowNegative
  const isNeg = props.allowNegative && raw.startsWith('-')
  const digits = raw.replace(/[^0-9]/g, '')
  const num = parseInt(digits || '0', 10)
  const finalNum = isNeg ? -num : num

  // Update formatted display
  const formatted = digits ? (isNeg ? '-' : '') + new Intl.NumberFormat('vi-VN').format(num) : (isNeg ? '-' : '')
  displayValue.value = formatted
  input.value = formatted

  emit('update:modelValue', finalNum)
}

function blockNonNumeric(e: KeyboardEvent) {
  const allowed = [
    'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'
  ]
  if (allowed.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) return
  // Allow minus at start when allowNegative
  if (e.key === '-' && props.allowNegative && (e.target as HTMLInputElement).selectionStart === 0) return
  if (!/^\d$/.test(e.key)) {
    e.preventDefault()
  }
}
</script>

<template>
  <input
    :value="displayValue"
    @input="handleInput"
    @keydown="blockNonNumeric"
    type="tel"
    inputmode="numeric"
    pattern="[0-9]*"
    :placeholder="placeholder || '0'"
    :class="className"
  />
</template>
