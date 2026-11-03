<script setup lang="ts">
// 1. Vue core
import { computed, onMounted } from 'vue'
// 2. Vue ecosystem
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
// 3. Stores
import { useReminderStore } from '@/stores/reminders'
// 4. Icons
import { Bell, ChevronRight, Clock, CalendarCheck2 } from 'lucide-vue-next'

const router = useRouter()
const reminderStore = useReminderStore()
const { t, locale } = useI18n()

onMounted(() => {
  if (!reminderStore.reminders.length) {
    reminderStore.fetch()
  }
})

/** Top 3 active reminders sorted by eventDate ascending (soonest first) */
const upcomingReminders = computed(() =>
  [...reminderStore.activeReminders]
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
    .slice(0, 3)
)

function urgencyTextClass(level: 'normal' | 'warning' | 'urgent'): string {
  if (level === 'urgent') return 'text-error bg-error/10'
  if (level === 'warning') return 'text-warning bg-warning/10'
  return 'text-accent bg-accent/10'
}

function urgencyDotClass(level: 'normal' | 'warning' | 'urgent'): string {
  if (level === 'urgent') return 'bg-error'
  if (level === 'warning') return 'bg-warning'
  return 'bg-accent'
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  const loc = locale.value === 'vi' ? 'vi-VN' : 'en-US'
  if (isToday) {
    return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit' })
}
</script>

<template>
  <!-- Widget shell -->
  <div class="bg-bg-surface border-border-default rounded-2xl border p-4 flex flex-col gap-3" style="min-height: 9.5rem;">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Bell :size="15" />
        </div>
        <h3 class="text-sm font-semibold text-text-primary">{{ t('reminders.widgetTitle') }}</h3>
        <span
          v-if="reminderStore.activeCount > 0"
          class="inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 py-0.5 min-w-[1.1rem] bg-accent/15 text-accent"
        >
          {{ reminderStore.activeCount }}
        </span>
      </div>
      <button
        class="flex items-center gap-0.5 text-accent text-xs font-medium hover:opacity-80 transition-opacity"
        @click="router.push('/reminders')"
      >
        {{ t('dashboard.viewAll') }}
        <ChevronRight :size="14" />
      </button>
    </div>

    <!-- Skeleton -->
    <div v-if="reminderStore.loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="skeleton h-14 rounded-xl" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!upcomingReminders.length" class="flex flex-1 flex-col items-center justify-center gap-1 py-4">
      <CalendarCheck2 :size="28" class="text-text-disabled mb-2" />
      <p class="text-text-disabled text-sm">{{ t('reminders.empty') }}</p>
      <button class="mt-1 text-xs text-accent hover:opacity-80 transition-opacity font-medium" @click="router.push('/reminders')">
        + {{ t('reminders.create') }}
      </button>
    </div>

    <!-- Reminder list -->
    <div v-else class="space-y-2.5">
      <div
        v-for="r in upcomingReminders"
        :key="r.id"
        class="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors bg-bg-elevated hover:bg-bg-hover"
        @click="router.push('/reminders')"
      >
        <!-- Urgency dot -->
        <span
          class="w-2 h-2 shrink-0 rounded-full"
          :class="urgencyDotClass(reminderStore.getCountdown(r.eventDate).level)"
        />

        <!-- Content -->
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-text-primary min-w-0 wrap-break-word leading-tight">{{ r.title }}</p>
          <div class="flex items-center gap-1 text-[11px] text-text-disabled mt-0.5">
            <Clock :size="11" />
            {{ formatEventDate(r.eventDate) }}
          </div>
        </div>

        <!-- Countdown badge -->
        <span
          class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          :class="urgencyTextClass(reminderStore.getCountdown(r.eventDate).level)"
        >
          {{ reminderStore.getCountdown(r.eventDate).text }}
        </span>
      </div>
    </div>

  </div>
</template>
