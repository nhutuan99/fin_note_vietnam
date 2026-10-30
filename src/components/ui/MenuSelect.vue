<script setup lang="ts" generic="T extends string">
import { computed, nextTick, ref, type Component } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import { useEventListener } from '@/composables/useEventListener'

/**
 * Compact toolbar dropdown (button + popover listbox) used instead of a native <select>,
 * which renders with OS styling and can't follow the app theme.
 */
const props = withDefaults(
  defineProps<{
    modelValue: T
    options: { value: T; label: string }[]
    label: string
    icon?: Component
    align?: 'left' | 'right'
  }>(),
  { align: 'left', icon: undefined }
)

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const open = ref(false)
const activeIndex = ref(0)
const rootRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLButtonElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const listId = `menu-select-${Math.random().toString(36).slice(2, 8)}`

const current = computed(() => props.options.find((o) => o.value === props.modelValue))

function openMenu() {
  activeIndex.value = Math.max(0, props.options.findIndex((o) => o.value === props.modelValue))
  open.value = true
  nextTick(() => listRef.value?.focus())
}

function close(refocus = false) {
  open.value = false
  if (refocus) buttonRef.value?.focus()
}

function choose(value: T) {
  emit('update:modelValue', value)
  close(true)
}

function handleButtonKeydown(e: KeyboardEvent) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
    e.preventDefault()
    openMenu()
  }
}

function handleListKeydown(e: KeyboardEvent) {
  const count = props.options.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % count
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + count) % count
  } else if (e.key === 'Home') {
    e.preventDefault()
    activeIndex.value = 0
  } else if (e.key === 'End') {
    e.preventDefault()
    activeIndex.value = count - 1
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    choose(props.options[activeIndex.value].value)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close(true)
  } else if (e.key === 'Tab') {
    close()
  }
}

useEventListener(document, 'pointerdown', (e: PointerEvent) => {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target as Node)) close()
})
</script>

<template>
  <div ref="rootRef" class="menu-select">
    <button
      ref="buttonRef"
      type="button"
      class="menu-select__button"
      :class="{ 'is-open': open }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-label="`${label}: ${current?.label ?? ''}`"
      :title="label"
      @click="open ? close() : openMenu()"
      @keydown="handleButtonKeydown"
    >
      <component :is="icon" v-if="icon" :size="15" class="menu-select__icon" />
      <span class="menu-select__value">{{ current?.label }}</span>
      <ChevronDown :size="14" class="menu-select__chevron" />
    </button>

    <Transition name="menu-select">
      <div
        v-if="open"
        :id="listId"
        ref="listRef"
        class="menu-select__list"
        :class="`menu-select__list--${align}`"
        role="listbox"
        tabindex="-1"
        :aria-label="label"
        :aria-activedescendant="`${listId}-${activeIndex}`"
        @keydown="handleListKeydown"
      >
        <div class="menu-select__heading">{{ label }}</div>
        <div
          v-for="(opt, i) in options"
          :id="`${listId}-${i}`"
          :key="opt.value"
          role="option"
          :aria-selected="opt.value === modelValue"
          class="menu-select__option"
          :class="{ 'is-active': i === activeIndex, 'is-selected': opt.value === modelValue }"
          @pointerenter="activeIndex = i"
          @click="choose(opt.value)"
        >
          <span>{{ opt.label }}</span>
          <Check v-if="opt.value === modelValue" :size="15" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.menu-select {
  position: relative;
  flex-shrink: 0;
}

.menu-select__button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.5rem;
  padding: 0 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  white-space: nowrap;
  transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}

.menu-select__button:hover,
.menu-select__button.is-open {
  border-color: var(--border-strong);
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.menu-select__button:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.menu-select__icon {
  color: var(--text-tertiary);
}

.menu-select__chevron {
  color: var(--text-tertiary);
  transition: transform var(--transition-fast);
}

.is-open .menu-select__chevron {
  transform: rotate(180deg);
}

.menu-select__list {
  position: absolute;
  top: calc(100% + 6px);
  z-index: 40;
  min-width: 11rem;
  padding: 0.375rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.menu-select__list--left {
  left: 0;
}

.menu-select__list--right {
  right: 0;
}

.menu-select__heading {
  padding: 0.25rem 0.625rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.menu-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.menu-select__option.is-active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.menu-select__option.is-selected {
  color: var(--accent);
  font-weight: 500;
}

.menu-select-enter-active,
.menu-select-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.menu-select-enter-from,
.menu-select-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
