<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Bug, X, Send, ImagePlus, Trash2, ArrowLeft, Sparkles, AlertCircle, Lightbulb } from 'lucide-vue-next'
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

const step = ref(1)
const title = ref('')
const description = ref('')
const reportType = ref<'bug' | 'feature'>('bug')
const loading = ref(false)
const imagePreview = ref<string | null>(null)
const imageBase64 = ref<string | null>(null)
const isDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Reset the URL/UA each time the modal opens
watch(() => props.show, (v) => {
  if (v) {
    step.value = 1
    userAgent.value = navigator.userAgent
  }
})

const userAgent = ref(navigator.userAgent)

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) processFile(input.files[0])
}

function handleDrop(e: DragEvent) {
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) processFile(file)
}

function processFile(file: File) {
  if (file.size > 2 * 1024 * 1024) {
    ui.showToast('error', t('bugReport.imageTooLarge'))
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result as string
    imagePreview.value = result
    imageBase64.value = result
  }
  reader.readAsDataURL(file)
}

function removeImage() {
  imagePreview.value = null
  imageBase64.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const canSubmit = computed(() => title.value.trim() && description.value.trim() && !loading.value)

async function submitReport() {
  if (!canSubmit.value) {
    ui.showToast('error', t('bugReport.requiredError'))
    return
  }

  loading.value = true
  try {
    const payload: Record<string, any> = {
      type: reportType.value,
      title: title.value,
      description: description.value,
      userAgent: userAgent.value,
    }
    if (imageBase64.value) {
      payload.image = imageBase64.value
    }

    const res = await httpClient.post<{ message: string }>('/api/report-bug', payload)

    ui.showToast('success', res?.message || t('bugReport.success'))
    // Reset form completely
    step.value = 1
    title.value = ''
    description.value = ''
    reportType.value = 'bug'
    removeImage()
    emit('close')
  } catch (err: any) {
    ui.showToast('error', err.message || t('bugReport.error'))
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
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10 text-danger">
              <Bug class="h-5 w-5" />
            </div>
            <h3 class="text-lg font-semibold text-text-primary">{{ t('bugReport.modalTitle') }}</h3>
          </div>
          <button 
            @click="emit('close')"
            class="rounded-full p-2 text-text-secondary hover:bg-bg-tertiary transition-colors"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5" v-if="step === 1">
          <p class="text-sm text-text-secondary">
            {{ t('bugReport.modalDesc') }}
          </p>

          <div class="space-y-4 pt-2">
            <label class="block text-sm font-medium text-text-primary">{{ t('bugReport.typeLabel') }}</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Bug Button -->
              <button 
                @click="reportType = 'bug'; step = 2"
                class="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border-default/50 bg-bg-tertiary/20 p-6 transition-all hover:border-danger/50 hover:bg-danger/5"
              >
                <div class="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger transition-transform group-hover:scale-110">
                  <AlertCircle class="h-6 w-6" />
                </div>
                <div class="text-center">
                  <h4 class="font-semibold text-text-primary group-hover:text-danger transition-colors">{{ t('bugReport.typeBug') }}</h4>
                </div>
              </button>

              <!-- Feature Button -->
              <button 
                @click="reportType = 'feature'; step = 2"
                class="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-border-default/50 bg-bg-tertiary/20 p-6 transition-all hover:border-accent/50 hover:bg-accent/5"
              >
                <div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent transition-transform group-hover:scale-110">
                  <Lightbulb class="h-6 w-6" />
                </div>
                <div class="text-center">
                  <h4 class="font-semibold text-text-primary group-hover:text-accent transition-colors">{{ t('bugReport.typeFeature') }}</h4>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div class="p-6 space-y-5" v-if="step === 2">
          <div class="flex items-center mb-2">
            <button @click="step = 1" class="flex items-center text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
              <ArrowLeft class="h-4 w-4 mr-1.5" />
              {{ t('common.back') }}
            </button>
            <div class="ml-auto flex items-center px-2.5 py-1 rounded-full text-[0.625rem] font-bold" :class="reportType === 'feature' ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger'">
              <Sparkles v-if="reportType === 'feature'" class="h-3 w-3 mr-1" />
              <Bug v-else class="h-3 w-3 mr-1" />
              {{ reportType === 'feature' ? t('bugReport.typeFeature') : t('bugReport.typeBug') }}
            </div>
          </div>

          <div class="space-y-4">
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-text-primary mb-1.5">{{ t('bugReport.titleLabel') }} <span class="text-danger">*</span></label>
              <input 
                v-model="title"
                type="text"
                :placeholder="t('bugReport.titlePlaceholder')"
                class="w-full rounded-xl bg-bg-tertiary/50 border border-border-default/50 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:bg-bg-secondary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all"
                :disabled="loading"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-text-primary mb-1.5">{{ t('bugReport.descLabel') }} <span class="text-danger">*</span></label>
              <textarea 
                v-model="description"
                rows="4"
                :placeholder="t('bugReport.descPlaceholder')"
                class="w-full rounded-xl bg-bg-tertiary/50 border border-border-default/50 px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:bg-bg-secondary focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all resize-none"
                :disabled="loading"
              ></textarea>
            </div>

            <!-- Image Upload -->
            <div>
              <label class="block text-sm font-medium text-text-primary mb-1.5">{{ t('bugReport.imageLabel') }}</label>
              
              <!-- Preview -->
              <div v-if="imagePreview" class="relative group rounded-xl overflow-hidden border border-border-default/50 mb-2">
                <img :src="imagePreview" alt="Preview" class="w-full max-h-48 object-contain bg-bg-tertiary/30" />
                <button 
                  @click="removeImage"
                  class="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-danger/80 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                  :title="t('bugReport.imageRemove')"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>

              <!-- Drop zone -->
              <div
                v-if="!imagePreview"
                class="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition-all cursor-pointer"
                :class="isDragOver ? 'border-accent bg-accent/5' : 'border-border-default/50 hover:border-accent/50 hover:bg-bg-tertiary/30'"
                @dragover.prevent="isDragOver = true"
                @dragleave="isDragOver = false"
                @drop.prevent="handleDrop"
                @click="fileInputRef?.click()"
              >
                <ImagePlus class="h-8 w-8 text-text-tertiary mb-2" />
                <p class="text-sm text-text-secondary">{{ t('bugReport.imageDrop') }} <span class="text-accent font-medium">{{ t('bugReport.imageSelect') }}</span></p>
                <p class="text-xs text-text-tertiary mt-1">{{ t('bugReport.imageHint') }}</p>
                <input 
                  ref="fileInputRef"
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  @change="handleFileSelect"
                />
              </div>
            </div>


          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4 bg-bg-secondary/50 sticky bottom-0" v-if="step === 2">
          <button 
            @click="emit('close')"
            class="btn-secondary"
            :disabled="loading"
          >
            {{ t('common.cancel') }}
          </button>
          <button 
            @click="submitReport"
            class="btn-primary"
            :disabled="!canSubmit"
          >
            <AppSpinner v-if="loading" :size="16" class="mr-2" />
            <Send v-else class="h-4 w-4 mr-2" />
            {{ t('bugReport.submitBtn') }}
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
