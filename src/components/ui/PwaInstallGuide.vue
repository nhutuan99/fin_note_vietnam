<script setup lang="ts">
/**
 * PwaInstallGuide
 *
 * Minimal bottom banner that appears on iOS Safari (non-standalone) to guide
 * users through the "Add to Home Screen" flow. Auto-hides when already running
 * as a PWA or after user dismisses it.
 *
 * Detection:
 * - `navigator.standalone` (iOS Safari proprietary) → already installed
 * - `display-mode: standalone` (standard) → already installed
 * - `userAgent.includes('iPhone' | 'iPad')` → only show on iOS
 */
import { ref, onMounted } from 'vue'
import { X, Share, PlusSquare } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const show = ref(false)
const DISMISS_KEY = 'finnote_pwa_guide_dismissed'

function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isWebKit = /AppleWebKit/.test(ua)
  const isChrome = /CriOS/.test(ua)
  const isFirefox = /FxiOS/.test(ua)
  // Must be Safari (WebKit but not Chrome/Firefox)
  return isIOS && isWebKit && !isChrome && !isFirefox
}

function isStandalone(): boolean {
  // iOS proprietary
  if ('standalone' in navigator && (navigator as any).standalone) return true
  // Standard media query
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return false
}

function dismiss() {
  show.value = false
  localStorage.setItem(DISMISS_KEY, 'true')
}

onMounted(() => {
  // Only show on iOS Safari, not already installed, and not previously dismissed
  if (
    isIOSSafari() &&
    !isStandalone() &&
    !localStorage.getItem(DISMISS_KEY)
  ) {
    // Delay appearance slightly so it doesn't compete with page load
    setTimeout(() => { show.value = true }, 2000)
  }
})
</script>

<template>
  <transition name="pwa-slide">
    <div
      v-if="show"
      class="fixed bottom-0 left-0 right-0 z-[999] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div class="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#1a1a2e] p-4 shadow-2xl">
        <!-- Close button -->
        <button
          @click="dismiss"
          class="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
        >
          <X :size="14" />
        </button>

        <!-- Content -->
        <div class="flex items-start gap-3.5">
          <!-- App Icon -->
          <img
            src="/images/logo-512.png"
            alt="FinNote"
            class="h-12 w-12 rounded-xl shadow-lg"
          />

          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-white leading-tight">
              {{ t('pwa.installTitle') }}
            </h3>
            <p class="mt-1 text-xs text-white/55 leading-relaxed">
              {{ t('pwa.installDesc') }}
            </p>

            <!-- Steps -->
            <div class="mt-3 space-y-2">
              <div class="flex items-center gap-2 text-xs text-white/75">
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#007AFF]/20">
                  <Share :size="11" class="text-[#007AFF]" />
                </div>
                <span v-html="t('pwa.step1')"></span>
              </div>
              <div class="flex items-center gap-2 text-xs text-white/75">
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#007AFF]/20">
                  <PlusSquare :size="11" class="text-[#007AFF]" />
                </div>
                <span v-html="t('pwa.step2')"></span>
              </div>
            </div>

            <!-- Native App Option removed as requested -->
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.pwa-slide-enter-active {
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease;
}
.pwa-slide-leave-active {
  transition: transform 250ms ease, opacity 200ms ease;
}
.pwa-slide-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.pwa-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
