<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReminderStore, type ReminderFilter } from '@/stores/reminders'
import { useUiStore } from '@/stores/ui'
import type { Reminder, ReminderSuggestion } from '@/types'
import CreateReminderModal from '@/components/ui/CreateReminderModal.vue'
import ReminderSuggestionModal from '@/components/ui/ReminderSuggestionModal.vue'
import CleanupExpiredModal from '@/components/ui/CleanupExpiredModal.vue'
import {
  Bell, Plus, Check, Clock, CalendarDays, Trash2,
  CheckCircle2, AlertCircle, Timer, BellRing, Repeat, Eye,
  Sparkles, Loader, Link
} from 'lucide-vue-next'

const { t, locale } = useI18n()
const store = useReminderStore()
const ui = useUiStore()

const isAiFocused = ref(false)

const showCreateModal = ref(false)
const showCleanupModal = ref(false)
const editingReminder = ref<Reminder | null>(null)

const tabs: { key: ReminderFilter; label: string }[] = [
  { key: 'all', label: 'reminders.all' },
  { key: 'active', label: 'reminders.active' },
  { key: 'completed', label: 'reminders.completed' },
]

const aiSuggestions = ref<any[]>([])

const expiredReminders = computed(() => {
  return store.reminders.filter(r => r.status === 'expired')
})

onMounted(() => {
  store.fetch()
})

function openCreate() {
  editingReminder.value = null
  showCreateModal.value = true
}

function openEdit(reminder: Reminder) {
  editingReminder.value = reminder
  showCreateModal.value = true
}

function getDisplayUrl(url: string) {
  try {
    const obj = new URL(url)
    return obj.hostname + (obj.pathname !== '/' ? '...' : '')
  } catch {
    return url.length > 30 ? url.substring(0, 30) + '...' : url
  }
}

async function handleDelete(id: string) {
  const confirmed = await ui.requestConfirm({
    title: t('reminders.deleteConfirm'),
    message: t('reminders.deleteMessage'),
    danger: true,
    confirmText: t('common.delete')
  })
  if (confirmed) {
    const ok = await store.remove(id)
    if (ok) ui.showToast('success', t('reminders.deleted'))
  }
}

async function handleComplete(id: string) {
  const ok = await store.complete(id)
  if (ok) ui.showToast('success', t('reminders.markedComplete'))
}

async function handleAcknowledge(id: string) {
  const ok = await store.acknowledge(id)
  if (ok) ui.showToast('success', t('reminders.acknowledged'))
}

function handleModalClose() {
  showCreateModal.value = false
  editingReminder.value = null
}

async function handleClearReminders() {
  const isConfirmed = await ui.requestConfirm({
    title: t('reminders.deleteAllTitle'),
    message: t('reminders.deleteAllMessage', { filter: store.filter === 'all' ? t('reminders.all') : store.filter === 'active' ? t('reminders.active') : t('reminders.completed') }),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true
  })
  
  if (!isConfirmed) return

  try {
    const success = await store.clear(store.filter)
    if (success) {
      ui.showToast('success', t('reminders.clearSuccess'))
    } else {
      ui.showToast('error', t('common.somethingWentWrong'))
    }
  } catch {
    ui.showToast('error', t('common.somethingWentWrong'))
  }
}

function handleModalSaved() {
  showCreateModal.value = false
  editingReminder.value = null
  store.fetch()
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale.value, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

const offsetLabels: Record<string, string> = {
  '15m': '15p', '30m': '30p', '1h': '1h', '2h': '2h', '3h': '3h',
  '1d': '1 ngày', '2d': '2 ngày', '3d': '3 ngày', '1w': '1 tuần',
}

function getStatusIcon(status: string) {
  if (status === 'active') return BellRing
  if (status === 'completed') return CheckCircle2
  return AlertCircle
}

function getStatusColor(status: string) {
  if (status === 'active') return 'text-accent'
  if (status === 'completed') return 'text-success'
  return 'text-text-disabled'
}
function formatDescription(text: string) {
  if (!text) return ''
  const escapeHtml = (unsafe: string) => unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  
  let formatted = escapeHtml(text)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  formatted = formatted.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" class="text-accent hover:underline inline-flex items-center gap-[0.125rem]" onclick="event.stopPropagation()" title="Mở liên kết">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
      ${url}
    </a>`
  })
  return formatted.replace(/\n/g, '<br>')
}

// ── Timeline grouping ──
interface DateGroup {
  dateKey: string
  label: string
  relative: string
  level: 'normal' | 'warning' | 'urgent'
  reminders: Reminder[]
}

const groupedReminders = computed<DateGroup[]>(() => {
  const groups = new Map<string, Reminder[]>()
  for (const r of store.filtered) {
    const d = new Date(r.eventDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, items]) => {
      const d = new Date(dateKey + 'T00:00:00')
      const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000)
      let relative = ''
      let level: 'normal' | 'warning' | 'urgent' = 'normal'

      if (diffDays < 0) { relative = t('reminders.timelineDaysAgo', { n: Math.abs(diffDays) }); level = 'urgent' }
      else if (diffDays === 0) { relative = t('reminders.timelineToday'); level = 'urgent' }
      else if (diffDays === 1) { relative = t('reminders.timelineTomorrow'); level = 'warning' }
      else if (diffDays <= 3) { relative = t('reminders.timelineDaysLeft', { n: diffDays }); level = 'warning' }
      else { relative = t('reminders.timelineDaysLeft', { n: diffDays }); level = 'normal' }

      return {
        dateKey,
        label: d.toLocaleDateString(locale.value, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
        relative,
        level,
        reminders: items.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()),
      }
    })
})

</script>

<template>
  <div class="reminders-page mx-auto max-w-[68rem]">
    <!-- Header -->
    <div class="reminders-hero mb-8">
      <div class="hero-glow hero-glow--1" />
      <div class="hero-glow hero-glow--2" />
      <div class="hero-content">
        <div>
          <h1 class="text-3xl font-bold tracking-tight mb-3 flex items-center gap-3">
            <Bell :size="28" class="text-accent" />
            {{ t('reminders.title') }}
          </h1>
          <p class="text-text-secondary text-base max-w-xl">
            {{ t('reminders.subtitle') }}
          </p>
        </div>
        <button
          id="create-reminder-btn"
          @click="openCreate"
          class="hero-create-btn"
        >
          <Plus :size="18" />
          <span class="hidden sm:inline">{{ t('reminders.create') }}</span>
        </button>
      </div>
    </div>


    <!-- Filter Tabs & Actions -->
    <div class="mb-6 flex items-center justify-between gap-4">
      <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="store.filter = tab.key"
          class="flex items-center gap-1.5 px-4 py-2 rounded-full text-[0.8125rem] font-medium whitespace-nowrap transition-all duration-150 border"
          :class="store.filter === tab.key
            ? 'bg-accent/10 border-accent/30 text-accent font-semibold shadow-[0_0_12px_rgba(142,125,250,0.1)]'
            : 'bg-bg-elevated border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary hover:border-border-strong'"
        >
          {{ t(tab.label) }}
          <span v-if="tab.key === 'active' && store.activeCount > 0" 
                class="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full text-[0.625rem] font-bold bg-accent text-white shadow-sm">
            {{ store.activeCount }}
          </span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button 
          v-if="expiredReminders.length > 0"
          @click="showCleanupModal = true"
          class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-warning bg-warning/10 hover:bg-warning/20 transition-colors"
          :title="t('reminders.cleanupTitle')"
        >
          <Sparkles :size="14" />
          <span class="hidden sm:inline">{{ t('reminders.cleanupBtn', { n: expiredReminders.length }) }}</span>
        </button>

        <button 
          v-if="store.filtered.length > 0"
          @click="handleClearReminders"
          class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-error bg-error/10 hover:bg-error/20 transition-colors"
          :title="t('reminders.deleteAll')"
        >
          <Trash2 :size="14" />
          <span class="hidden sm:inline">{{ t('reminders.deleteAll') }}</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="store.loading && store.reminders.length === 0" class="space-y-4">
      <div v-for="i in 3" :key="i" class="skeleton-card">
        <div class="skeleton h-5 w-2/3 mb-3" />
        <div class="skeleton h-4 w-1/2 mb-2" />
        <div class="skeleton h-3 w-1/3" />
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="store.filtered.length === 0" class="flex flex-col items-center justify-center py-16 px-4">
      <div class="w-20 h-20 flex items-center justify-center rounded-3xl bg-accent/10 text-accent mb-6 shadow-[0_0_30px_rgba(142,125,250,0.15)] border border-accent/20">
        <Bell :size="40" />
      </div>
      <h3 class="text-xl font-bold mb-2">{{ t('reminders.empty') }}</h3>
      <p class="text-text-tertiary text-sm mb-8 max-w-[280px] text-center leading-relaxed">
        {{ t('reminders.emptyDesc') }}
      </p>
      <button @click="openCreate" class="flex items-center gap-2 px-6 py-3 rounded-full text-[0.875rem] font-bold text-white bg-accent hover:bg-accent-hover transition-all duration-200 shadow-[0_4px_16px_rgba(142,125,250,0.3)] hover:shadow-[0_6px_24px_rgba(142,125,250,0.4)] hover:-translate-y-0.5">
        <Plus :size="18" />
        {{ t('reminders.create') }}
      </button>
    </div>

    <!-- Timeline Layout -->
    <div v-else class="timeline">
      <div
        v-for="group in groupedReminders"
        :key="group.dateKey"
        class="timeline-group"
      >
        <!-- Date Header -->
        <div class="timeline-date-header">
          <div class="timeline-dot" :class="`timeline-dot--${group.level}`" />
          <div class="timeline-date-info">
            <span class="timeline-date-label">{{ group.label }}</span>
            <span
              class="timeline-relative"
              :class="`timeline-relative--${group.level}`"
            >
              {{ group.relative }}
            </span>
          </div>
        </div>

        <!-- Cards Grid -->
        <div class="timeline-cards">
          <div
            v-for="reminder in group.reminders"
            :key="reminder.id"
            class="tl-card"
            :class="[
              `tl-card--${reminder.status}`,
              { 'tl-card--acknowledged': reminder.acknowledged }
            ]"
            @click="openEdit(reminder)"
          >
            <!-- Top Row: time + countdown + actions -->
            <div class="tl-card__top">
              <div class="flex items-center gap-2 min-w-0">
                <span class="tl-card__time">
                  <Clock :size="12" class="opacity-50" />
                  {{ formatTime(reminder.eventDate) }}
                </span>
                <span
                  v-if="reminder.status === 'active'"
                  class="countdown-badge"
                  :class="`countdown-badge--${store.getCountdown(reminder.eventDate).level}`"
                >
                  {{ store.getCountdown(reminder.eventDate).text }}
                </span>
                <span v-else class="text-[0.625rem] font-medium" :class="getStatusColor(reminder.status)">
                  {{ reminder.status === 'completed' ? '✓ ' + t('reminders.completed') : t('reminders.expired') }}
                </span>
              </div>
              <div class="tl-card__actions" @click.stop>
                <button
                  v-if="reminder.status === 'active'"
                  @click="handleComplete(reminder.id)"
                  class="action-btn action-btn--check"
                  :title="t('reminders.markComplete')"
                >
                  <Check :size="13" />
                </button>
                <button
                  @click="handleDelete(reminder.id)"
                  class="action-btn action-btn--delete"
                  :title="t('common.delete')"
                >
                  <Trash2 :size="13" />
                </button>
              </div>
            </div>

            <!-- Title -->
            <h3 class="tl-card__title" :class="{ 'line-through opacity-50': reminder.status === 'completed' }">
              {{ reminder.title }}
            </h3>

            <!-- Description (truncated) -->
            <p v-if="reminder.description" class="tl-card__desc" v-html="formatDescription(reminder.description)"></p>

            <!-- URL -->
            <a
              v-if="reminder.url"
              :href="reminder.url"
              target="_blank"
              class="tl-card__url"
              @click.stop
            >
              <Link :size="11" class="shrink-0" />
              <span class="truncate">{{ getDisplayUrl(reminder.url) }}</span>
            </a>

            <!-- Footer: offsets + meta -->
            <div class="tl-card__footer">
              <div class="tl-card__offsets">
                <span
                  v-for="offset in reminder.offsets"
                  :key="offset"
                  class="offset-pill"
                >
                  {{ offsetLabels[offset] || offset }}
                </span>
              </div>
              <span
                v-if="reminder.repeatInterval && reminder.repeatInterval !== 'none'"
                class="repeat-badge"
              >
                <Repeat :size="10" />
                {{ store.getRepeatLabel(reminder.repeatInterval) }}
              </span>
              <button
                v-if="reminder.status === 'active' && !reminder.acknowledged"
                @click.stop="handleAcknowledge(reminder.id)"
                class="ack-btn"
              >
                <Eye :size="12" />
                {{ t('reminders.iRemember') }}
              </button>
              <span v-else-if="reminder.acknowledged && reminder.status === 'active'" class="ack-done">
                ✓ {{ t('reminders.remembered') }}
              </span>
              <span v-if="reminder.sourceType === 'note'" class="reminder-source">
                📝 {{ t('reminders.fromNote') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- FAB (mobile) -->
    <button
      v-if="store.reminders.length > 0"
      @click="openCreate"
      class="fab pwa-fab-safe"
    >
      <Plus :size="22" />
    </button>

    <!-- Create/Edit Modal -->
    <CreateReminderModal
      v-if="showCreateModal"
      :reminder="editingReminder"
      @close="handleModalClose"
      @saved="handleModalSaved"
      @suggestions="(s) => { showCreateModal = false; aiSuggestions = s; }"
    />

    <!-- AI Suggestion Modal -->
    <ReminderSuggestionModal
      v-if="aiSuggestions.length > 0"
      :suggestions="aiSuggestions"
      @close="aiSuggestions = []"
      @created="() => { aiSuggestions = []; store.fetch(); }"
    />
    
    <!-- Cleanup Expired Modal -->
    <CleanupExpiredModal
      v-if="showCleanupModal"
      :reminders="expiredReminders"
      @close="showCleanupModal = false"
      @cleaned="showCleanupModal = false; store.fetch()"
    />
  </div>
</template>

<style scoped>
/* ── Hero ── */
.reminders-hero {
  position: relative;
  overflow: hidden;
  border-radius: 1.5rem;
  background: linear-gradient(135deg, rgba(142, 125, 250, 0.2), rgba(142, 125, 250, 0.05));
  padding: 2rem;
  border: 1px solid rgba(142, 125, 250, 0.2);
}
.hero-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(3rem);
}
.hero-glow--1 { right: -2.5rem; top: -2.5rem; width: 10rem; height: 10rem; background: rgba(142, 125, 250, 0.2); }
.hero-glow--2 { left: -2.5rem; bottom: -2.5rem; width: 10rem; height: 10rem; background: rgba(142, 125, 250, 0.1); }
.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.hero-create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(142, 125, 250, 0.25);
  white-space: nowrap;
  flex-shrink: 0;
}
.hero-create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(142, 125, 250, 0.35);
  background: var(--accent-hover);
}
.hero-create-btn:active {
  transform: translateY(0);
}

/* ── Filter Tabs ── */
.filter-tab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.filter-tab:hover { background: var(--bg-hover); color: var(--text-primary); }
.filter-tab--active {
  background: var(--accent-subtle);
  color: var(--accent);
  font-weight: 600;
}
.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: var(--radius-full);
  font-size: 0.625rem;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
}

/* ── Skeleton ── */
.skeleton-card {
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
}
.skeleton {
  border-radius: var(--radius-sm);
  background: var(--bg-hover);
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ── Empty State ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
}
.empty-icon {
  width: 5rem;
  height: 5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1.5rem;
  background: var(--accent-subtle);
  color: var(--accent);
  margin-bottom: 1.5rem;
}
.empty-cta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.5rem;
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(142, 125, 250, 0.25);
}
.empty-cta:hover {
  transform: translateY(-1px);
  background: var(--accent-hover);
}

/* ── Timeline Layout ── */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.timeline-group {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  /* The vertical line connecting groups */
  border-left: 2px solid var(--border-default);
  margin-left: 0.5rem;
  padding-left: 1.25rem;
  padding-bottom: 0.5rem;
}
/* Last group doesn't need the line extending past its content */
.timeline-group:last-child {
  border-left-color: transparent;
}

/* Timeline Header */
.timeline-date-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}
.timeline-dot {
  position: absolute;
  left: -1.65rem; /* center on the border */
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  background: var(--bg-surface);
  border: 2px solid var(--accent);
  box-shadow: 0 0 0 4px var(--bg-surface);
}
.timeline-dot--warning { border-color: var(--warning); }
.timeline-dot--urgent { border-color: var(--error); }
.timeline-dot--normal { border-color: var(--text-tertiary); }

.timeline-date-info {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.timeline-date-label {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}
.timeline-relative {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
}
.timeline-relative--urgent { background: rgba(251, 113, 133, 0.15); color: var(--error); }
.timeline-relative--warning { background: rgba(251, 191, 36, 0.15); color: var(--warning); }
.timeline-relative--normal { background: var(--bg-elevated); color: var(--text-secondary); }

/* Timeline Cards Grid */
.timeline-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
@media (min-width: 768px) {
  .timeline-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Compact Card */
.tl-card {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}
.tl-card:hover {
  border-color: rgba(142, 125, 250, 0.3);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}
.tl-card--completed,
.tl-card--expired {
  opacity: 0.6;
  background: var(--bg-elevated);
}
.tl-card--active {
  border-left: 3px solid var(--accent);
}

.tl-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
}
.tl-card__time {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.countdown-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  font-size: 0.625rem;
  font-weight: 700;
  background: var(--accent-subtle);
  color: var(--accent);
}
.countdown-badge--warning { background: rgba(251, 191, 36, 0.15); color: var(--warning); }
.countdown-badge--urgent { background: rgba(251, 113, 133, 0.15); color: var(--error); }

.tl-card__actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.tl-card:hover .tl-card__actions { opacity: 1; }
@media (max-width: 640px) { .tl-card__actions { opacity: 1; } }

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  transition: all 0.15s ease;
}
.action-btn:hover { background: var(--bg-hover); }
.action-btn--check:hover { color: var(--success); }
.action-btn--delete:hover { color: var(--error); }

.tl-card__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tl-card__desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  margin-bottom: 0.5rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tl-card__url {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--accent);
  background: var(--accent-subtle);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  margin-bottom: 0.5rem;
  max-width: 100%;
}
.tl-card__url:hover { text-decoration: underline; }

.tl-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.5rem;
}
.tl-card__offsets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.offset-pill {
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  font-size: 0.625rem;
  font-weight: 600;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}
.repeat-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm);
  font-size: 0.625rem;
  font-weight: 600;
  background: rgba(96, 165, 250, 0.12);
  color: var(--info);
}
.ack-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.625rem;
  font-weight: 600;
  background: rgba(251, 191, 36, 0.1);
  color: var(--warning);
  border: 1px solid rgba(251, 191, 36, 0.2);
  cursor: pointer;
  transition: all 0.15s ease;
}
.ack-btn:hover { background: rgba(251, 191, 36, 0.18); }
.ack-done {
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--success);
  opacity: 0.8;
}
.reminder-source {
  font-size: 0.625rem;
  color: var(--text-disabled);
}

/* ── FAB ── */
.fab {
  position: fixed;
  right: 1.25rem;
  bottom: 1.5rem;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(142, 125, 250, 0.35);
  transition: all 0.2s ease;
  z-index: 30;
}
.fab:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 24px rgba(142, 125, 250, 0.45);
}
.fab:active { transform: scale(0.95); }

@media (min-width: 768px) {
  .fab { display: none; }
}

/* ── Scrollbar hide ── */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
