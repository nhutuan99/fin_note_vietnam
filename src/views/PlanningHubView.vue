<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Target, PieChart, Repeat, CreditCard, PiggyBank, ArrowRight, HandCoins, Bell } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()

const features = computed(() => {
  const items = []
  
  items.push(
    {
      id: 'budget',
      key: 'nav.budget',
      desc: 'budget.setupHint',
      icon: PieChart,
      color: '#3b82f6',
      route: '/budget'
    },
    {
      id: 'savings',
      key: 'nav.savings',
      desc: 'savings.emptyHint',
      icon: PiggyBank,
      color: '#10b981',
      route: '/savings'
    },
    {
      id: 'recurring',
      key: 'nav.recurring',
      desc: 'recurring.emptyHint',
      icon: Repeat,
      color: '#8b5cf6',
      route: '/recurring'
    },
    {
      id: 'subscriptions',
      key: 'nav.subscriptions',
      desc: 'subs.emptyHint',
      icon: CreditCard,
      color: '#f59e0b',
      route: '/subscriptions'
    },
    {
      id: 'debts',
      key: 'debt.title',
      desc: 'debt.emptyHint',
      icon: HandCoins,
      color: '#ef4444',
      route: '/debts'
    },
    {
      id: 'reminders',
      key: 'reminders.title',
      desc: 'reminders.emptyDesc',
      icon: Bell,
      color: '#8e7dfa',
      route: '/reminders'
    }
  )

  return items
})
</script>

<template>
  <div class="mx-auto max-w-[68rem]">
    <!-- Header -->
    <div class="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 p-8 border border-accent/20">
      <div class="absolute -right-10 -top-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -left-10 -bottom-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div class="relative z-10 flex items-start justify-between">
        <div>
          <h1 class="text-3xl font-bold tracking-tight mb-3 flex items-center gap-3">
            <Target :size="28" class="text-accent" />
            {{ t('nav.planning') }}
          </h1>
          <p class="text-text-secondary text-base max-w-xl">
            {{ t('planning.description') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div
        v-for="feat in features"
        :key="feat.id"
        @click="router.push(feat.route)"
        class="group cursor-pointer bg-bg-surface border border-border-default hover:border-accent/40 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-1 relative overflow-hidden"
      >
        <div class="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <div class="relative z-10 flex flex-col h-full">
          <div class="flex items-center justify-between mb-5">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110"
              :style="{ backgroundColor: feat.color + '15', color: feat.color }"
            >
              <component :is="feat.icon" :size="28" />
            </div>
            <div class="h-10 w-10 rounded-full bg-bg-elevated flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors duration-300 text-text-tertiary">
              <ArrowRight :size="18" />
            </div>
          </div>
          <h3 class="text-xl font-bold mb-2">{{ t(feat.key) }}</h3>
          <p class="text-text-tertiary text-sm leading-relaxed flex-1">
            {{ t(feat.desc) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
