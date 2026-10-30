<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/finance'
import { getCategoryConfig, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'
import { useI18n } from 'vue-i18n'
import type { TransactionType } from '@/types'
import { ArrowLeft, Check, ArrowUpRight, ArrowDownRight, Plus, ChevronDown } from 'lucide-vue-next'
import CurrencyInput from '@/components/ui/CurrencyInput.vue'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'

const { t } = useI18n()
const router = useRouter()
const finance = useFinanceStore()

onMounted(() => finance.fetchWallets())

const type = ref<TransactionType>('expense')
const amount = ref<number>(0)
const category = ref('food')
const walletId = ref(finance.wallets[0]?.id || '')
const note = ref('')

// Get local date instead of UTC
function getLocalDateString() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().substring(0, 10)
}
const date = ref(getLocalDateString())
const showCategoryPicker = ref(false)

// Hide auto-only categories from manual entry (bank_transfer, bank_receive, bank_fee are assigned by SMS/webhook)
const AUTO_ONLY_KEYS = new Set(['bank_transfer', 'bank_receive', 'bank_fee'])

const availableCategories = computed(() => {
  const cats = type.value === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  return cats.filter(c => !AUTO_ONLY_KEYS.has(c.key))
})

const selectedCategory = computed(() => getCategoryConfig(category.value))

const isValid = computed(() => {
  return amount.value > 0 && walletId.value && category.value
})



const isSubmitting = ref(false)

async function submit() {
  if (!isValid.value || isSubmitting.value) return
  isSubmitting.value = true

  try {
    await finance.addTransaction({
      type: type.value,
      amount: amount.value,
      category: category.value,
      note: note.value,
      walletId: walletId.value,
      source: 'manual',
      date: date.value
    })

    router.push('/')
  } finally {
    isSubmitting.value = false
  }
}

</script>

<template>
  <div class="mx-auto max-w-[31.25rem]">
    <!-- Header -->
    <div class="mb-6 flex items-center gap-3">
      <button
        @click="router.back()"
        class="text-text-secondary hover:bg-bg-hover hover:text-text-primary flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
      >
        <ArrowLeft :size="18" />
      </button>
      <h1 class="text-xl font-bold tracking-tight">{{ t('addTx.title') }}</h1>
    </div>

    <!-- Type Toggle -->
    <div class="border-border-default mb-6 flex overflow-hidden rounded-xl border">
      <button
        class="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all duration-150"
        :class="
          type === 'expense'
            ? 'bg-error/10 text-error border-border-default border-r'
            : 'bg-bg-surface text-text-tertiary border-border-default hover:bg-bg-hover border-r'
        "
        @click="type = 'expense'; category = 'food'"
      >
        <ArrowDownRight :size="16" />
        {{ t('addTx.expense') }}
      </button>
      <button
        class="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-all duration-150"
        :class="
          type === 'income'
            ? 'bg-success/10 text-success'
            : 'bg-bg-surface text-text-tertiary hover:bg-bg-hover'
        "
        @click="type = 'income'; category = 'salary'"
      >
        <ArrowUpRight :size="16" />
        {{ t('addTx.income') }}
      </button>
    </div>

    <!-- Amount -->
    <div class="mb-6">
      <label class="text-text-secondary mb-2 block text-sm font-medium">{{ t('addTx.amount') }}</label>
      <div class="relative">
        <CurrencyInput
          v-model="amount"
          placeholder="0"
          className="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-4 text-center text-3xl font-bold transition-all duration-150 focus:ring-2 focus:outline-none tracking-wide"
        />
      </div>
    </div>

    <!-- Category -->
    <div class="mb-6">
      <label class="text-text-secondary mb-2 block text-sm font-medium">{{ t('addTx.category') }}</label>
      <button
        class="border-border-default bg-bg-surface hover:border-border-strong flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all duration-150"
        @click="showCategoryPicker = !showCategoryPicker"
      >
        <span class="flex items-center gap-2">
          <span class="text-lg">{{ selectedCategory.icon }}</span>
          <span class="text-text-primary text-sm">{{ t(`categories.${selectedCategory.key}`) }}</span>
        </span>
        <ChevronDown
          :size="16"
          class="text-text-tertiary transition-transform duration-150"
          :class="showCategoryPicker ? 'rotate-180' : ''"
        />
      </button>

      <!-- Picker -->
      <transition name="slide">
        <div
          v-if="showCategoryPicker"
          class="mt-2 grid grid-cols-3 gap-2"
        >
          <button
            v-for="cat in availableCategories"
            :key="cat.key"
            class="flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-150"
            :class="
              category === cat.key
                ? 'border-accent bg-accent-subtle'
                : 'border-border-default bg-bg-surface hover:border-border-strong'
            "
            @click="category = cat.key; showCategoryPicker = false"
          >
            <span class="text-xl">{{ cat.icon }}</span>
            <span class="text-text-secondary text-[0.6875rem]">{{ t(`categories.${cat.key}`) }}</span>
          </button>
        </div>
      </transition>
    </div>

    <!-- Wallet -->
    <div class="mb-6">
      <label class="text-text-secondary mb-2 block text-sm font-medium">{{ t('addTx.wallet') }}</label>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="w in finance.wallets"
          :key="w.id"
          class="flex flex-col items-center gap-1 rounded-xl border p-3 transition-all duration-150"
          :class="
            walletId === w.id
              ? 'border-accent bg-accent-subtle'
              : 'border-border-default bg-bg-surface hover:border-border-strong'
          "
          @click="walletId = w.id"
        >
          <div v-if="w.customLogoUrl" class="flex h-7 w-7 shrink-0 overflow-hidden rounded-[4px] bg-white border border-border-default shadow-sm p-1">
            <img
              :src="w.customLogoUrl"
              :alt="w.name"
              class="h-full w-full object-contain object-center"
              loading="lazy"
            />
          </div>
          <div v-else-if="getWalletBrand(w.name)?.logoUrl" class="flex h-7 w-7 shrink-0 overflow-hidden rounded-[4px] bg-white border border-border-default shadow-sm p-1">
            <img
              :src="getWalletBrand(w.name)!.logoUrl"
              :alt="w.name"
              class="h-full w-full object-contain object-center"
              loading="lazy"
            />
          </div>
          <div
            v-else-if="getWalletBrand(w.name)"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[10px] font-bold shadow-sm"
            :style="{ backgroundColor: getWalletBrand(w.name)!.bgColor, color: getWalletBrand(w.name)!.textColor }"
          >
            {{ getWalletBrand(w.name)!.abbr }}
          </div>
          <span v-else class="text-lg">{{ w.icon }}</span>
          <span class="text-text-secondary w-full truncate text-center text-[0.6875rem]">
            {{ w.name }}
          </span>
        </button>

        <!-- Thêm ví mới -->
        <button
          class="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong bg-bg-surface hover:bg-bg-hover hover:border-accent/50 p-3 transition-all duration-150"
          @click="router.push('/wallets')"
        >
          <div class="flex h-7 w-7 items-center justify-center rounded-[4px] bg-bg-elevated text-text-tertiary">
             <Plus :size="16" />
          </div>
          <span class="text-text-secondary w-full truncate text-center text-[0.6875rem]">
            {{ t('addTx.addWallet') }}
          </span>
        </button>
      </div>
    </div>

    <!-- Note -->
    <div class="mb-6">
      <label class="text-text-secondary mb-2 block text-sm font-medium">{{ t('addTx.note') }}</label>
      <input
        v-model="note"
        type="text"
        :placeholder="t('addTx.notePlaceholder')"
        class="border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all duration-150 focus:ring-2 focus:outline-none"
      />
    </div>

    <!-- Date (Custom Picker) -->
    <div class="mb-8">
      <CustomDatePicker
        v-model="date"
        :label="t('addTx.date')"
      />
    </div>

    <!-- Submit -->
    <button
      :disabled="!isValid || isSubmitting"
      @click="submit"
      class="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all duration-150"
      :class="
        type === 'expense'
          ? 'bg-error text-white hover:opacity-90 disabled:opacity-40'
          : 'bg-success text-white hover:opacity-90 disabled:opacity-40'
      "
    >
      <AppSpinner v-if="isSubmitting" :size="18"  />
      <Check v-else :size="18" />
      {{ type === 'expense' ? t('addTx.submitExpense') : t('addTx.submitIncome') }}
    </button>
  </div>
</template>

<style>
.slide-enter-active,
.slide-leave-active {
  transition:
    max-height 200ms ease,
    opacity 200ms ease;
  overflow: hidden;
}
.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}
.slide-enter-to,
.slide-leave-from {
  max-height: 31.25rem;
  opacity: 1;
}
</style>
