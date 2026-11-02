<script setup lang="ts">
import { useUiStore } from '@/stores/ui'
import { AlertCircle, AlertTriangle, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const ui = useUiStore()

function handleConfirm() {
  ui.resolveConfirm(true)
}

function handleCancel() {
  ui.resolveConfirm(false)
}
</script>

<template>
  <transition name="fade">
    <div
      v-if="ui.confirmState.isOpen"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      @click.self="handleCancel"
    >
      <div 
        class="pwa-modal-safe bg-bg-elevated border-border-default w-full max-w-sm rounded-[1.25rem] border p-6 shadow-2xl relative animate-in zoom-in-95 duration-200"
      >
        <button
          @click="handleCancel"
          class="absolute right-4 top-4 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <X :size="18" />
        </button>

        <div class="mb-5 flex flex-col items-center text-center">
          <div 
             class="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
             :class="ui.confirmState.options.danger ? 'bg-error/10 text-error' : 'bg-accent/10 text-accent'"
          >
            <AlertCircle v-if="!ui.confirmState.options.danger" :size="28" />
            <AlertTriangle v-else :size="28" />
          </div>
          <h2 class="text-xl font-bold tracking-tight mb-2">{{ ui.confirmState.options.title }}</h2>
          <p class="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">
            {{ ui.confirmState.options.message }}
          </p>
        </div>

        <div class="flex gap-3">
          <button
            @click="handleCancel"
            class="btn-secondary flex-1 justify-center py-2.5"
          >
            {{ ui.confirmState.options.cancelText || t('common.cancel') }}
          </button>
          <button
            @click="handleConfirm"
            class="btn-primary flex-1 justify-center py-2.5"
            :class="ui.confirmState.options.danger ? '!bg-error !text-white !border-error hover:!bg-error/90' : ''"
          >
            {{ ui.confirmState.options.confirmText || t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
