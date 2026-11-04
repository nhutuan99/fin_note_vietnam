<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { Copy, ShieldCheck, Smartphone, CheckCircle } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useFinanceStore } from '@/stores/finance'

const auth = useAuthStore()
const ui = useUiStore()
const { t } = useI18n()
const financeStore = useFinanceStore()

const isUrlRevealed = ref(false)

const webhookUrl = computed(() => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin
  const userId = auth.user?.id || 'YOUR_USER_ID'
  return `${baseUrl}/api/webhook/sms?userId=${userId}`
})

async function revealUrl() {
  const success = await ui.requestPinValidation()
  if (success) {
    isUrlRevealed.value = true
  }
}

async function copyWebhookUrl() {
  if (!isUrlRevealed.value) {
    const success = await ui.requestPinValidation()
    if (!success) return
    isUrlRevealed.value = true
  }
  
  navigator.clipboard.writeText(webhookUrl.value).then(() => {
    ui.showToast('success', t('autoSync.copySuccess'))
  }).catch(() => {
    ui.showToast('error', t('autoSync.copyFailed'))
  })
}

onMounted(() => {
  financeStore.fetchAll()
})
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <div class="mb-8">
      <h2 class="mb-2 text-2xl font-bold tracking-tight">{{ t('autoSync.title') }}</h2>
      <p class="text-text-secondary text-sm">{{ t('autoSync.desc') }}</p>
    </div>

    <!-- Intro Card -->
    <div class="card-premium mb-8 overflow-hidden p-0 border-accent/20">
      <div class="bg-accent/10 px-6 py-6 sm:px-8">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div class="bg-bg-primary border-border-default flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border shadow-sm">
            <Smartphone class="text-accent h-8 w-8" />
          </div>
          <div class="flex-1">
            <h3 class="mb-2 text-lg font-bold text-text-primary">{{ t('autoSync.whyTitle') }}</h3>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex items-start gap-2">
                <ShieldCheck class="text-success h-5 w-5 shrink-0" />
                <p class="text-text-secondary text-[0.8125rem]" v-html="t('autoSync.security')"></p>
              </div>
              <div class="flex items-start gap-2">
                <CheckCircle class="text-success h-5 w-5 shrink-0" />
                <p class="text-text-secondary text-[0.8125rem]" v-html="t('autoSync.native')"></p>
              </div>
              <div class="flex items-start gap-2">
                <CheckCircle class="text-success h-5 w-5 shrink-0" />
                <p class="text-text-secondary text-[0.8125rem]" v-html="t('autoSync.free')"></p>
              </div>
              <div class="flex items-start gap-2">
                <CheckCircle class="text-success h-5 w-5 shrink-0" />
                <p class="text-text-secondary text-[0.8125rem]" v-html="t('autoSync.instant')"></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Config URL -->
    <div class="mb-8">
      <h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-text-tertiary">{{ t('autoSync.step1Title') }}</h3>
      <div class="card-premium p-6">
        <p class="mb-4 text-sm text-text-secondary">{{ t('autoSync.step1Desc') }}</p>
        <div class="bg-bg-elevated border-border-default flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
          <code 
            class="text-accent flex-1 break-all text-[0.8125rem] leading-relaxed transition-all duration-300"
            :class="!isUrlRevealed ? 'blur-[5px] select-none opacity-70' : ''"
          >
            {{ webhookUrl }}
          </code>
          <div class="flex gap-2">
            <button
              v-if="!isUrlRevealed"
              class="bg-bg-surface text-text-secondary hover:bg-bg-hover hover:text-text-primary shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              @click="revealUrl"
            >
              {{ t('autoSync.revealUrl') }}
            </button>
            <button
              class="btn-primary shrink-0 justify-center"
              @click="copyWebhookUrl"
            >
              <Copy :size="16" />
              {{ t('common.copyLink') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Setup Guide -->
    <div>
      <h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-text-tertiary">{{ t('autoSync.step2Title') }}</h3>
      <div class="card-premium divide-border-default divide-y p-0">
        
        <div class="flex items-start gap-5 px-6 py-5">
          <div class="bg-bg-elevated border-border-default flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-bold text-text-primary">1</div>
          <div class="flex-1 pt-1">
            <h4 class="mb-1 font-semibold text-text-primary">{{ t('autoSync.s1Title') }}</h4>
            <p class="text-text-secondary mb-3 text-sm" v-html="t('autoSync.s1Desc')"></p>
          </div>
        </div>

        <div class="flex items-start gap-5 px-6 py-5">
          <div class="bg-bg-elevated border-border-default flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-bold text-text-primary">2</div>
          <div class="flex-1 pt-1">
            <h4 class="mb-1 font-semibold text-text-primary">{{ t('autoSync.s2Title') }}</h4>
            <p class="text-text-secondary mb-3 text-sm" v-html="t('autoSync.s2Desc')"></p>
            <ul class="text-text-secondary list-inside list-disc space-y-1 text-sm">
              <li v-html="t('autoSync.s2Li1')"></li>
              <li v-html="t('autoSync.s2Li2')"></li>
            </ul>
            <p class="text-text-secondary mt-3 text-sm" v-html="t('autoSync.s2Next')"></p>
          </div>
        </div>

        <div class="flex items-start gap-5 px-6 py-5">
          <div class="bg-bg-elevated border-border-default flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-bold text-text-primary">3</div>
          <div class="flex-1 pt-1">
            <h4 class="mb-1 font-semibold text-text-primary">{{ t('autoSync.s3Title') }}</h4>
            <p class="text-text-secondary mb-3 text-sm" v-html="t('autoSync.s3Desc')"></p>
          </div>
        </div>

        <div class="flex items-start gap-5 px-6 py-5">
          <div class="bg-bg-elevated border-border-default flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-bold text-text-primary">4</div>
          <div class="flex-1 pt-1">
            <h4 class="mb-1 font-semibold text-text-primary">{{ t('autoSync.s4Title') }}</h4>
            <p class="text-text-secondary mb-3 text-sm" v-html="t('autoSync.s4Desc')"></p>
            <ul class="text-text-secondary list-inside list-disc space-y-2 text-sm">
              <li v-html="t('autoSync.s4Li1')"></li>
              <li v-html="t('autoSync.s4Li2')"></li>
              <li v-html="t('autoSync.s4Li3')"></li>
              <li v-html="t('autoSync.s4Li4')"></li>
            </ul>
            <div class="bg-success/10 border-success/20 mt-4 flex items-center gap-3 rounded-lg border px-4 py-3">
              <CheckCircle class="text-success h-5 w-5 shrink-0" />
              <p class="text-sm font-medium text-text-primary" v-html="t('autoSync.s4Done')"></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
