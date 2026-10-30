<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { ShieldCheck, X } from 'lucide-vue-next'
import { httpClient } from '@/shared/api/httpClient'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  show: boolean
  title?: string
  message?: string
}>()

const emit = defineEmits<{
  confirmed: []
  cancelled: []
}>()

const pin = ref(['', '', '', ''])
const pinLength = ref(4)
const error = ref('')
const loading = ref(false)
const inputRefs = ref<HTMLInputElement[]>([])

watch(() => props.show, (val) => {
  if (val) {
    pin.value = ['', '', '', '']
    error.value = ''
    nextTick(() => inputRefs.value[0]?.focus())
  }
})

function handleInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/\D/g, '')
  pin.value[index] = value.charAt(0) || ''

  if (value && index < pinLength.value - 1) {
    nextTick(() => inputRefs.value[index + 1]?.focus())
  }

  // Auto-submit when fully filled
  if (filledPin().length === pinLength.value) {
    setTimeout(() => verifyPin(), 250) // Small delay for UX so user sees the last digit
  }
}

function handleKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !pin.value[index] && index > 0) {
    nextTick(() => inputRefs.value[index - 1]?.focus())
  }
  if (event.key === 'Enter') {
    verifyPin()
  }
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '') || ''
  for (let i = 0; i < pinLength.value; i++) {
    pin.value[i] = pasted[i] || ''
  }
  const focusIdx = Math.min(pasted.length, pinLength.value - 1)
  nextTick(() => inputRefs.value[focusIdx]?.focus())

  // Auto-submit when fully pasted
  if (filledPin().length === pinLength.value) {
    setTimeout(() => verifyPin(), 250)
  }
}

const filledPin = () => pin.value.slice(0, pinLength.value).join('')

async function verifyPin() {
  if (loading.value) return

  const pinStr = filledPin()
  if (pinStr.length < pinLength.value) {
    error.value = t('pin.fillAll')
    return
  }

  loading.value = true
  error.value = ''

  try {
    await httpClient.post('/api/pin/verify', { pin: pinStr })
    emit('confirmed')
  } catch (err: any) {
    error.value = err.message || t('pin.wrong')
    pin.value = ['', '', '', '']
    nextTick(() => inputRefs.value[0]?.focus())
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Overlay -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="emit('cancelled')"
        ></div>

        <!-- Dialog -->
        <div class="pwa-modal-safe bg-bg-surface border-border-default relative w-full max-w-[20rem] rounded-2xl border p-6 shadow-lg">
          <!-- Close -->
          <button
            @click="emit('cancelled')"
            class="text-text-tertiary hover:text-text-primary absolute top-4 right-4 transition-colors"
          >
            <X :size="18" />
          </button>

          <!-- Icon -->
          <div class="mb-4 flex justify-center">
            <div class="bg-warning/10 flex h-14 w-14 items-center justify-center rounded-full">
              <ShieldCheck :size="28" class="text-warning" />
            </div>
          </div>

          <!-- Title -->
          <h3 class="mb-1 text-center text-lg font-semibold">
            {{ title || t('pin.title') }}
          </h3>
          <p class="text-text-tertiary mb-6 text-center text-sm">
            {{ message || t('pin.message') }}
          </p>

          <!-- PIN inputs -->
          <div class="mb-4 flex justify-center gap-2">
            <input
              v-for="(_, i) in pinLength"
              :key="i"
              ref="inputRefs"
              type="password"
              inputmode="numeric"
              maxlength="1"
              :value="pin[i]"
              @input="handleInput(i, $event)"
              @keydown="handleKeydown(i, $event)"
              @paste="handlePaste"
              class="border-border-default bg-bg-elevated text-text-primary focus:border-accent focus:ring-accent-subtle h-12 w-12 rounded-xl border text-center text-xl font-bold transition-all duration-150 focus:ring-2 focus:outline-none"
              :class="{ 'border-error': error }"
            />
          </div>

          <!-- Error -->
          <Transition name="fade">
            <p
              v-if="error"
              class="text-error mb-4 text-center text-sm"
            >
              {{ error }}
            </p>
          </Transition>

          <!-- Submit -->
          <button
            @click="verifyPin"
            :disabled="loading || filledPin().length < pinLength"
            class="btn-primary w-full justify-center py-3 disabled:opacity-40"
          >
            <AppSpinner v-if="loading" :size="16" class="mr-2" />
                  <span>{{ loading ? t('common.processing') : t('pin.confirm') }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
