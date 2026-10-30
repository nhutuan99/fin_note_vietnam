<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import { Shield, LogOut, Trash2, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-vue-next'
import { httpClient } from '@/shared/api/httpClient'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const finance = useFinanceStore()
const ui = useUiStore()

const isDeleteModalOpen = ref(false)
const deleteLoading = ref(false)
const showDeletePassword = ref(false)
const deletePasswordForm = ref({ password: '' })

async function confirmDeleteAccount() {
  if (!deletePasswordForm.value.password) {
    return ui.showToast('error', t('settings.passwordRequired'))
  }
  try {
    deleteLoading.value = true
    await httpClient.post('/api/auth/delete-account', {
      password: deletePasswordForm.value.password
    })
    ui.showToast('success', t('settings.accountDeleted'))
    isDeleteModalOpen.value = false
    finance.reset()
    auth.logout()
    router.push('/login')
  } catch (err: any) {
    ui.showToast('error', err.message || t('settings.wrongPassword'))
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <div class="mb-6">
    <div class="text-text-secondary mb-3 flex items-center gap-2">
      <Shield :size="18" />
      <h3 class="text-sm font-semibold">{{ t('settings.account') }}</h3>
    </div>
    <div class="card-premium p-5">
      <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h4 class="mb-0.5 text-sm font-semibold">{{ t('settings.signOut') }}</h4>
          <p class="text-text-tertiary text-sm">{{ t('settings.signOutDesc') }}</p>
        </div>
        <button
          id="logout-btn"
          @click="finance.reset(); auth.logout(); router.push('/login')"
          class="btn-secondary shrink-0 whitespace-nowrap"
        >
          <LogOut :size="16" />
          {{ t('settings.signOut') }}
        </button>
      </div>

      <div class="border-border-default mt-5 border-t pt-5">
        <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h4 class="text-error mb-0.5 text-sm font-semibold">
              {{ t('settings.deleteAccount') }}
            </h4>
            <p class="text-text-tertiary text-[0.8125rem]">
              {{ t('settings.deleteAccountDesc') }}
            </p>
          </div>
          <button
            @click="isDeleteModalOpen = true"
            class="border-error text-error hover:bg-error/10 flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150"
          >
            <Trash2 :size="16" />
            {{ t('settings.deleteAccount') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Account Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="isDeleteModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="isDeleteModalOpen = false"></div>

          <div class="bg-bg-surface border-border-default relative w-full max-w-[24rem] rounded-2xl border p-6 shadow-xl">
            <div class="mb-4 flex justify-center">
              <div class="bg-error/10 flex h-14 w-14 items-center justify-center rounded-full">
                <AlertTriangle :size="28" class="text-error" />
              </div>
            </div>

            <h3 class="text-error mb-2 text-center text-lg font-bold">
              {{ t('settings.deleteAccountTitle') }}
            </h3>
            <p class="text-text-secondary mb-6 text-center text-sm" v-html="t('settings.deleteAccountWarning')"></p>

            <div class="flex flex-col gap-4">
              <div>
                <label class="text-text-secondary mb-1 block text-sm font-medium">
                  {{ t('settings.confirmPassword') }}
                </label>
                <div class="relative">
                  <Lock :size="18" class="text-text-tertiary absolute top-1/2 left-3 -translate-y-1/2" />
                  <input
                    v-model="deletePasswordForm.password"
                    :type="showDeletePassword ? 'text' : 'password'"
                    :placeholder="t('settings.passwordPlaceholder')"
                    class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-error focus:ring-error/20 w-full rounded-xl border py-3 pr-10 pl-10 text-sm transition-all focus:ring-2 focus:outline-none"
                    @keyup.enter="confirmDeleteAccount"
                  />
                  <button
                    @click="showDeletePassword = !showDeletePassword"
                    class="text-text-tertiary hover:text-text-primary absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                  >
                    <Eye v-if="!showDeletePassword" :size="18" />
                    <EyeOff v-else :size="18" />
                  </button>
                </div>
              </div>
              <div class="flex gap-3">
                <button
                  @click="isDeleteModalOpen = false; deletePasswordForm.password = ''"
                  class="btn-secondary flex-1"
                >
                  {{ t('common.cancel') }}
                </button>
                <button @click="confirmDeleteAccount" :disabled="deleteLoading" class="btn-danger flex-1 py-2.5 shadow-lg shadow-red-500/30 disabled:opacity-50">
                  <AppSpinner v-if="deleteLoading" :size="20" class="mr-2" />
                  <span>{{ deleteLoading ? t('common.processing') : t('settings.deleteForever') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
