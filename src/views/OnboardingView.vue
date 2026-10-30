<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnboarding } from '@/composables/useOnboarding'
import { useFinanceStore } from '@/stores/finance'
import { useUiStore } from '@/stores/ui'

import CurrencyInput from '@/components/ui/CurrencyInput.vue'
import {
  Globe,
  Wallet,
  Target,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Zap,
  FileText,
  Bot
} from 'lucide-vue-next'

const { t, locale } = useI18n()
const { currentStep, progress, totalSteps, nextStep, prevStep, completeOnboarding } = useOnboarding()
const finance = useFinanceStore()
const ui = useUiStore()

// ─── Step 1: Language ─────────────────────────
const selectedLang = ref(locale.value)
watch(selectedLang, (val) => {
  locale.value = val
  localStorage.setItem('finnote_locale', val)
})

// ─── Step 2: Wallet ───────────────────────────
const walletName = ref('')
const walletBalance = ref<number>(0)

async function createWallet() {
  if (!walletName.value) return
  try {
    await finance.addWallet({
      name: walletName.value,
      balance: walletBalance.value,
      currency: 'VND',
      icon: '💰',
      color: '#7c6ff7',
      order: 0
    })
  } catch (err) {
    console.error('[Onboarding] Failed to create wallet:', err)
  }
}

// ─── Step 3: Budget ───────────────────────────
const budgetAmount = ref<number>(0)

// ─── Navigation handlers ──────────────────────
async function handleNext() {
  if (currentStep.value === 2 && walletName.value) {
    await createWallet()
  }
  if (currentStep.value === 3 && budgetAmount.value > 0) {
    const STORAGE_KEY = 'finnote_budget'
    const month = new Date().toISOString().substring(0, 7)
    const budget = {
      id: crypto.randomUUID(),
      month,
      totalLimit: budgetAmount.value,
      categoryBudgets: [],
      alertThreshold: 0.8,
      createdAt: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budget))
  }
  nextStep()
}

const stepIcons = [Globe, Wallet, Target, Sparkles]
</script>

<template>
  <div class="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-6">
    <!-- Progress bar -->
    <div class="w-full max-w-md mb-8">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[0.6875rem] font-medium text-text-tertiary">{{ currentStep }}/{{ totalSteps }}</span>
        <div class="flex gap-1.5">
          <div
            v-for="s in totalSteps"
            :key="s"
            class="h-1.5 rounded-full transition-all duration-500"
            :class="s <= currentStep ? 'bg-accent w-8' : 'bg-bg-elevated w-4'"
          />
        </div>
      </div>
    </div>

    <!-- Card -->
    <div class="w-full max-w-md">
      <Transition
        mode="out-in"
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-8"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 -translate-x-8"
      >
        <!-- ═══ Step 1: Language ═══ -->
        <div v-if="currentStep === 1" key="step1" class="card-premium p-8 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent mx-auto mb-5">
            <Globe :size="32" />
          </div>
          <h2 class="text-2xl font-bold mb-2">{{ t('onboarding.welcome') }}</h2>
          <p class="text-text-secondary mb-8 text-sm">{{ t('onboarding.welcomeDesc') }}</p>

          <div class="space-y-3">
            <button
              v-for="lang in [{ code: 'vi', label: '🇻🇳 Tiếng Việt' }, { code: 'en', label: '🇬🇧 English' }]"
              :key="lang.code"
              class="w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-all duration-150"
              :class="selectedLang === lang.code
                ? 'border-accent bg-accent/10 text-accent font-semibold'
                : 'border-border-default bg-bg-surface text-text-primary hover:border-border-strong'"
              @click="selectedLang = lang.code"
            >
              <span class="text-sm">{{ lang.label }}</span>
              <div
                class="h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors"
                :class="selectedLang === lang.code ? 'border-accent' : 'border-border-default'"
              >
                <div v-if="selectedLang === lang.code" class="h-2.5 w-2.5 rounded-full bg-accent" />
              </div>
            </button>
          </div>
        </div>

        <!-- ═══ Step 2: Create Wallet ═══ -->
        <div v-else-if="currentStep === 2" key="step2" class="card-premium p-8">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success mx-auto mb-5">
            <Wallet :size="32" />
          </div>
          <h2 class="text-xl font-bold mb-1 text-center">{{ t('onboarding.step2Title') }}</h2>
          <p class="text-text-secondary mb-6 text-sm text-center">{{ t('onboarding.step2Desc') }}</p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">{{ t('wallets.walletName').split('(')[0] }}</label>
              <input
                v-model="walletName"
                type="text"
                :placeholder="t('onboarding.walletNamePlaceholder')"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-3 text-sm transition-all focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-text-secondary mb-1.5">{{ t('onboarding.initialBalance') }}</label>
              <CurrencyInput
                v-model="walletBalance"
                placeholder="0"
                className="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-all focus:ring-2 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <!-- ═══ Step 3: Budget ═══ -->
        <div v-else-if="currentStep === 3" key="step3" class="card-premium p-8">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-info/15 text-info mx-auto mb-5">
            <Target :size="32" />
          </div>
          <h2 class="text-xl font-bold mb-1 text-center">{{ t('onboarding.step3Title') }}</h2>
          <p class="text-text-secondary mb-6 text-sm text-center">{{ t('onboarding.step3Desc') }}</p>

          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1.5">{{ t('onboarding.monthlyBudget') }}</label>
            <CurrencyInput
              v-model="budgetAmount"
              placeholder="0"
              className="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-3 text-center text-2xl font-bold transition-all focus:ring-2 focus:outline-none tracking-wide"
            />
          </div>
        </div>

        <!-- ═══ Step 4: AI Ready ═══ -->
        <div v-else-if="currentStep === 4" key="step4" class="card-premium p-8 text-center">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent mx-auto mb-5 relative">
            <Sparkles :size="32" />
            <div class="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-success flex items-center justify-center">
              <span class="text-white text-[0.5rem] font-bold">✓</span>
            </div>
          </div>
          <h2 class="text-xl font-bold mb-2">{{ t('onboarding.step4Title') }}</h2>
          <p class="text-text-secondary mb-8 text-sm leading-relaxed">
            {{ t('onboarding.step4Desc') }}
          </p>

          <!-- Feature highlights -->
          <div class="space-y-3 text-left mb-6">
            <div
              v-for="(item, idx) in [
                { icon: Bot, text: t('appIntro.feature2'), color: 'text-accent' },
                { icon: Zap, text: t('appIntro.feature1'), color: 'text-warning' },
                { icon: FileText, text: t('appIntro.feature3'), color: 'text-success' }
              ]"
              :key="idx"
              class="flex items-center gap-3 rounded-xl bg-bg-elevated p-3"
            >
              <component :is="item.icon" :size="18" :class="item.color" />
              <span class="text-sm text-text-primary">{{ item.text }}</span>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Navigation buttons -->
      <div class="flex gap-3 mt-6">
        <button
          v-if="currentStep > 1"
          @click="prevStep"
          class="btn-secondary flex-1 justify-center"
        >
          <ChevronLeft :size="16" />
          {{ t('onboarding.back') }}
        </button>
        <button
          v-if="currentStep > 1 && currentStep < totalSteps"
          @click="nextStep"
          class="text-text-tertiary text-sm font-medium hover:text-text-primary transition-colors px-3"
        >
          {{ t('onboarding.skip') }}
        </button>
        <button
          v-if="currentStep < totalSteps"
          @click="handleNext"
          class="btn-primary flex-1 justify-center"
        >
          {{ t('onboarding.next') }}
          <ChevronRight :size="16" />
        </button>
        <button
          v-if="currentStep === totalSteps"
          @click="completeOnboarding"
          class="btn-primary flex-1 justify-center py-3 text-base"
        >
          <Sparkles :size="18" />
          {{ t('onboarding.start') }}
        </button>
      </div>
    </div>

    <!-- Logo footer -->
    <div class="mt-12 flex items-center gap-2 text-text-disabled text-xs">
      <img src="/images/logo-512.png" alt="FinNote" class="h-5 w-5 rounded-md" />
      <span>{{ t('common.version') }}</span>
    </div>
  </div>
</template>
