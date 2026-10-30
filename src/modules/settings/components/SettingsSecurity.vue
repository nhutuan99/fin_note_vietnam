<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { httpClient } from '@/shared/api/httpClient'
import { Lock, Eye, EyeOff, KeyRound } from 'lucide-vue-next'

const { t } = useI18n()
const ui = useUiStore()
// ── PIN Management ──

const hasPin = ref(false)
const showPinForm = ref(false)
const pinForm = ref({ currentPin: '', newPin: '', confirmPin: '' })
const pinLoading = ref(false)
const showCurrentPin = ref(false)
const showNewPin = ref(false)

onMounted(async () => {
  try {
    const data = await httpClient.get<{ hasPin: boolean }>('/api/pin')
    hasPin.value = data?.hasPin || false
  } catch {
    /* ignore */
  }
})

async function savePin() {
  if (pinForm.value.newPin.length !== 4) {
    ui.showToast('error', t('settings.pinLengthError'))
    return
  }
  if (!/^\d+$/.test(pinForm.value.newPin)) {
    ui.showToast('error', t('settings.pinDigitsOnly'))
    return
  }
  if (pinForm.value.newPin !== pinForm.value.confirmPin) {
    ui.showToast('error', t('settings.pinMismatch'))
    return
  }

  pinLoading.value = true
  try {
    await httpClient.post('/api/pin', {
      pin: pinForm.value.newPin,
      currentPin: pinForm.value.currentPin || undefined
    })
    hasPin.value = true
    showPinForm.value = false
    pinForm.value = { currentPin: '', newPin: '', confirmPin: '' }
    ui.showToast('success', t('settings.pinSuccess'))
  } catch (err: any) {
    ui.showToast('error', err.message || t('settings.pinFailed'))
  } finally {
    pinLoading.value = false
  }
}

// ── Forgot PIN (Password-based reset) ──
const forgotPinStep = ref<null | 'password' | 'newpin'>(null)
const forgotPinPassword = ref('')
const forgotPinResetToken = ref('')
const forgotPinNew = ref('')
const forgotPinConfirm = ref('')
const forgotPinLoading = ref(false)
const forgotPinError = ref('')
const showForgotPinPassword = ref(false)

async function verifyPasswordForPin() {
  if (!forgotPinPassword.value) {
    forgotPinError.value = t('settings.passwordRequired')
    return
  }
  forgotPinLoading.value = true
  forgotPinError.value = ''
  try {
    const res = await httpClient.post<{ resetToken: string }>('/api/pin/forgot', {
      password: forgotPinPassword.value
    })
    forgotPinResetToken.value = res?.resetToken || ''
    forgotPinStep.value = 'newpin'
  } catch (err: any) {
    forgotPinError.value = err.message || t('settings.wrongPassword')
  } finally {
    forgotPinLoading.value = false
  }
}

async function resetPinWithPassword() {
  if (forgotPinNew.value.length !== 4) {
    forgotPinError.value = t('settings.pinLengthError')
    return
  }
  if (!/^\d+$/.test(forgotPinNew.value)) {
    forgotPinError.value = t('settings.pinDigitsOnly')
    return
  }
  if (forgotPinNew.value !== forgotPinConfirm.value) {
    forgotPinError.value = t('settings.pinMismatch')
    return
  }
  forgotPinLoading.value = true
  forgotPinError.value = ''
  try {
    await httpClient.post('/api/pin/reset', {
      resetToken: forgotPinResetToken.value,
      newPin: forgotPinNew.value
    })
    hasPin.value = true
    forgotPinStep.value = null
    forgotPinPassword.value = ''
    forgotPinNew.value = ''
    forgotPinConfirm.value = ''
    forgotPinResetToken.value = ''
    ui.showToast('success', t('forgot.pinResetSuccess'))
  } catch (err: any) {
    forgotPinError.value = err.message || t('settings.pinResetFailed')
  } finally {
    forgotPinLoading.value = false
  }
}

function cancelForgotPin() {
  forgotPinStep.value = null
  forgotPinPassword.value = ''
  forgotPinNew.value = ''
  forgotPinConfirm.value = ''
  forgotPinError.value = ''
  forgotPinResetToken.value = ''
}
</script>
<template>
    <!-- PIN Security -->
    <div class="mb-6">
      <div class="text-text-secondary mb-3 flex items-center gap-2">
        <Lock :size="18" />
        <h3 class="text-sm font-semibold">{{ t('settings.pinSecurity') }}</h3>
      </div>
      <div class="card-premium p-5">
        <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h4 class="mb-0.5 text-sm font-semibold">
              {{ hasPin ? t('settings.changePin') : t('settings.setupPin') }}
            </h4>
            <p class="text-text-tertiary text-sm">
              {{ hasPin ? t('settings.pinEnabled') : t('settings.pinDisabled') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="hasPin"
              class="bg-success/10 text-success shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium"
            >
              {{ t('settings.pinActive') }}
            </span>
            <button
              @click="showPinForm = !showPinForm"
              class="btn-secondary shrink-0 whitespace-nowrap"
            >
              <Lock :size="16" />
              {{ hasPin ? t('settings.changePin') : t('settings.setupPin') }}
            </button>
          </div>
        </div>

        <!-- PIN Form -->
        <transition name="slide">
          <div
            v-if="showPinForm"
            class="border-border-default mt-4 border-t pt-4"
          >
            <div class="flex max-w-[20rem] flex-col gap-3">
              <!-- Current PIN (only if has existing PIN) -->
              <div v-if="hasPin">
                <label class="text-text-secondary mb-1 block text-[0.6875rem] font-medium">
                  {{ t('settings.currentPin') }}
                </label>
                <div class="relative">
                  <input
                    v-model="pinForm.currentPin"
                    :type="showCurrentPin ? 'text' : 'password'"
                    inputmode="numeric"
                    maxlength="4"
                    :placeholder="t('settings.currentPinPlaceholder')"
                    class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-3 py-2 text-sm transition-all focus:ring-2 focus:outline-none"
                  />
                  <button
                    type="button"
                    class="text-text-tertiary hover:text-text-primary absolute top-1/2 right-3 -translate-y-1/2"
                    @click="showCurrentPin = !showCurrentPin"
                  >
                    <component
                      :is="showCurrentPin ? EyeOff : Eye"
                      :size="14"
                    />
                  </button>
                </div>
              </div>

              <!-- New PIN -->
              <div>
                <label class="text-text-secondary mb-1 block text-[0.6875rem] font-medium">
                  {{ t('settings.newPin') }}
                </label>
                <div class="relative">
                  <input
                    v-model="pinForm.newPin"
                    :type="showNewPin ? 'text' : 'password'"
                    inputmode="numeric"
                    maxlength="4"
                    :placeholder="t('settings.newPinPlaceholder')"
                    class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-3 py-2 text-sm transition-all focus:ring-2 focus:outline-none"
                  />
                  <button
                    type="button"
                    class="text-text-tertiary hover:text-text-primary absolute top-1/2 right-3 -translate-y-1/2"
                    @click="showNewPin = !showNewPin"
                  >
                    <component
                      :is="showNewPin ? EyeOff : Eye"
                      :size="14"
                    />
                  </button>
                </div>
              </div>

              <!-- Confirm PIN -->
              <div>
                <label class="text-text-secondary mb-1 block text-[0.6875rem] font-medium">
                  {{ t('settings.confirmPin') }}
                </label>
                <input
                  v-model="pinForm.confirmPin"
                  type="password"
                  inputmode="numeric"
                  maxlength="4"
                  :placeholder="t('settings.confirmPinPlaceholder')"
                  class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-3 py-2 text-sm transition-all focus:ring-2 focus:outline-none"
                />
              </div>

              <div class="flex gap-2">
                <button
                  @click="showPinForm = false; pinForm = { currentPin: '', newPin: '', confirmPin: '' }"
                  class="btn-secondary flex-1"
                >
                  {{ t('common.cancel') }}
                </button>
                <button
                  @click="savePin"
                  :disabled="pinLoading || !pinForm.newPin || !pinForm.confirmPin"
                  class="btn-primary flex-1 justify-center py-2 disabled:opacity-40"
                >
                  <AppSpinner v-if="pinLoading" :size="16"  />
                  {{ pinLoading ? t('settings.savingPin') : t('settings.savePin') }}
                </button>
              </div>

              <!-- Forgot PIN link (only when editing existing PIN) -->
              <div
                v-if="hasPin"
                class="text-center"
              >
                <button
                  @click="showPinForm = false; forgotPinStep = 'password'"
                  class="text-text-tertiary hover:text-accent text-xs transition-colors"
                >
                  {{ t('settings.forgotPin') }}
                </button>
              </div>
            </div>
          </div>
        </transition>

        <!-- ── Forgot PIN Password Modal ── -->
        <Teleport to="body">
          <Transition name="fade">
            <div
              v-if="forgotPinStep !== null"
              class="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div
                class="absolute inset-0 bg-black/60 backdrop-blur-sm"
                @click="cancelForgotPin"
              ></div>
              <div
                class="bg-bg-surface border-border-default relative w-full max-w-[22rem] rounded-2xl border p-6 shadow-xl"
              >
                <!-- Step: password – verify identity -->
                <template v-if="forgotPinStep === 'password'">
                  <div class="mb-5 flex items-center gap-3">
                    <div
                      class="bg-warning/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    >
                      <Lock
                        :size="20"
                        class="text-warning"
                      />
                    </div>
                    <div>
                      <h3 class="font-semibold">{{ t('forgot.pinTitle') }}</h3>
                      <p class="text-text-tertiary text-xs">
                        {{ t('forgot.pinVerifyPasswordDesc') }}
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-col gap-3">
                    <div>
                      <label class="text-text-secondary mb-1 block text-xs font-medium">
                        {{ t('settings.confirmPassword') }}
                      </label>
                      <div class="relative">
                        <Lock
                          :size="16"
                          class="text-text-tertiary pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                        />
                        <input
                          v-model="forgotPinPassword"
                          :type="showForgotPinPassword ? 'text' : 'password'"
                          :placeholder="t('settings.passwordPlaceholder')"
                          class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border py-2.5 pr-10 pl-[2.375rem] text-sm transition-all focus:ring-2 focus:outline-none"
                          :class="{ 'border-error': forgotPinError }"
                          @keyup.enter="verifyPasswordForPin"
                        />
                        <button
                          type="button"
                          class="text-text-tertiary hover:text-text-primary absolute top-1/2 right-3 -translate-y-1/2"
                          @click="showForgotPinPassword = !showForgotPinPassword"
                        >
                          <component
                            :is="showForgotPinPassword ? EyeOff : Eye"
                            :size="14"
                          />
                        </button>
                      </div>
                    </div>

                    <p
                      v-if="forgotPinError"
                      class="text-error text-center text-sm"
                    >
                      {{ forgotPinError }}
                    </p>

                    <button
                      @click="verifyPasswordForPin"
                      :disabled="forgotPinLoading || !forgotPinPassword"
                      class="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
                    >
                      <AppSpinner v-if="forgotPinLoading" :size="16" class="mr-2" />
                  <span>{{ forgotPinLoading ? t('common.processing') : t('common.confirm') }}</span>
                    </button>

                    <button
                      @click="cancelForgotPin"
                      class="text-text-tertiary hover:text-text-primary text-center text-sm transition-colors"
                    >
                      {{ t('common.cancel') }}
                    </button>
                  </div>
                </template>

                <!-- Step: newpin – set new PIN -->
                <template v-else-if="forgotPinStep === 'newpin'">
                  <div class="mb-5 flex items-center gap-3">
                    <div
                      class="bg-accent/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    >
                      <KeyRound
                        :size="20"
                        class="text-accent"
                      />
                    </div>
                    <div>
                      <h3 class="font-semibold">{{ t('forgot.pinNewTitle') }}</h3>
                      <p class="text-text-tertiary text-xs">{{ t('forgot.pinNewDesc') }}</p>
                    </div>
                  </div>

                  <div class="flex flex-col gap-3">
                    <div>
                      <label class="text-text-secondary mb-1 block text-xs font-medium">
                        {{ t('settings.newPin') }}
                      </label>
                      <input
                        v-model="forgotPinNew"
                        type="password"
                        inputmode="numeric"
                        maxlength="4"
                        :placeholder="t('settings.newPinPlaceholder')"
                        class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-3 py-2 text-sm transition-all focus:ring-2 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label class="text-text-secondary mb-1 block text-xs font-medium">
                        {{ t('settings.confirmPin') }}
                      </label>
                      <input
                        v-model="forgotPinConfirm"
                        type="password"
                        inputmode="numeric"
                        maxlength="4"
                        :placeholder="t('settings.confirmPinPlaceholder')"
                        class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-3 py-2 text-sm transition-all focus:ring-2 focus:outline-none"
                      />
                    </div>

                    <p
                      v-if="forgotPinError"
                      class="text-error text-center text-sm"
                    >
                      {{ forgotPinError }}
                    </p>

                    <div class="flex gap-2">
                      <button
                        @click="cancelForgotPin"
                        class="btn-secondary flex-1"
                      >
                        {{ t('common.cancel') }}
                      </button>
                      <button
                        @click="resetPinWithPassword"
                        :disabled="forgotPinLoading || !forgotPinNew || !forgotPinConfirm"
                        class="btn-primary flex-1 justify-center py-2 disabled:opacity-50"
                      >
                        <AppSpinner v-if="forgotPinLoading" :size="16" class="mr-2" />
                  <span>{{ forgotPinLoading ? t('common.processing') : t('settings.savePin') }}</span>
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </Transition>
        </Teleport>
      </div>
    </div>

    <!-- Push Notifications -->
</template>
