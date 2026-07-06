<script setup lang="ts">
// 1. Vue core
import { computed, onMounted, ref } from 'vue'

// 2. Vue ecosystem
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'

// 3. Stores
import { useAuthStore } from '@/stores/auth'
import { useTradingStore } from '@/stores/trading'
import { useUiStore } from '@/stores/ui'

// 4. Composables
import { useDevice } from '@/composables/useDevice'
import { useEventListener } from '@/composables/useEventListener'
import { useSwipeNavigation } from '@/composables/useSwipeNavigation'

// 5. Components
import AppLayout from '@/components/layout/AppLayout.vue'
import TradingCheckinModal from '@/modules/finance/components/TradingCheckinModal.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import PinDialog from '@/components/PinDialog.vue'
import { ArrowLeft } from 'lucide-vue-next'

const route  = useRoute()
const auth   = useAuthStore()
const trading = useTradingStore()
const ui = useUiStore()
const { t, locale } = useI18n()
const { deviceType, isMobileOrTablet } = useDevice()

// Enable global edge-swipe navigation
useSwipeNavigation()

// ── Trading check-in auto-popup (once per calendar day) ──
const CHECKIN_KEY = 'sn_last_trading_checkin'
const showTradingCheckin = ref(false)

function maybeTriggerCheckin() {
  if (!auth.isAuthenticated) return
  const today = new Date().toISOString().substring(0, 10)
  const last = localStorage.getItem(CHECKIN_KEY)
  if (last === today) return
  // Only show if the user has configured wallets to track
  if (!trading.hasWalletsConfigured) return
  // Delay slightly to not block initial render
  setTimeout(() => {
    showTradingCheckin.value = true
    localStorage.setItem(CHECKIN_KEY, today)
  }, 2000)
}

/**
 * True when the current route should be rendered standalone (no AppLayout).
 * Used for login and onboarding screens.
 */
const isStandalonePage = computed(() => ['login', 'onboarding', 'landing'].includes(route.name as string))

/**
 * Public pages (blog) — rendered without sidebar, accessible without login.
 */
const isPublicPage = computed(() => !!route.meta.isPublic)

/**
 * Gate: only render AppLayout when:
 * 1. Auth state has been resolved (authReady)
 * 2. User is authenticated
 * 3. Current route is NOT a standalone page or public page
 */
const showLayout = computed(
  () => auth.authReady && auth.isAuthenticated && !isStandalonePage.value && !isPublicPage.value
)

// ─── Block double-tap zoom (mobile/tablet) ────────────────────────────────────
let lastTouchEnd = 0

function preventDoubleTapZoom(e: TouchEvent) {
  const now = Date.now()
  if (now - lastTouchEnd < 300) {
    e.preventDefault()
  }
  lastTouchEnd = now
}

if (isMobileOrTablet.value) {
  useEventListener(document, 'touchend', preventDoubleTapZoom as EventListener, { passive: false })
}

// ─── Clear PWA App Badge on open/focus ─────────────────────────────────────────
onMounted(async () => {
  const clearBadge = () => {
    if (navigator && 'clearAppBadge' in navigator) {
      ;(navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => {})
    }
  }

  clearBadge()

  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearBadge()
    }
  })

  // Load trading data then check if popup should fire
  if (auth.isAuthenticated) {
    await trading.fetchAll()
    maybeTriggerCheckin()
  }
})
</script>

<template>
  <div
    id="finnote-app"
    :class="[`device--${deviceType}`]"
  >
    <!--
      Standalone pages (login, onboarding, etc.)
      Rendered via router-view directly — no AppLayout wrapper.
    -->
    <div v-if="isStandalonePage" class="standalone-scroll">
      <router-view />
    </div>

    <!--
      Public pages (blog) — full-width, no sidebar, no auth required.
    -->
    <div v-else-if="isPublicPage" class="public-layout">
      <!-- Public Header for Unauthenticated Users to discover the app -->
      <header v-if="!auth.isAuthenticated" class="public-header">
        <div class="public-header__container">
          <router-link to="/landing" class="public-header__logo">
            <img src="/images/logo-512.png" alt="FinNote" class="w-8 h-8 object-contain" />
            <span class="font-bold text-[1.125rem] text-text-primary tracking-tight">FinNote</span>
          </router-link>
          <div class="public-header__right flex items-center gap-2 sm:gap-4">
            <div class="flex items-center gap-1">
              <button 
                @click="setLocale('vi')"
                :class="['text-[0.8125rem] font-semibold transition-colors rounded-lg px-2 py-1.5', locale === 'vi' ? 'text-accent bg-accent-subtle' : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover']"
              >
                VI
              </button>
              <span class="text-border-strong text-xs select-none">|</span>
              <button 
                @click="setLocale('en')"
                :class="['text-[0.8125rem] font-semibold transition-colors rounded-lg px-2 py-1.5', locale === 'en' ? 'text-accent bg-accent-subtle' : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover']"
              >
                EN
              </button>
            </div>
            <router-link to="/login" class="public-header__btn shrink-0">
              {{ t('common.login') }}
            </router-link>
          </div>
        </div>
      </header>
      <!-- In-App Floating Back Button for Authenticated Users -->
      <template v-else>
        <!-- Floating Button -->
        <div class="fixed left-4 z-50 flex items-center" style="top: max(env(safe-area-inset-top, 0px), 1rem)">
          <router-link to="/" class="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center">
            <ArrowLeft :size="20" />
          </router-link>
        </div>
        <!-- Spacer to push content down -->
        <div class="public-safe-spacer"></div>
      </template>

      <div class="public-layout__content custom-scrollbar">
        <router-view />
      </div>
    </div>

    <!--
      Authenticated app shell.
    -->
    <AppLayout v-else-if="showLayout" />

    <!-- Global Trading Check-in popup (auto-trigger once per day) -->
    <TradingCheckinModal v-model="showTradingCheckin" />

    <!-- Global Dialogs and Toasts -->
    <ToastContainer />
    <ConfirmDialog />
    <PinDialog 
      :show="ui.pinState.isOpen"
      :title="ui.pinState.title"
      :message="ui.pinState.message"
      @confirmed="ui.resolvePin(true)"
      @cancelled="ui.resolvePin(false)"
    />

    <!-- While auth resolves — render nothing -->
  </div>
</template>

<style>
#finnote-app {
  min-height: 100vh;
  min-height: 100dvh;
}

/* Standalone pages (landing, login, onboarding) — need their own scroll context */
.standalone-scroll {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: none;
}

/* ── Public Layout (Blog pages — no sidebar) ── */
.public-layout {
  height: 100vh;
  height: 100dvh;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
}
.public-header {
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  position: sticky;
  top: 0;
  z-index: 50;
  /* iOS PWA: push below system status bar */
  padding-top: env(safe-area-inset-top, 0px);
}
.public-header__container {
  max-width: 72rem;
  margin: 0 auto;
  padding: 1rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
@media (min-width: 640px) {
  .public-header__container {
    padding: 1rem 2rem;
  }
}
.public-header__logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  transition: opacity 0.2s;
}
.public-header__logo:hover {
  opacity: 0.8;
}
.public-header__right {
  display: flex;
  align-items: center;
}
.public-header__btn {
  background: var(--color-accent);
  color: white;
  padding: 0.5rem 1.25rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px 0 rgba(124, 111, 247, 0.25);
}
.public-header__btn:hover {
  transform: translateY(-1px);
  background: var(--color-accent-hover);
  box-shadow: 0 6px 20px rgba(124, 111, 247, 0.23);
}
.public-layout__content {
  flex: 1;
  min-height: 0; /* Critical: allows flex child to shrink below content height → enables overflow scroll */
  max-width: 100%;
  padding: 2rem 1.5rem;
  padding-bottom: calc(2rem + env(safe-area-inset-bottom, 0px));
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}
@media (min-width: 768px) {
  .public-layout__content {
    padding: 3rem 2rem;
    padding-bottom: calc(3rem + env(safe-area-inset-bottom, 0px));
  }
}

/* Spacer for authenticated users on public pages (replaces hidden public-header) */
.public-safe-spacer {
  height: max(env(safe-area-inset-top, 0px), 1rem);
  flex-shrink: 0;
  background: transparent;
}

/* ── iOS PWA Standalone Mode ─────────────────────────────────────────────────── */

/* When running as installed PWA (Add to Home Screen), push fixed header below status bar */
@media (display-mode: standalone) {
  :root {
    --sat: env(safe-area-inset-top, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
    --sar: env(safe-area-inset-right, 0px);
  }

  /* ── Prevent pull-to-refresh (iOS PWA bouncy reload) ── */
  html, body {
    overscroll-behavior-y: none;
    overflow: hidden; /* body doesn't scroll — only <main> scrolls */
    height: 100%;
    height: 100dvh;
    background: var(--bg-primary); /* Prevent black flash at edges */
  }

  #finnote-app {
    height: 100%;
    height: 100dvh;
    overflow: hidden;
  }

  /* In PWA mode, standalone-scroll overrides the body overflow:hidden */
  .standalone-scroll {
    height: 100%;
    height: 100dvh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: none;
  }

  /* ── Hide scrollbar in PWA mode (native feel) ── */
  * {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }
  *::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  /* ── Safe Area: Header ── */
  .pwa-header-safe {
    /* Use max() to ensure at least 24px padding for older iPhones without notches */
    padding-top: max(env(safe-area-inset-top), 24px) !important;
    height: calc(3.5rem + max(env(safe-area-inset-top), 24px)) !important;
  }

  /* ── Safe Area: Main content ── */
  .pwa-main-safe {
    top: calc(3.5rem + max(env(safe-area-inset-top), 24px)) !important;
    /* Bottom padding so content doesn't hide behind home indicator */
    padding-bottom: max(env(safe-area-inset-bottom), 20px) !important;
    /* Smooth momentum scrolling */
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain; /* prevent pull-to-refresh on main scroll area */
  }

  /* ── Safe Area: Sidebar ── */
  .pwa-sidebar-safe {
    top: calc(3.5rem + max(env(safe-area-inset-top), 24px)) !important;
    padding-bottom: max(env(safe-area-inset-bottom), 16px) !important;
  }

  /* ── Safe Area: Bottom-positioned elements ── */
  .pwa-bottom-safe {
    padding-bottom: max(env(safe-area-inset-bottom), 16px) !important;
  }

  /* Fixed bottom buttons (scroll-to-top, FABs) */
  .pwa-fab-safe {
    bottom: calc(1.5rem + max(env(safe-area-inset-bottom), 16px)) !important;
  }

  /* Toast container needs bottom safe area */
  #toast-container {
    bottom: calc(1rem + max(env(safe-area-inset-bottom), 16px)) !important;
  }

  /* Modal/dialog bottom padding (buttons at bottom of modals) */
  .pwa-modal-safe {
    padding-bottom: max(env(safe-area-inset-bottom), 16px) !important;
  }

  /* ── Safe Area: Public Layout (Blog pages) ── */
  .public-layout {
    height: 100%;
    height: 100dvh;
    overflow: hidden;
  }

  .public-header {
    padding-top: max(env(safe-area-inset-top), 24px) !important;
    flex-shrink: 0;
  }

  .public-layout__content {
    flex: 1;
    min-height: 0; /* Allow flex child to shrink → enables scroll */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    padding-bottom: max(env(safe-area-inset-bottom), 20px) !important;
  }

  .public-safe-spacer {
    height: max(env(safe-area-inset-top), 24px) !important;
    flex-shrink: 0;
  }

  /* Blog CTA floating button — push above home indicator */
  .cta-float {
    bottom: calc(1.5rem + max(env(safe-area-inset-bottom), 16px)) !important;
  }
}

/* iOS Safari standalone fallback (older iOS versions) */
@supports (-webkit-touch-callout: none) {
  @media (display-mode: standalone) {
    body {
      /* Prevent rubber-band bouncing at edges */
      overscroll-behavior-y: none;
    }
  }
}


/* ── Prevent text-selection zoom on touch devices ───────────────────────────── */
.device--mobile,
.device--tablet {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* Allow select text in inputs/textareas */
.device--mobile input,
.device--mobile textarea,
.device--mobile [contenteditable],
.device--tablet input,
.device--tablet textarea,
.device--tablet [contenteditable] {
  -webkit-user-select: text;
  user-select: text;
}
</style>
