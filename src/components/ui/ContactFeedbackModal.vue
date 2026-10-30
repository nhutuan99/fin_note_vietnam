<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, Send, MessageSquare } from 'lucide-vue-next'
import { httpClient } from '@/shared/api/httpClient'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()
const ui = useUiStore()

const subject = ref('')
const message = ref('')
const loading = ref(false)

watch(() => props.show, (v) => {
  if (v) {
    subject.value = ''
    message.value = ''
  }
})

const canSubmit = computed(() => subject.value.trim() && message.value.trim() && !loading.value)

async function submitFeedback() {
  if (!canSubmit.value) {
    ui.showToast('error', t('contact.requiredError'))
    return
  }

  loading.value = true
  try {
    const res = await httpClient.post<{ message: string }>('/api/contact-feedback', {
      subject: subject.value,
      message: message.value,
    })

    ui.showToast('success', res?.message || t('contact.success'))
    subject.value = ''
    message.value = ''
    emit('close')
  } catch (err: any) {
    ui.showToast('error', err.message || t('contact.error'))
  } finally {
    loading.value = false
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
        class="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-bg-primary shadow-2xl ring-1 ring-white/10 transition-all transform"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border-default px-6 py-4 bg-bg-secondary/50 sticky top-0 z-10">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
              <MessageSquare class="h-5 w-5" />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">{{ t('contact.modalTitle') }}</h3>
          </div>
          <button 
            @click="emit('close')"
            class="rounded-full p-2 text-text-secondary hover:bg-bg-tertiary transition-colors"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5">
          <p class="text-sm text-text-secondary">
            {{ t('contact.modalDesc') }}
          </p>



          <div class="space-y-4">
            <!-- Subject -->
            <div>
              <label class="block text-sm font-medium text-text-primary mb-1.5">{{ t('contact.subjectLabel') }} <span class="text-danger">*</span></label>
              <input 
                v-model="subject"
                type="text"
                :placeholder="t('contact.subjectPlaceholder')"
                class="w-full rounded-xl bg-bg-tertiary/50 border border-border-default/50 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:bg-bg-secondary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all"
                :disabled="loading"
              />
            </div>

            <!-- Message -->
            <div>
              <label class="block text-sm font-medium text-text-primary mb-1.5">{{ t('contact.messageLabel') }} <span class="text-danger">*</span></label>
              <textarea 
                v-model="message"
                rows="5"
                :placeholder="t('contact.messagePlaceholder')"
                class="w-full rounded-xl bg-bg-tertiary/50 border border-border-default/50 px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:bg-bg-secondary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all resize-none"
                :disabled="loading"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4 bg-bg-secondary/50 sticky bottom-0">
          <button 
            @click="emit('close')"
            class="btn-secondary"
            :disabled="loading"
          >
            {{ t('common.cancel') }}
          </button>
          <button 
            @click="submitFeedback"
            class="btn-primary"
            :disabled="!canSubmit"
          >
            <AppSpinner v-if="loading" :size="16" class="mr-2" />
            <Send v-else class="h-4 w-4 mr-2" />
            {{ t('contact.submitBtn') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .transform {
  transform: scale(0.95) translateY(10px);
}
.modal-leave-to .transform {
  transform: scale(0.95) translateY(10px);
}
</style>
