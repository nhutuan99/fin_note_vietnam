<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, Zap, BrainCircuit, LayoutDashboard } from 'lucide-vue-next'

const router = useRouter()
const { t } = useI18n()
const showTooltip = ref(false)
</script>

<template>
  <div class="cta-float" @mouseenter="showTooltip = true" @mouseleave="showTooltip = false">
    <Transition name="tooltip">
      <div v-if="showTooltip" class="cta-tooltip" @click.stop>
        <div class="cta-tooltip__glow"></div>
        <div class="cta-tooltip__glow2"></div>
        <div class="relative z-[1]">
          <div class="flex items-center gap-3 mb-3">
            <div class="cta-tooltip__logo">
              <img src="/images/logo-512.png" alt="FinNote" class="w-full h-full object-contain rounded-md" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-text-primary leading-tight">{{ t('appIntro.title') }}</h3>
              <p class="text-[0.6875rem] text-text-tertiary mt-0.5">PWA • {{ t('appIntro.note') }}</p>
            </div>
          </div>
          <div class="space-y-2 mb-4">
            <div class="cta-tooltip__feature">
              <div class="cta-tooltip__feature-icon"><Zap :size="11" /></div>
              <span>{{ t('appIntro.feature1') }}</span>
            </div>
            <div class="cta-tooltip__feature">
              <div class="cta-tooltip__feature-icon cta-tooltip__feature-icon--purple"><BrainCircuit :size="11" /></div>
              <span>{{ t('appIntro.feature2') }}</span>
            </div>
            <div class="cta-tooltip__feature">
              <div class="cta-tooltip__feature-icon cta-tooltip__feature-icon--green"><LayoutDashboard :size="11" /></div>
              <span>{{ t('appIntro.feature3') }}</span>
            </div>
          </div>
          <a href="/login" class="cta-tooltip__action group">
            <span>{{ t('appIntro.cta') }}</span>
            <ArrowRight :size="14" class="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </Transition>

    <button class="cta-float__btn group" @click="router.push('/login')">
      <div class="cta-float__pulse"></div>
      <div class="cta-float__spin-border"></div>
      <div class="cta-float__inner">
        <img src="/images/logo-512.png" alt="FinNote Logo" class="w-full h-full object-cover" />
      </div>
    </button>
  </div>
</template>

<style scoped>
/* ── Floating CTA ── */
.cta-float {
  position: fixed;
  bottom: 2rem;
  right: 1.5rem;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
@media (min-width: 768px) {
  .cta-float { right: 2.5rem; bottom: 2.5rem; }
}

.cta-float__btn {
  position: relative;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-surface);
  box-shadow: 0 8px 32px rgba(124, 111, 247, 0.25);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  border: none;
  outline: none;
  cursor: pointer;
}
.cta-float__btn:hover {
  transform: scale(1.08) translateY(-4px);
}

.cta-float__pulse {
  position: absolute;
  inset: -0.5rem;
  border-radius: 1.25rem;
  background: radial-gradient(circle, rgba(124, 111, 247, 0.4) 0%, transparent 70%);
  animation: pulse-glow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  z-index: -1;
}

.cta-float__spin-border {
  position: absolute;
  inset: -2px;
  border-radius: 1.125rem;
  background: conic-gradient(from 0deg, var(--color-accent), #3b82f6, var(--color-accent));
  animation: spin 4s linear infinite;
  z-index: 0;
  opacity: 0.5;
}

.cta-float__inner {
  position: relative;
  z-index: 1;
  width: calc(100% - 4px);
  height: calc(100% - 4px);
  border-radius: 0.875rem;
  background: var(--color-bg-surface);
  overflow: hidden;
  padding: 0.375rem;
}

/* ── Tooltip ── */
.cta-tooltip {
  position: absolute;
  bottom: calc(100% + 1rem);
  right: 0;
  width: 17rem;
  padding: 1.25rem;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: 1.25rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 24px 48px -12px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(124, 111, 247, 0.1);
  transform-origin: bottom right;
  overflow: hidden;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
@media (max-width: 767px) {
  .cta-tooltip { display: none; }
}

.cta-tooltip__glow {
  position: absolute;
  top: -4rem;
  left: -4rem;
  width: 10rem;
  height: 10rem;
  background: radial-gradient(circle, rgba(124, 111, 247, 0.15) 0%, transparent 70%);
  pointer-events: none;
}
.cta-tooltip__glow2 {
  position: absolute;
  bottom: -4rem;
  right: -4rem;
  width: 8rem;
  height: 8rem;
  background: radial-gradient(circle, rgba(52, 211, 153, 0.1) 0%, transparent 70%);
  pointer-events: none;
}

.cta-tooltip__logo {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0.25rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 0.625rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.cta-tooltip__feature {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}
.cta-tooltip__feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.375rem;
  background: rgba(124, 111, 247, 0.1);
  color: var(--color-accent);
}
.cta-tooltip__feature-icon--purple {
  background: rgba(168, 85, 247, 0.1);
  color: #a855f7;
}
.cta-tooltip__feature-icon--green {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.cta-tooltip__action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, var(--color-accent), #6366f1);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(124, 111, 247, 0.3);
  transition: all 0.2s ease;
}
.cta-tooltip__action:hover {
  box-shadow: 0 6px 16px rgba(124, 111, 247, 0.4);
  filter: brightness(1.1);
}

/* ── Tooltip Anim ── */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.1); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
