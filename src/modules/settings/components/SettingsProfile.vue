<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { httpClient } from '@/shared/api/httpClient'
import type { User } from '@/types'
import { useI18n } from 'vue-i18n'
import { User as UserIcon, Camera, Trash2, Save } from 'lucide-vue-next'
import LogoLoader from '@/components/ui/LogoLoader.vue'

const { t } = useI18n()
const auth = useAuthStore()
const ui = useUiStore()

const imgError = ref(false)
watch(
  () => auth.user?.avatarUrl,
  () => {
    imgError.value = false
  }
)

const isEditingProfile = ref(false)
const profileLoading = ref(false)
const profileForm = ref({ name: '', avatarUrl: '' })

watch(
  () => auth.user,
  (u) => {
    if (u && !isEditingProfile.value) {
      profileForm.value = { name: u.name || '', avatarUrl: u.avatarUrl || '' }
    }
  },
  { immediate: true }
)

async function saveProfile() {
  if (!profileForm.value.name.trim()) return
  try {
    profileLoading.value = true
    const data = await httpClient.put<{ data: User }>('/api/auth/profile', profileForm.value)
    if (data && data.data) {
      auth.updateUser(data.data)
      isEditingProfile.value = false
      ui.showToast('success', t('settings.profileUpdated', 'Hồ sơ đã được cập nhật'))
    }
  } catch (err: any) {
    ui.showToast('error', err.message || t('settings.updateFailed'))
  } finally {
    profileLoading.value = false
  }
}
</script>

<template>
  <div class="mb-6">
    <div class="text-text-secondary mb-3 flex items-center gap-2">
      <UserIcon :size="18" />
      <h3 class="text-sm font-semibold">{{ t('settings.profile') }}</h3>
    </div>
    <div class="card-premium p-5">
      <div
        v-if="!isEditingProfile"
        class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
      >
        <div class="flex items-center gap-4">
          <div
            v-if="!auth.user?.avatarUrl || imgError"
            class="bg-accent-subtle text-accent flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full text-xl font-semibold"
          >
            {{ auth.user?.name?.charAt(0)?.toUpperCase() || 'U' }}
          </div>
          <img
            v-else
            v-show="!imgError"
            :src="auth.user?.avatarUrl"
            alt="Avatar"
            class="h-[3.25rem] w-[3.25rem] rounded-full object-cover shadow-sm"
            referrerpolicy="no-referrer"
            @error="imgError = true"
          />
          <div>
            <h4 class="mb-0.5 text-base font-semibold">{{ auth.user?.name || 'User' }}</h4>
            <p class="text-text-tertiary text-sm">{{ auth.user?.email || 'No email' }}</p>
          </div>
        </div>
        <button @click="isEditingProfile = true" class="btn-secondary whitespace-nowrap">
          {{ t('settings.editProfile') }}
        </button>
      </div>

      <!-- Edit Profile Form -->
      <div v-else class="flex flex-col gap-4">
        <div>
          <label class="text-text-secondary mb-1 block text-[0.6875rem] font-medium">
            {{ t('settings.displayName') }}
          </label>
          <input
            v-model="profileForm.name"
            type="text"
            :placeholder="t('login.namePlaceholder')"
            class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-3 py-2 text-sm transition-all focus:ring-2 focus:outline-none"
          />
        </div>
        <div>
          <label class="text-text-secondary mb-1 block text-[0.6875rem] font-medium">
            {{ t('settings.avatarUrl') }}
          </label>
          <div class="flex items-center gap-2">
            <Camera :size="16" class="text-text-tertiary" />
            <input
              v-model.trim="profileForm.avatarUrl"
              type="url"
              placeholder="https://example.com/avatar.png"
              class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle flex-1 rounded-lg border px-3 py-2 text-sm transition-all focus:ring-2 focus:outline-none"
            />
            <button
              v-if="profileForm.avatarUrl"
              @click="profileForm.avatarUrl = ''"
              class="text-text-tertiary hover:text-error rounded-lg p-2 transition-colors"
              :title="t('settings.removeAvatar')"
            >
              <Trash2 :size="16" />
            </button>
          </div>
          <p class="text-text-tertiary mt-1 text-[0.6875rem]">{{ t('settings.avatarHint') }}</p>
        </div>
        <div class="mt-2 flex items-center justify-end gap-2">
          <button
            @click="
              isEditingProfile = false;
              profileForm = { name: auth.user?.name || '', avatarUrl: auth.user?.avatarUrl || '' }
            "
            class="text-text-secondary hover:text-text-primary rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button @click="saveProfile" :disabled="profileLoading || !profileForm.name" class="btn-primary">
            <AppSpinner v-if="profileLoading" :size="16"  />
            <Save v-else :size="14" />
            <span>{{ profileLoading ? t('common.processing') : t('settings.saveChanges') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
