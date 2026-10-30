<script setup lang="ts">
import { ref } from 'vue'
import { X, Heart, Copy, Check } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import qrImage from '@/assets/images/qr-coffee.png'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const copied = ref(false)
const accountNumber = '0623 8505 201'

async function copyAccount() {
  try {
    await navigator.clipboard.writeText(accountNumber.replace(/\s/g, ''))
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}
</script>

<template>
  <transition name="modal">
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        @click="emit('close')"
      ></div>

      <!-- Modal Content -->
      <div 
        class="relative w-full max-w-md overflow-hidden rounded-3xl bg-bg-primary shadow-2xl ring-1 ring-white/10 transition-all transform mt-16"
      >
        <!-- Header background -->
        <div class="h-32 w-full bg-gradient-to-br from-accent/20 to-accent/5 absolute top-0 left-0">
          <div class="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
        </div>

        <button 
          @click="emit('close')"
          class="absolute top-4 right-4 z-10 rounded-full p-2 text-text-secondary hover:bg-bg-tertiary transition-colors"
        >
          <X class="h-5 w-5" />
        </button>

        <!-- Body -->
        <div class="relative pt-8 pb-8 px-6 flex flex-col items-center text-center mt-6">
          <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-accent shadow-xl backdrop-blur-md ring-1 ring-accent/30 rotate-3">
            <Heart class="h-8 w-8 fill-accent animate-pulse" />
          </div>

          <h3 class="text-xl font-bold text-text-primary mb-2">{{ t('coffee.title') }}</h3>
          <p class="text-sm text-text-secondary mb-6 px-4">
            {{ t('coffee.desc') }}
          </p>

          <!-- QR Code Container -->
          <div class="mb-6 w-56 h-56 mx-auto flex items-center justify-center rounded-2xl overflow-hidden shadow-md ring-1 ring-border-subtle/30">
            <img :src="qrImage" alt="QR Code" class="w-full h-full object-contain scale-[1.02]" />
          </div>

          <!-- Bank Details -->
          <div class="w-full bg-bg-secondary rounded-2xl p-4 text-left border border-border-default/50">
            <div class="text-xs text-text-tertiary uppercase font-semibold tracking-wider mb-1">{{ t('coffee.bankName') }}</div>
            <div class="text-sm font-medium text-text-primary mb-3">{{ t('coffee.accountName') }}</div>
            
            <div class="flex items-center justify-between bg-bg-tertiary/50 p-3 rounded-xl border border-border-subtle/50 group cursor-pointer hover:bg-bg-tertiary transition-colors" @click="copyAccount">
              <span class="font-mono text-text-primary tracking-widest">{{ accountNumber }}</span>
              <button class="text-text-secondary group-hover:text-accent transition-colors">
                <Check v-if="copied" class="h-4 w-4 text-success" />
                <Copy v-else class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .transform {
  transform: scale(0.9) translateY(20px);
}
.modal-leave-to .transform {
  transform: scale(0.9) translateY(20px);
}
</style>
