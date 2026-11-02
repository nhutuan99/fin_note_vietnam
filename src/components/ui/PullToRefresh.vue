<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import LogoLoader from '@/components/ui/LogoLoader.vue'

const emit = defineEmits<{
  (e: 'refresh', done: () => void): void
}>()

const props = defineProps<{
  disabled?: boolean
}>()

const containerRef = ref<HTMLElement | null>(null)

const startY = ref(0)
const refreshing = ref(false)
const pulling = ref(false)
const distance = ref(0)

const MAX_PULL = 120
const THRESHOLD = 60

/*
 * Performance notes:
 * - The non-passive touchmove listener (needed to preventDefault the native scroll while pulling)
 *   is only attached while a pull can actually start (touch began at the top). A permanent
 *   non-passive listener makes the browser wait for JS before every scroll — visible jank.
 * - The content wrapper only gets a transform while it is displaced: a permanent transform turns
 *   the whole page into one big layer and breaks position:fixed descendants.
 * - The spinner (with infinite animations) is only rendered while pulling/refreshing.
 */

function onTouchStart(e: TouchEvent) {
  if (props.disabled || refreshing.value) return
  const scrollable = getScrollParent(e.target as HTMLElement)
  if (scrollable && scrollable.scrollTop > 0) return

  startY.value = e.touches[0].clientY
  pulling.value = true
  containerRef.value?.addEventListener('touchmove', onTouchMove, { passive: false })
}

function onTouchMove(e: TouchEvent) {
  if (!pulling.value || refreshing.value) return
  const delta = e.touches[0].clientY - startY.value

  if (delta > 0) {
    if (e.cancelable) e.preventDefault()
    // Friction for a native feel
    distance.value = Math.min(delta * 0.5, MAX_PULL)
  } else {
    // Scrolling up/normally: hand the gesture back to the browser
    distance.value = 0
    stopTracking()
  }
}

function stopTracking() {
  pulling.value = false
  containerRef.value?.removeEventListener('touchmove', onTouchMove)
}

function onTouchEnd() {
  if (!pulling.value || refreshing.value) {
    stopTracking()
    return
  }
  stopTracking()

  if (distance.value >= THRESHOLD) {
    refreshing.value = true
    distance.value = THRESHOLD // snap back to loading position
    emit('refresh', () => {
      refreshing.value = false
      distance.value = 0
    })
  } else {
    distance.value = 0
  }
}

// Find the closest scrollable parent to check scrollTop
function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null
  if (node === document.body || node === document.documentElement) return document.body

  const overflowY = window.getComputedStyle(node).overflowY
  const isScrollable = overflowY !== 'visible' && overflowY !== 'hidden'

  if (isScrollable && node.scrollHeight > node.clientHeight) {
    return node
  }

  return getScrollParent(node.parentElement)
}

const showSpinner = computed(() => distance.value > 0 || refreshing.value)

onMounted(() => {
  containerRef.value?.addEventListener('touchstart', onTouchStart, { passive: true })
  containerRef.value?.addEventListener('touchend', onTouchEnd, { passive: true })
  containerRef.value?.addEventListener('touchcancel', onTouchEnd, { passive: true })
})

onBeforeUnmount(() => {
  containerRef.value?.removeEventListener('touchstart', onTouchStart)
  containerRef.value?.removeEventListener('touchmove', onTouchMove)
  containerRef.value?.removeEventListener('touchend', onTouchEnd)
  containerRef.value?.removeEventListener('touchcancel', onTouchEnd)
})
</script>

<template>
  <div ref="containerRef" class="relative w-full h-full">
    <!-- Spinner Area -->
    <div
      v-if="showSpinner"
      class="absolute top-0 left-0 right-0 flex items-center justify-center overflow-hidden z-0"
      :style="{ height: `${MAX_PULL}px`, transform: `translateY(${distance - MAX_PULL}px)` }"
    >
      <div
        class="w-8 h-8 rounded-full bg-bg-elevated shadow-lg flex items-center justify-center text-text-secondary transition-transform duration-200"
        :class="{ 'rotate-180': distance >= THRESHOLD && !refreshing, 'text-accent': distance >= THRESHOLD }"
      >
        <LogoLoader
          :size="20"
          class="transition-opacity duration-300"
          :class="{ 'opacity-50 grayscale': !refreshing }"
          :style="{ transform: refreshing ? 'none' : `rotate(${distance * 2}deg)` }"
        />
      </div>
    </div>

    <!-- Content Area -->
    <div
      class="w-full h-full relative z-10 bg-bg-primary"
      :class="{ 'transition-transform duration-300 ease-out': !pulling }"
      :style="distance > 0 ? { transform: `translateY(${distance}px)` } : undefined"
    >
      <slot />
    </div>
  </div>
</template>
