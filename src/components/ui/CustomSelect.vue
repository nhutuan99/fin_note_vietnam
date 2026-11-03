<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string | number
  options: { value: string | number, label: string }[]
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

function toggle() {
  if (!props.disabled) isOpen.value = !isOpen.value
}

function selectOption(val: string | number) {
  emit('update:modelValue', val)
  isOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="relative w-full text-sm" ref="containerRef">
    <button 
      type="button"
      @click="toggle"
      :disabled="disabled"
      class="flex w-full items-center justify-between gap-2 rounded-lg border border-border-default bg-bg-elevated px-3 py-2.5 text-left text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-subtle transition-all"
      :class="{ 'opacity-50 cursor-not-allowed': disabled, 'border-accent ring-1 ring-accent-subtle': isOpen }"
    >
      <span class="min-w-0 wrap-break-word" :class="{ 'text-text-disabled': !modelValue && !options.find(o => o.value === modelValue) }">
        {{ options.find(o => o.value === modelValue)?.label || placeholder || 'Select...' }}
      </span>
      <ChevronDown class="text-text-tertiary shrink-0 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" :size="16" />
    </button>
    
    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform scale-95 opacity-0 translate-y-[-10px]"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      leave-to-class="transform scale-95 opacity-0 translate-y-[-10px]"
    >
      <div 
        v-if="isOpen" 
        class="absolute z-[100] mt-2 w-full overflow-hidden rounded-xl border border-border-default bg-bg-surface shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-h-60 overflow-y-auto custom-scrollbar"
      >
        <div class="p-1.5 flex flex-col gap-0.5">
          <button
            v-for="opt in options"
            :key="opt.value"
            type="button"
            @click="selectOption(opt.value)"
            class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
            :class="opt.value === modelValue ? 'bg-accent/15 text-accent font-semibold' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'"
          >
            <span class="min-w-0 wrap-break-word">{{ opt.label }}</span>
            <Check v-if="opt.value === modelValue" :size="16" class="shrink-0" />
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--color-border-strong);
  border-radius: 10px;
}
</style>
