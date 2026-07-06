<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clock } from 'lucide-vue-next'
import { useEventListener } from '@/composables/useEventListener'

const props = defineProps<{
  modelValue: string // 'HH:mm'
  label?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const { t } = useI18n()

const showPicker = ref(false)
const pickerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})
const dropdownId = `ctp-${Math.random().toString(36).substring(2, 8)}`

const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

const selectedHour = ref('09')
const selectedMinute = ref('00')

watch(() => props.modelValue, (val) => {
  if (val && val.includes(':')) {
    const [h, m] = val.split(':')
    selectedHour.value = h
    selectedMinute.value = m
  }
}, { immediate: true })

// ─── Position calculation ─────────────────────────
function updateDropdownPosition() {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const dropdownH = 220
  const dropdownW = Math.max(rect.width, 192) // min-w-[12rem] = 192px
  const spaceAbove = rect.top
  const spaceBelow = window.innerHeight - rect.bottom

  let top: number
  if (spaceAbove >= dropdownH || spaceAbove > spaceBelow) {
    top = rect.top - dropdownH - 8
    if (top < 4) top = 4
  } else {
    top = rect.bottom + 8
  }

  let left = rect.left
  if (left + dropdownW > window.innerWidth - 8) left = window.innerWidth - dropdownW - 8
  if (left < 8) left = 8

  dropdownStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${dropdownW}px`,
    zIndex: '9999',
  }
}

function onScrollOrResize() {
  if (showPicker.value) updateDropdownPosition()
}
useEventListener(window, 'scroll', onScrollOrResize, true)
useEventListener(window, 'resize', onScrollOrResize)

function togglePicker() {
  showPicker.value = !showPicker.value
  if (showPicker.value) {
    if (!props.modelValue) {
      selectedHour.value = '09'
      selectedMinute.value = '00'
    }
    nextTick(() => updateDropdownPosition())
  }
}

useEventListener(document, 'click', (e: MouseEvent) => {
  const target = e.target as Node
  if (pickerRef.value && !pickerRef.value.contains(target)) {
    const dropdown = document.getElementById(dropdownId)
    if (dropdown && dropdown.contains(target)) return
    showPicker.value = false
  }
})

function applyTime() {
  emit('update:modelValue', `${selectedHour.value}:${selectedMinute.value}`)
  showPicker.value = false
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
        {{ modelValue ? modelValue : (placeholder || '00:00') }}
      </span>
      <Clock :size="16" class="text-text-tertiary shrink-0" />
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
        class="rounded-xl border border-border-default bg-bg-elevated p-3 shadow-2xl flex flex-col gap-3"
        @click.stop
      >
        <div class="flex items-center gap-2 h-32">
          <!-- Hours Column -->
          <div class="flex-1 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory rounded-lg border border-border-subtle bg-bg-surface">
            <button
              v-for="h in hoursList"
              :key="'h'+h"
              type="button"
              class="w-full h-8 flex items-center justify-center text-sm font-medium transition-colors snap-center"
              :class="selectedHour === h ? 'bg-accent/15 text-accent font-bold' : 'text-text-secondary hover:bg-bg-hover'"
              @click="selectedHour = h"
            >
              {{ h }}
            </button>
          </div>
          <span class="text-text-primary font-bold">:</span>
          <!-- Minutes Column -->
          <div class="flex-1 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory rounded-lg border border-border-subtle bg-bg-surface">
            <button
              v-for="m in minutesList"
              :key="'m'+m"
              type="button"
              class="w-full h-8 flex items-center justify-center text-sm font-medium transition-colors snap-center"
              :class="selectedMinute === m ? 'bg-accent/15 text-accent font-bold' : 'text-text-secondary hover:bg-bg-hover'"
              @click="selectedMinute = m"
            >
              {{ m }}
            </button>
          </div>
        </div>

        <button
          type="button"
          class="w-full py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
          @click="applyTime"
        >
          {{ t('common.confirm') }}
        </button>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
