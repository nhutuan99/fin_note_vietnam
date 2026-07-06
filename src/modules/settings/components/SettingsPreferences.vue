<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Globe, DollarSign, FolderSync, Link, Unlink } from 'lucide-vue-next'
import { setLocale, currentLocale } from '@/i18n'
import { useCurrency, type CurrencyCode } from '@/composables/useCurrency'
import { useNotesStore } from '@/stores/notes'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { httpClient } from '@/shared/api/httpClient'
import type { User } from '@/types'
import LogoLoader from '@/components/ui/LogoLoader.vue'

const { t } = useI18n()
const notesStore = useNotesStore()
const ui = useUiStore()
const auth = useAuthStore()

// Language
const selectedLocale = ref(currentLocale())

function changeLocale(locale: 'vi' | 'en') {
  selectedLocale.value = locale
  setLocale(locale)
}

// Currency
const { currency, rateDisplay, rateLoading, rateError, setCurrency } = useCurrency()

function changeCurrency(code: CurrencyCode) {
  setCurrency(code)
}

// Large Transfer Confirmation
const confirmLargeTransfer = computed({
  get: () => !auth.user?.disableLargeTransferConfirmation,
  set: async (value: boolean) => {
    if (!auth.user || auth.isGuest) return
    const disabledVal = !value
    try {
      const data = await httpClient.put<{ data: User }>('/api/auth/profile', {
        disableLargeTransferConfirmation: disabledVal
      })
      if (data && data.data) {
        auth.updateUser(data.data)
        ui.showToast('success', t('settings.profileUpdated'))
      }
    } catch (err: any) {
      ui.showToast('error', err.message || t('settings.updateFailed'))
    }
  }
})
</script>

<template>
  <div class="space-y-6 mb-6">
    <!-- Language -->
    <div>
      <div class="text-text-secondary mb-3 flex items-center gap-2">
        <Globe :size="18" />
        <h3 class="text-sm font-semibold">{{ t('settings.language') }}</h3>
      </div>
      <div class="card-premium p-5">
        <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h4 class="mb-0.5 text-sm font-semibold">{{ t('settings.language') }}</h4>
            <p class="text-text-tertiary text-sm">{{ t('settings.languageDesc') }}</p>
          </div>
          <div class="border-border-default flex overflow-hidden rounded-lg border">
            <button
              class="px-4 py-2 text-sm font-medium transition-all duration-150"
              :class="
                selectedLocale === 'vi'
                  ? 'bg-accent-subtle text-accent'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
              "
              @click="changeLocale('vi')"
            >
              Tiếng Việt
            </button>
            <button
              class="border-border-default border-l px-4 py-2 text-sm font-medium transition-all duration-150"
              :class="
                selectedLocale === 'en'
                  ? 'bg-accent-subtle text-accent'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
              "
              @click="changeLocale('en')"
            >
              English
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Currency -->
    <div>
      <div class="text-text-secondary mb-3 flex items-center gap-2">
        <DollarSign :size="18" />
        <h3 class="text-sm font-semibold">{{ t('settings.currency') }}</h3>
      </div>
      <div class="card-premium p-5">
        <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h4 class="mb-0.5 text-sm font-semibold">{{ t('settings.currencyDisplay') }}</h4>
            <p class="text-text-tertiary text-sm">{{ t('settings.currencyDesc') }}</p>
            <p v-if="currency === 'USD' && rateDisplay" class="text-accent mt-1 text-xs font-medium">
              💡 {{ rateDisplay }}
            </p>
            <p v-if="rateError && currency === 'USD'" class="text-warning mt-1 text-xs">
              ⚠️ {{ rateError }} ({{ t('settings.fallbackRate') }})
            </p>
          </div>
          <div class="border-border-default flex overflow-hidden rounded-lg border">
            <button
              class="px-4 py-2 text-sm font-medium transition-all duration-150"
              :class="
                currency === 'VND'
                  ? 'bg-accent-subtle text-accent'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
              "
              @click="changeCurrency('VND')"
            >
              🇻🇳 VND (đ)
            </button>
            <button
              class="border-border-default border-l px-4 py-2 text-sm font-medium transition-all duration-150"
              :class="
                currency === 'USD'
                  ? 'bg-accent-subtle text-accent'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover'
              "
              @click="changeCurrency('USD')"
            >
              <AppSpinner v-if="rateLoading" :size="12" class="mr-1" />
              🇺🇸 USD ($)
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Large Transfer Confirmation Setting -->
    <div v-if="auth.user && !auth.isGuest">
      <div class="text-text-secondary mb-3 flex items-center gap-2">
        <FolderSync :size="18" />
        <h3 class="text-sm font-semibold">{{ t('settings.confirmLargeTransfer') }}</h3>
      </div>
      <div class="card-premium p-5">
        <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h4 class="mb-0.5 text-sm font-semibold">{{ t('settings.confirmLargeTransfer') }}</h4>
            <p class="text-text-tertiary text-sm">{{ t('settings.confirmLargeTransferDesc') }}</p>
          </div>
          <div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                v-model="confirmLargeTransfer"
                class="peer sr-only"
              />
              <div class="peer h-6 w-11 rounded-full bg-border-default after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-white after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Stock Management Module -->
    <div>
      <div class="text-text-secondary mb-3 flex items-center gap-2">
        <DollarSign :size="18" />
        <h3 class="text-sm font-semibold">{{ t('settings.stocks') }}</h3>
      </div>
      <div class="card-premium p-5">
        <div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h4 class="mb-0.5 text-sm font-semibold">{{ t('settings.enableStocks') }}</h4>
            <p class="text-text-tertiary text-sm">{{ t('settings.enableStocksDesc') }}</p>
          </div>
          <div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                v-model="ui.enableStocks"
                class="peer sr-only"
              />
              <div class="peer h-6 w-11 rounded-full bg-border-default after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-white after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
