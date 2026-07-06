<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import PinDialog from '@/components/PinDialog.vue'
import BugReportModal from '@/components/ui/BugReportModal.vue'
import ContactFeedbackModal from '@/components/ui/ContactFeedbackModal.vue'
import BuyMeCoffeeModal from '@/components/ui/BuyMeCoffeeModal.vue'
import PwaInstallGuide from '@/components/ui/PwaInstallGuide.vue'
import PullToRefresh from '@/components/ui/PullToRefresh.vue'
import FinanceAiAdvisor from '@/modules/finance/components/FinanceAiAdvisor.vue'
import CatStoryModal from '@/components/ui/CatStoryModal.vue'
import { ArrowUp } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useNotesStore } from '@/stores/notes'
import { useFinanceStore } from '@/stores/finance'
import { useAuthStore } from '@/stores/auth'
import { useEventListener } from '@/composables/useEventListener'
import { useFaviconBadge } from '@/composables/useFaviconBadge'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const ui = useUiStore()
const notificationStore = useNotificationStore()
const notesStore = useNotesStore()
const financeStore = useFinanceStore()
const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

// 🔴 Browser tab red dot when there are unread notifications
useFaviconBadge(computed(() => notificationStore.unreadCount))

const showScrollTop = ref(false)
const mainRef = ref<HTMLElement | null>(null)

function handleScroll(e: Event) {
  const target = e.target as HTMLElement
  showScrollTop.value = target.scrollTop > 300
}

function scrollToTop() {
  if (mainRef.value) {
    mainRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

let _lastSyncTime = 0
let _lastToastedNotifId: string | null = null

async function syncOnVisible() {
  if (document.visibilityState === 'visible') {
    // 1. Sync new data from server
    if (Date.now() - _lastSyncTime > 5_000) {
      await notificationStore.fetch(true)
      financeStore.silentRefresh()
      _lastSyncTime = Date.now()
    }

    // 2. Push toast for the latest unread notification when user returns to tab
    const latestUnread = notificationStore.notifications.find(n => !n.read)
    if (latestUnread && latestUnread.id !== _lastToastedNotifId) {
      _lastToastedNotifId = latestUnread.id
      ui.showToast('info', `🔔 ${latestUnread.title}`)
    }
  }
}

// ── Sync Guide: 5-minute delay ──
// sessionStorage: don't show again in this tab
// localStorage ('sn_sync_guide_shown'): permanent dismiss after clicking "Tìm hiểu"
// On logout → localStorage key is cleared so guide resets for next user/session

const GUIDE_LOCAL_KEY = 'sn_sync_guide_shown'
const GUIDE_SESSION_KEY = 'sn_sync_guide_session'
const GUIDE_DELAY_MS = 5 * 60 * 1000 // 5 minutes

let guideTimer: ReturnType<typeof setTimeout> | null = null

function scheduleGuide() {
  // Already permanently dismissed (user clicked "Tìm hiểu" before)
  if (localStorage.getItem(GUIDE_LOCAL_KEY)) return
  // Already shown in this tab session
  if (sessionStorage.getItem(GUIDE_SESSION_KEY)) return
  // Only show to logged-in users
  if (!auth.isAuthenticated) return

  guideTimer = setTimeout(async () => {
    // Re-check conditions (user may have logged out or navigated away)
    if (localStorage.getItem(GUIDE_LOCAL_KEY)) return
    if (sessionStorage.getItem(GUIDE_SESSION_KEY)) return
    if (!auth.isAuthenticated) return

    // Mark as shown for this tab (sessionStorage)
    sessionStorage.setItem(GUIDE_SESSION_KEY, 'true')

    const confirmed = await ui.requestConfirm({
      title: t('guide.syncTitle'),
      message: t('guide.syncMessage'),
      confirmText: t('guide.syncAction'),
      cancelText: t('common.close'),
      danger: false
    })

    if (confirmed) {
      // User clicked "Tìm hiểu" → permanent cache in localStorage
      localStorage.setItem(GUIDE_LOCAL_KEY, 'true')
      router.push('/auto-sync')
    }
  }, GUIDE_DELAY_MS)
}

// ── AI Cat Story ──
let storyTimer: ReturnType<typeof setInterval> | null = null

async function triggerAiStory() {
  if (document.visibilityState !== 'visible' || !auth.isAuthenticated) return
  if (ui.showStoryModal || ui.showWeeklyEvent) return

  try {
    const { httpClient } = await import('@/shared/api/httpClient')
    const res = await httpClient.post<{ data: string }>('/api/ai', { action: 'cat_story' })
    if (res?.data) {
      let text = res.data.trim()
      // Llama might wrap json in markdown like ```json ... ```
      if (text.startsWith('```json')) text = text.replace(/```json/g, '')
      if (text.startsWith('```')) text = text.replace(/```/g, '')
      text = text.trim()

      const parsed = JSON.parse(text)
      if (Array.isArray(parsed) && parsed.length > 0) {
        ui.storyMessages = parsed
        ui.showStoryModal = true
      }
    }
  } catch (error) {
    console.error('Failed to trigger AI story:', error)
  }
}

onMounted(async () => {
  // Initial data fetches (guarded by auth inside each store)
  await notificationStore.fetch(true)   // force fetch — always get latest on mount
  
  // Set initial latest unread so we don't toast it on first load
  const initialLatest = notificationStore.notifications.find(n => !n.read)
  if (initialLatest) {
    _lastToastedNotifId = initialLatest.id
  }

  financeStore.silentRefresh()    // also refresh finance data immediately
  if (notesStore.notes.length === 0) {
    notesStore.fetchNotes()
  }
  _lastSyncTime = Date.now()

  // Schedule sync guide after 5 minutes
  scheduleGuide()

  // Start AI Story loop (every 5 mins)
  storyTimer = setInterval(triggerAiStory, 5 * 60 * 1000)
})

onBeforeUnmount(() => {
  if (guideTimer) {
    clearTimeout(guideTimer)
    guideTimer = null
  }
  if (storyTimer) {
    clearInterval(storyTimer)
    storyTimer = null
  }
})

// Sync when user switches back to the app
useEventListener(document, 'visibilitychange', syncOnVisible)

async function handleRefresh(done: () => void) {
  try {
    await Promise.all([
      notificationStore.fetch(true),
      financeStore.silentRefresh(),
      notesStore.fetchNotes()
    ])
  } catch (error) {
    console.error('Failed to refresh data:', error)
  } finally {
    done()
  }
}
</script>

<template>
  <div class="bg-bg-primary min-h-screen relative">
    <AppHeader />
    <AppSidebar />
    <main
      ref="mainRef"
      @scroll="handleScroll"
      class="pwa-main-safe bg-bg-primary fixed top-[3.5rem] right-0 bottom-0 w-full overflow-y-auto transition-all duration-300 scroll-smooth"
      style="-webkit-overflow-scrolling: touch; overscroll-behavior-y: contain;"
      :class="ui.sidebarOpen ? 'md:w-[calc(100%-16.25rem)]' : 'md:w-[calc(100%-3.75rem)]'"
    >
      <PullToRefresh @refresh="handleRefresh">
        <div class="mx-auto w-full max-w-[90rem] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8 min-h-[calc(100vh-3.5rem)]">
          <router-view v-slot="{ Component }">
            <transition
              name="fade"
              mode="out-in"
            >
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </PullToRefresh>
    </main>

    <!-- Scroll To Top Button -->
    <transition name="fade">
      <button 
        v-if="showScrollTop"
        @click="scrollToTop"
        class="pwa-fab-safe fixed bottom-[5.5rem] sm:bottom-[6.5rem] right-6 sm:right-8 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-bg-surface text-text-secondary shadow-[0_4px_15px_rgba(0,0,0,0.1)] ring-1 ring-border-default hover:text-text-primary hover:bg-bg-hover transition-all active:scale-95"
        :title="t('common.scrollToTop')"
      >
        <ArrowUp class="h-5 w-5" />
      </button>
    </transition>
    
    <!-- Global AI Advisor -->
    <FinanceAiAdvisor />


    <BugReportModal 
      :show="ui.showBugReport" 
      @close="ui.showBugReport = false" 
    />
    <ContactFeedbackModal 
      :show="ui.showContactFeedback" 
      @close="ui.showContactFeedback = false" 
    />
    <BuyMeCoffeeModal 
      :show="ui.showBuyMeCoffee" 
      @close="ui.showBuyMeCoffee = false" 
    />
    <PwaInstallGuide />
    <CatStoryModal />
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
