<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Sparkles, ChevronRight, X } from 'lucide-vue-next'
import LogoLoader from '@/components/ui/LogoLoader.vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { httpClient } from '@/shared/api/httpClient'

const ui = useUiStore()
const auth = useAuthStore()
const { t } = useI18n()
const router = useRouter()

const showModalContent = ref(false)

const generatedEvent = ref<{title: string, desc: string, imagePrompt: string} | null>(null)
const generatedImageBlob = ref<string>('')
const isGeneratingText = ref(false)
const isGeneratingImage = ref(false)

watch(() => ui.showWeeklyEvent, async (newVal) => {
  if (newVal) {
    showModalContent.value = false
    isGeneratingText.value = true
    isGeneratingImage.value = true
    generatedEvent.value = null
    generatedImageBlob.value = ''

    setTimeout(() => { showModalContent.value = true }, 80)

    ;(async () => {
      try {
        const textRes = await httpClient.post<{data: string}>('/api/ai', { action: 'weekly_event' })
        const eventData = JSON.parse(textRes.data || '{}')
        generatedEvent.value = eventData
        isGeneratingText.value = false

        if (eventData.imagePrompt) {
          const apiBase = import.meta.env.VITE_API_URL || ''
          const imgRes = await fetch(`${apiBase}/api/ai/image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({ prompt: eventData.imagePrompt })
          })
          if (!imgRes.ok) throw new Error('Image generation failed')
          const blob = await imgRes.blob()
          generatedImageBlob.value = URL.createObjectURL(blob)
          isGeneratingImage.value = false
        } else {
          generatedImageBlob.value = '/images/events/event1.png'
          isGeneratingImage.value = false
        }
      } catch (err) {
        console.error('AI Event Error:', err)
        isGeneratingText.value = false
        isGeneratingImage.value = false
        generatedEvent.value = {
          title: t('weeklyEvent.topics.t1_title'),
          desc: t('weeklyEvent.topics.t1_desc'),
          imagePrompt: ''
        }
        generatedImageBlob.value = '/images/events/event1.png'
      }
    })()
  } else {
    showModalContent.value = false
  }
})

function interact() {
  ui.showToast('success', t('weeklyEvent.success'))
  ui.completeWeeklyEvent()
  ui.enableStocks = true
  router.push('/stocks')
}

function skip() {
  ui.completeWeeklyEvent()
}
</script>

<template>
  <transition name="modal-fade">
    <div v-if="ui.showWeeklyEvent" class="event-fullscreen">

      <!-- ── Backdrop (click to dismiss) ── -->
      <div class="event-fullscreen__backdrop" @click="skip" />

      <!-- ── Card ── -->
      <transition name="card-up">
        <div v-if="showModalContent" class="event-card">

          <!-- ── HERO IMAGE (top 40%) ── -->
          <div class="event-card__hero">
            <!-- Gradient overlay bottom -->
            <div class="event-card__hero-overlay" />

            <!-- Image / Skeleton -->
            <img
              v-if="!isGeneratingImage && generatedImageBlob"
              :src="generatedImageBlob"
              class="event-card__hero-img"
              alt="event"
            />
            <div v-else class="event-card__hero-skeleton">
              <LogoLoader :size="32" :showGlow="true" class="opacity-70" />
            </div>

            <!-- Top bar: badge left + close right -->
            <div class="event-card__topbar">
              <div class="event-badge">
                <Sparkles :size="13" />
                <span>{{ t('weeklyEvent.title') }}</span>
              </div>
              <button class="event-close" @click="skip">
                <X :size="18" />
              </button>
            </div>
          </div>

          <!-- ── CONTENT PANEL (bottom 60%) ── -->
          <div class="event-card__body">

            <!-- Skeleton while loading text -->
            <template v-if="isGeneratingText">
              <div class="skeleton-line skeleton-line--title" />
              <div class="skeleton-line skeleton-line--md mt-3" />
              <div class="skeleton-line skeleton-line--sm mt-2" />
            </template>

            <!-- Actual content -->
            <template v-else-if="generatedEvent">
              <h2 class="event-card__title">{{ generatedEvent.title }}</h2>
              <p class="event-card__desc">{{ generatedEvent.desc }}</p>
            </template>

            <!-- CTA buttons -->
            <div class="event-card__actions">
              <button
                :disabled="isGeneratingText"
                @click="interact"
                class="btn-primary w-full justify-center !rounded-xl !py-3.5 text-[0.9375rem]"
              >
                <span>{{ t('weeklyEvent.join') }}</span>
                <ChevronRight :size="18" />
              </button>
              <button @click="skip" class="btn-secondary w-full justify-center !rounded-xl !py-3">
                {{ t('weeklyEvent.skip') }}
              </button>
            </div>

          </div>
        </div>
      </transition>

    </div>
  </transition>
</template>

<style scoped>
/* ══════════════════════════════════════════════
   Fullscreen overlay — safe-area aware
   ══════════════════════════════════════════════ */
.event-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;     /* card slides up from bottom */
  justify-content: center;
}

.event-fullscreen__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* ══════════════════════════════════════════════
   Card — bottom sheet style on mobile,
   centered card on tablet+
   ══════════════════════════════════════════════ */
.event-card {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 480px;
  max-height: 92dvh;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background: #0f0f1a;
  border-radius: 1.5rem 1.5rem 0 0;
  overflow: hidden;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.6);
  /* bottom safe area */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

@media (min-width: 600px) {
  .event-fullscreen {
    align-items: center;
  }
  .event-card {
    border-radius: 1.5rem;
    margin: 1rem;
    max-height: 88dvh;
  }
}

/* ══════════════════════════════════════════════
   Hero — 42% of card height, fixed
   ══════════════════════════════════════════════ */
.event-card__hero {
  position: relative;
  flex-shrink: 0;
  height: 220px;
  background: linear-gradient(135deg, #1e1040 0%, #2d1b69 50%, #1a0a3d 100%);
  overflow: hidden;
}

@media (min-height: 700px) {
  .event-card__hero { height: 260px; }
}

.event-card__hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.event-card__hero-skeleton {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e1040 0%, #2d1b69 60%, #4c1d95 100%);
  animation: shimmer 2s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Gradient overlay at bottom of hero */
.event-card__hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0.1) 0%,
    transparent 40%,
    rgba(15,15,26,0.8) 100%
  );
  z-index: 1;
}

/* ── Top bar (badge + close) ── */
.event-card__topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  padding-top: calc(0.875rem + env(safe-area-inset-top, 0px));
}

.event-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: rgba(124, 111, 247, 0.85);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid rgba(255,255,255,0.15);
}

.event-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(8px);
  color: rgba(255,255,255,0.8);
  border: 1px solid rgba(255,255,255,0.1);
  transition: background 0.15s ease, transform 0.15s ease;
  flex-shrink: 0;
}
.event-close:hover, .event-close:active {
  background: rgba(0,0,0,0.6);
  transform: scale(0.95);
}

/* ══════════════════════════════════════════════
   Content panel
   ══════════════════════════════════════════════ */
.event-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1.25rem 1rem;
  overflow: hidden;
  min-height: 0;
}

.event-card__title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.3;
  letter-spacing: -0.02em;
  margin-bottom: 0.625rem;
}

@media (min-height: 700px) {
  .event-card__title { font-size: 1.375rem; }
}

.event-card__desc {
  font-size: 0.875rem;
  color: rgba(255,255,255,0.65);
  line-height: 1.6;
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

/* ── Skeleton ── */
.skeleton-line {
  border-radius: 0.5rem;
  background: rgba(255,255,255,0.08);
  animation: pulse 1.6s ease-in-out infinite;
}
.skeleton-line--title { height: 1.5rem; width: 80%; }
.skeleton-line--md    { height: 0.875rem; width: 100%; }
.skeleton-line--sm    { height: 0.875rem; width: 70%; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ══════════════════════════════════════════════
   Action buttons
   ══════════════════════════════════════════════ */
.event-card__actions {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 1rem;
  flex-shrink: 0;
}


/* ══════════════════════════════════════════════
   Transitions
   ══════════════════════════════════════════════ */
.modal-fade-enter-active { transition: opacity 0.25s ease; }
.modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }

/* Card slides up from bottom */
.card-up-enter-active { transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease; }
.card-up-leave-active { transition: transform 0.2s ease-in, opacity 0.18s ease; }
.card-up-enter-from {
  transform: translateY(32px);
  opacity: 0;
}
.card-up-leave-to {
  transform: translateY(16px);
  opacity: 0;
}

@media (min-width: 600px) {
  .card-up-enter-from { transform: scale(0.94) translateY(8px); }
  .card-up-leave-to   { transform: scale(0.96) translateY(4px); }
}
</style>
