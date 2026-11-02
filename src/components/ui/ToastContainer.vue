<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-vue-next'

const ui = useUiStore()

const iconMap = { success: CheckCircle, error: AlertCircle, info: Info, warning: AlertTriangle }
const colorMap = {
  success: 'text-success',
  error: 'text-error',
  info: 'text-info',
  warning: 'text-warning'
}
</script>

<template>
  <div
    id="toast-container"
    class="fixed right-4 bottom-4 z-[200] flex flex-col gap-2 md:right-6 md:bottom-6"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="bg-bg-elevated border-border-default flex max-w-[26.25rem] min-w-[18.75rem] items-center gap-3 rounded-lg border px-4 py-3 shadow-lg"
      >
        <component
          :is="iconMap[toast.type]"
          :size="16"
          :class="colorMap[toast.type]"
        />
        <span class="text-text-primary flex-1 text-sm">{{ toast.message }}</span>
        <button
          class="text-text-tertiary hover:bg-bg-hover hover:text-text-primary rounded p-0.5 transition-all duration-150"
          @click="ui.removeToast(toast.id)"
        >
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style>
.toast-enter-active,
.toast-leave-active {
  transition:
    transform 300ms ease,
    opacity 300ms ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(0.75rem);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-0.75rem);
}
</style>
