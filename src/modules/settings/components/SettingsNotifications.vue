<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Bell } from 'lucide-vue-next'
import { usePushNotifications } from '@/composables/usePushNotifications'

const { t } = useI18n()

const {
  isSupported: pushSupported,
  isSubscribed: pushSubscribed,
  isStandalone: pushStandalone,
  permissionState: pushPermission,
  loading: pushLoading,
  toggle: togglePush
} = usePushNotifications()
</script>

<template>
  <div class="mb-6">
    <div class="text-text-secondary mb-3 flex items-center gap-2">
      <Bell :size="18" />
      <h3 class="text-sm font-semibold">{{ t('settings.pushNotifications') }}</h3>
    </div>
    <div class="card-premium p-5">
      <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h4 class="mb-0.5 text-sm font-semibold">{{ t('settings.pushNotifications') }}</h4>
          <p class="text-text-tertiary text-sm">
            <template v-if="!pushSupported">{{ t('settings.pushNotSupported') }}</template>
            <template v-else-if="pushPermission === 'denied'">
              {{ t('settings.pushDenied') }}
            </template>
            <template v-else-if="pushSubscribed">{{ t('settings.pushEnabled') }}</template>
            <template v-else>{{ t('settings.pushDisabled') }}</template>
          </p>
          <!-- iOS standalone hint -->
          <p v-if="pushSupported && !pushStandalone" class="text-warning mt-1.5 text-xs">
            {{ t('settings.pushInstallHint') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span
            v-if="pushSubscribed"
            class="bg-success/10 text-success shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium"
          >
            {{ t('settings.pinActive') }}
          </span>
          <button
            @click="togglePush"
            :disabled="pushLoading || !pushSupported"
            class="btn-secondary shrink-0 whitespace-nowrap"
          >
            <AppSpinner v-if="pushLoading" :size="16"  />
            <Bell v-else :size="16" />
            {{ pushLoading ? t('common.processing') : (pushSubscribed ? t('settings.pushDisable') : t('settings.pushEnable')) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
