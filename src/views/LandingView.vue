<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { setLocale } from '@/i18n'
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Smartphone,
  PenTool,
  LayoutDashboard,
  Zap,
  Volume2,
  VolumeX,
  Menu,
  X,
  ChevronRight
} from 'lucide-vue-next'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useWindowScroll } from '@vueuse/core'
import LandingDashboardShowcase from '@/components/landing/LandingDashboardShowcase.vue'
import LandingContactModal from '@/components/landing/LandingContactModal.vue'

const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const isStarting = ref(false)
const isMuted = ref(true)
const demoVideoRef = ref<HTMLVideoElement | null>(null)
const isMobileMenuOpen = ref(false)
const isScrolled = ref(false)
const showContactModal = ref(false)

function toggleMute() {
  if (demoVideoRef.value) {
    isMuted.value = !isMuted.value
    demoVideoRef.value.muted = isMuted.value
  }
}

async function startGuest() {
  if (isStarting.value) return
  isStarting.value = true
  try {
    await auth.startGuestMode(router)
  } finally {
    isStarting.value = false
  }
}

function goToLogin() {
  router.push('/login')
}

// Simple floating animation
const floatOffset = ref(0)
let animationFrameId: number

// Scroll reveal
const observer = ref<IntersectionObserver | null>(null)

// Typewriter effect
const typeWriterText = ref('')
const isTyping = ref(true)

onMounted(() => {
  let start = Date.now()
  const animate = () => {
    const elapsed = Date.now() - start
    floatOffset.value = Math.sin(elapsed / 1000) * 10
    animationFrameId = requestAnimationFrame(animate)
  }
  animate()

  // Typewriter logic
  const fullText = t('landing.hero.titlePart1') + '\n' + t('landing.hero.titlePart2')
  let i = 0
  const typeWriter = () => {
    if (i < fullText.length) {
      typeWriterText.value += fullText.charAt(i)
      i++
      setTimeout(typeWriter, 40)
    } else {
      isTyping.value = false
    }
  }
  setTimeout(typeWriter, 300)

  // Intersection Observer for scroll animations
  observer.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible')
          observer.value?.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  )

  document.querySelectorAll('.reveal-on-scroll').forEach((el) => {
    observer.value?.observe(el)
  })

  // Programmatic autoplay — required in PWA / restricted browsers
  // The HTML `autoplay` attribute is often ignored; calling .play() is the reliable path.
  if (demoVideoRef.value) {
    demoVideoRef.value.play().catch(() => {
      // Autoplay blocked — video stays paused, user can tap to play (mute button still works)
    })
  }
})

const { y } = useWindowScroll()

watch(y, (newY) => {
  isScrolled.value = newY > 20
})

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (observer.value) observer.value.disconnect()
})
</script>

<template>
  <div
    class="selection:bg-accent/30 min-h-screen overflow-x-hidden bg-[#0a0a0f] font-sans text-white"
  >
    <!-- Navbar -->
    <nav
      :class="[
        'fixed top-0 z-50 w-full transition-all duration-300',
        isScrolled ? 'glass-nav border-b border-white/10 py-3 shadow-2xl' : 'bg-transparent py-5'
      ]"
    >
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="z-50 flex items-center gap-3">
          <img
            src="/images/logo-512.png"
            alt="FinNote"
            class="h-10 w-10 rounded-xl object-cover shadow-[0_0_20px_rgba(124,111,247,0.4)] ring-2 ring-white/10"
          />
          <span
            class="bg-gradient-to-r from-white to-white/70 bg-clip-text text-xl font-extrabold tracking-tight text-transparent"
          >
            FinNote
          </span>
        </div>

        <!-- Desktop Menu -->
        <div class="hidden items-center gap-6 md:flex">
          <div
            class="flex items-center rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md"
          >
            <button
              @click="setLocale('vi')"
              :class="[
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-all',
                locale === 'vi'
                  ? 'bg-accent shadow-accent/30 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              ]"
              aria-label="Vietnamese"
            >
              VI
            </button>
            <button
              @click="setLocale('en')"
              :class="[
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-all',
                locale === 'en'
                  ? 'bg-accent shadow-accent/30 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              ]"
              aria-label="English"
            >
              EN
            </button>
          </div>
          <button
            @click="goToLogin"
            class="group relative text-sm font-medium text-gray-300 transition-colors hover:text-white"
          >
            {{ t('landing.nav.login') }}
            <span
              class="bg-accent absolute -bottom-1 left-0 h-0.5 w-0 transition-all duration-300 group-hover:w-full"
            ></span>
          </button>
          <button
            @click="startGuest"
            class="group flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:-translate-y-0.5 hover:bg-gray-100 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          >
            <span v-if="!isStarting">{{ t('landing.nav.tryNow') }}</span>
            <span v-else>{{ t('landing.nav.starting') }}</span>
            <ArrowRight
              :size="16"
              v-if="!isStarting"
              class="transition-transform group-hover:translate-x-1"
            />
          </button>
        </div>

        <!-- Mobile Menu Toggle -->
        <button
          @click="isMobileMenuOpen = !isMobileMenuOpen"
          class="z-50 p-2 text-gray-300 hover:text-white md:hidden"
          aria-label="Toggle menu"
        >
          <Menu
            v-if="!isMobileMenuOpen"
            :size="24"
          />
          <X
            v-else
            :size="24"
          />
        </button>
      </div>

      <!-- Mobile Menu Overlay -->
      <div
        :class="[
          'fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-[#0a0a0f]/95 backdrop-blur-xl transition-all duration-300 md:hidden',
          isMobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        ]"
      >
        <div class="flex items-center rounded-full border border-white/20 bg-white/10 p-1">
          <button
            @click="setLocale('vi'); isMobileMenuOpen = false"
            :class="[
              'rounded-full px-6 py-2 text-sm font-semibold',
              locale === 'vi' ? 'bg-accent text-white' : 'text-gray-400'
            ]"
          >
            VI
          </button>
          <button
            @click="setLocale('en'); isMobileMenuOpen = false"
            :class="[
              'rounded-full px-6 py-2 text-sm font-semibold',
              locale === 'en' ? 'bg-accent text-white' : 'text-gray-400'
            ]"
          >
            EN
          </button>
        </div>
        <button
          @click="goToLogin(); isMobileMenuOpen = false"
          class="text-2xl font-bold text-gray-300 hover:text-white"
        >
          {{ t('landing.nav.login') }}
        </button>
        <button
          @click="startGuest(); isMobileMenuOpen = false"
          class="bg-accent w-[80%] max-w-[300px] rounded-full px-8 py-4 text-xl font-bold text-white shadow-[0_0_30px_rgba(124,111,247,0.4)]"
        >
          {{ isStarting ? t('landing.nav.starting') : t('landing.nav.tryNow') }}
        </button>
      </div>
    </nav>

    <!-- Hero Section -->
    <main
      class="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-4 pt-40 pb-20 sm:px-6 lg:px-8"
    >
      <!-- Background Effects -->
      <div
        class="bg-accent/20 animate-pulse-slow pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[80vw] max-h-[800px] w-[80vw] max-w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px]"
      ></div>
      <div
        class="pointer-events-none absolute top-20 right-20 -z-10 h-64 w-64 rounded-full bg-blue-500/10 blur-[100px]"
      ></div>
      <div
        class="pointer-events-none absolute bottom-20 left-20 -z-10 h-64 w-64 rounded-full bg-purple-500/10 blur-[100px]"
      ></div>

      <div class="relative z-10 mx-auto w-full max-w-5xl space-y-8 text-center">
        <div
          class="bg-accent/10 border-accent/30 text-accent hover:bg-accent/20 reveal-on-scroll mb-4 inline-flex cursor-default items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold backdrop-blur-md transition-colors"
        >
          <Sparkles
            :size="16"
            class="animate-pulse"
          />
          <span>{{ t('landing.hero.badge') }}</span>
        </div>

        <h1
          class="min-h-[140px] bg-gradient-to-br from-white via-gray-100 to-gray-500 bg-clip-text px-2 pb-3 text-5xl leading-[1.15] font-extrabold tracking-tight whitespace-pre-line text-transparent drop-shadow-2xl sm:min-h-[160px] sm:text-6xl md:min-h-[200px] md:text-7xl lg:text-8xl"
        >
          {{ typeWriterText }}
          <span
            v-if="isTyping"
            class="animate-pulse text-white"
          >
            |
          </span>
        </h1>

        <p
          class="reveal-on-scroll mx-auto max-w-3xl text-lg leading-relaxed font-medium text-gray-400 sm:text-xl md:text-2xl"
          style="transition-delay: 0.2s"
        >
          {{ t('landing.hero.description') }}
        </p>

        <div
          class="reveal-on-scroll flex w-full flex-col items-center justify-center gap-5 px-4 pt-8 sm:w-auto sm:flex-row"
          style="transition-delay: 0.3s"
        >
          <button
            @click="startGuest"
            class="from-accent group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r to-[#9381ff] px-8 py-4 text-lg font-bold text-white shadow-[0_0_40px_rgba(124,111,247,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_60px_rgba(124,111,247,0.6)] active:scale-95 sm:w-auto"
          >
            <div
              class="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 ease-in-out group-hover:translate-y-0"
            ></div>
            <span
              class="relative z-10"
              v-if="!isStarting"
            >
              {{ t('landing.hero.ctaPrimary') }}
            </span>
            <span
              class="relative z-10"
              v-else
            >
              {{ t('landing.hero.starting') }}
            </span>
            <ArrowRight
              :size="20"
              v-if="!isStarting"
              class="relative z-10 transition-transform group-hover:translate-x-1"
            />
          </button>
          <a
            href="#features"
            class="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-center font-bold text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-white/10 active:scale-95 sm:w-auto"
          >
            {{ t('landing.hero.ctaSecondary') }}
            <ChevronRight :size="18" />
          </a>
        </div>

        <p
          class="reveal-on-scroll mt-8 flex items-center justify-center gap-2 text-sm text-gray-500"
          style="transition-delay: 0.4s"
        >
          <ShieldCheck
            :size="16"
            class="text-success"
          />
          {{ t('landing.hero.privacyNote') }}
        </p>
      </div>

      <!-- App Demo Video -->
      <div
        class="perspective-1000 reveal-on-scroll relative mx-auto mt-24 w-full max-w-6xl"
        style="transition-delay: 0.5s"
      >
        <div
          class="from-accent/30 to-accent/30 animate-pulse-slow absolute -inset-4 -z-10 rounded-[3rem] bg-gradient-to-r via-purple-500/20 opacity-60 blur-[100px] sm:-inset-8"
        ></div>

        <div
          class="group relative mx-auto overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c10]/80 shadow-[0_20px_80px_rgba(0,0,0,0.8)] ring-1 ring-white/5 backdrop-blur-2xl sm:rounded-3xl"
        >
          <!-- Window Controls -->
          <div
            class="absolute top-0 z-10 flex h-10 w-full items-center gap-2 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent px-4 backdrop-blur-md sm:h-12 sm:px-5"
          >
            <div class="flex gap-2">
              <div
                class="bg-error/90 hover:bg-error h-3 w-3 cursor-pointer rounded-full transition-colors sm:h-3.5 sm:w-3.5"
              ></div>
              <div
                class="bg-warning/90 hover:bg-warning h-3 w-3 cursor-pointer rounded-full transition-colors sm:h-3.5 sm:w-3.5"
              ></div>
              <div
                class="bg-success/90 hover:bg-success h-3 w-3 cursor-pointer rounded-full transition-colors sm:h-3.5 sm:w-3.5"
              ></div>
            </div>
            <div
              class="mx-auto flex max-w-[200px] items-center gap-2 truncate rounded-md border border-white/5 bg-black/40 px-3 py-1 text-[10px] font-medium text-gray-400 sm:max-w-xs sm:rounded-full sm:px-4 sm:py-1.5 sm:text-xs"
            >
              <ShieldCheck
                :size="12"
                class="text-accent/80 flex-shrink-0"
              />
              <span class="truncate">finnote-f4n.pages.dev</span>
            </div>
            <div class="w-12 sm:w-[54px]"></div>
          </div>

          <div
            class="relative mt-10 aspect-[16/9] w-full cursor-pointer overflow-hidden bg-[#0b0c10] sm:mt-12 sm:aspect-video"
            @click="toggleMute"
          >
            <video
              ref="demoVideoRef"
              src="/images/demo-veo3.mp4"
              autoplay
              loop
              muted
              playsinline
              webkit-playsinline
              preload="auto"
              class="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.01]"
            ></video>

            <div
              class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
            ></div>

            <div
              class="absolute bottom-4 left-4 flex flex-col gap-1 sm:bottom-6 sm:left-6 sm:gap-2"
            >
              <span class="text-lg font-bold text-white drop-shadow-md sm:text-2xl">
                {{ t('landing.demo.actionTitle') }}
              </span>
              <span class="text-xs text-gray-300 drop-shadow-md sm:text-sm">
                {{ t('landing.demo.actionDesc') }}
              </span>
            </div>

            <button
              @click.stop="toggleMute"
              class="absolute right-4 bottom-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-xl backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:bg-white/20 sm:right-6 sm:bottom-6 sm:h-12 sm:w-12"
              :aria-label="isMuted ? 'Unmute video' : 'Mute video'"
            >
              <VolumeX
                v-if="isMuted"
                :size="20"
                class="sm:h-6 sm:w-6"
              />
              <Volume2
                v-else
                :size="20"
                class="sm:h-6 sm:w-6"
              />
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Dashboard Showcase -->
    <LandingDashboardShowcase />

    <!-- Bento Grid Features -->
    <section
      id="features"
      class="relative px-4 py-32 sm:px-6"
    >
      <div class="mx-auto max-w-7xl">
        <div class="reveal-on-scroll mb-20 text-center">
          <h2
            class="mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text pb-2 text-4xl font-extrabold text-transparent md:text-5xl lg:text-6xl"
          >
            {{ t('landing.features.title') }}
          </h2>
          <p class="mx-auto max-w-2xl text-xl text-gray-400">
            {{ t('landing.features.subtitle') }}
          </p>
        </div>

        <div class="grid auto-rows-[350px] grid-cols-1 gap-6 md:grid-cols-3">
          <!-- Card 1 -->
          <div
            class="hover:border-accent/50 group reveal-on-scroll relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-xl backdrop-blur-lg transition-all duration-500 sm:p-10 md:col-span-2"
          >
            <div
              class="bg-accent/5 absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            ></div>
            <div class="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div
                  class="bg-accent/20 text-accent mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_0_20px_rgba(124,111,247,0.2)] transition-transform duration-500 group-hover:scale-110"
                >
                  <Smartphone
                    :size="32"
                    stroke-width="1.5"
                  />
                </div>
                <h3 class="mb-4 text-3xl font-bold text-white">
                  {{ t('landing.features.sms.title') }}
                </h3>
                <p class="max-w-md text-lg leading-relaxed text-gray-400">
                  {{ t('landing.features.sms.desc') }}
                </p>
              </div>
            </div>
            <div
              class="text-accent pointer-events-none absolute -right-20 -bottom-20 z-0 rotate-12 opacity-[0.05] transition-all duration-700 group-hover:scale-110 group-hover:opacity-10"
            >
              <Zap :size="300" />
            </div>
          </div>

          <!-- Card 2 -->
          <div
            class="hover:border-success/50 group reveal-on-scroll relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-xl backdrop-blur-lg transition-all duration-500 sm:p-10"
            style="transition-delay: 0.1s"
          >
            <div class="relative z-10 flex h-full flex-col">
              <div
                class="bg-success/20 text-success mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-110"
              >
                <ShieldCheck
                  :size="28"
                  stroke-width="1.5"
                />
              </div>
              <h3 class="mb-4 text-2xl font-bold text-white">
                {{ t('landing.features.privacy.title') }}
              </h3>
              <p class="leading-relaxed text-gray-400">
                {{ t('landing.features.privacy.desc') }}
              </p>
            </div>
          </div>

          <!-- Card 3 -->
          <div
            class="hover:border-warning/50 group reveal-on-scroll relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-xl backdrop-blur-lg transition-all duration-500 sm:p-10"
            style="transition-delay: 0.2s"
          >
            <div class="relative z-10 flex h-full flex-col">
              <div
                class="bg-warning/20 text-warning mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-110"
              >
                <LayoutDashboard
                  :size="28"
                  stroke-width="1.5"
                />
              </div>
              <h3 class="mb-4 text-2xl font-bold text-white">
                {{ t('landing.features.allInOne.title') }}
              </h3>
              <p class="leading-relaxed text-gray-400">
                {{ t('landing.features.allInOne.desc') }}
              </p>
            </div>
          </div>

          <!-- Card 4 -->
          <div
            class="hover:border-info/50 group reveal-on-scroll relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-xl backdrop-blur-lg transition-all duration-500 sm:p-10 md:col-span-2"
            style="transition-delay: 0.3s"
          >
            <div class="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div
                  class="bg-info/20 text-info mb-6 flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-transform duration-500 group-hover:scale-110"
                >
                  <PenTool
                    :size="32"
                    stroke-width="1.5"
                  />
                </div>
                <h3 class="mb-4 text-3xl font-bold text-white">
                  {{ t('landing.features.knowledge.title') }}
                </h3>
                <p class="max-w-md text-lg leading-relaxed text-gray-400">
                  {{ t('landing.features.knowledge.desc') }}
                </p>
              </div>
            </div>
            <div
              class="text-info pointer-events-none absolute -right-10 -bottom-10 z-0 -rotate-12 opacity-[0.05] transition-all duration-700 group-hover:scale-110 group-hover:opacity-10"
            >
              <PenTool :size="250" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom CTA -->
    <section class="reveal-on-scroll relative mb-20 px-4 py-24 sm:px-6">
      <div
        class="bg-accent/5 pointer-events-none absolute inset-0 z-0 mx-auto max-w-3xl rounded-full blur-3xl"
      ></div>
      <div
        class="relative mx-auto max-w-5xl overflow-hidden rounded-[3rem] border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-10 text-center shadow-2xl backdrop-blur-xl sm:p-16 md:p-24"
      >
        <div
          class="via-accent absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-transparent to-transparent opacity-50"
        ></div>
        <h2 class="relative z-10 mb-8 text-4xl font-extrabold text-white md:text-5xl lg:text-6xl">
          {{ t('landing.cta.title') }}
        </h2>
        <p class="relative z-10 mx-auto mb-12 max-w-2xl text-xl font-medium text-gray-300">
          {{ t('landing.cta.desc') }}
        </p>
        <button
          @click="startGuest"
          class="group relative z-10 mx-auto flex w-full items-center justify-center gap-3 rounded-full bg-white px-12 py-5 text-xl font-bold text-black shadow-[0_0_50px_rgba(255,255,255,0.3)] transition-all hover:scale-105 hover:bg-gray-100 hover:shadow-[0_0_80px_rgba(255,255,255,0.5)] active:scale-95 sm:w-auto"
        >
          <span v-if="!isStarting">{{ t('landing.cta.button') }}</span>
          <span v-else>{{ t('landing.cta.starting') }}</span>
          <ArrowRight
            :size="24"
            v-if="!isStarting"
            class="transition-transform group-hover:translate-x-2"
          />
        </button>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-white/10 bg-[#050508] py-10 text-center text-sm text-gray-500">
      <div
        class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row"
      >
        <div class="flex items-center gap-2">
          <img
            src="/images/logo-512.png"
            alt="Logo"
            class="h-6 w-6 rounded-md opacity-50 grayscale"
          />
          <span class="font-bold opacity-80">{{ t('landing.footer.copyright') }}</span>
        </div>
        <div class="flex gap-6">
          <button
            @click="showContactModal = true"
            class="cursor-pointer transition-colors hover:text-white"
          >
            {{ t('landing.footer.contact') }}
          </button>
        </div>
      </div>
    </footer>

    <!-- Contact Modal -->
    <LandingContactModal
      :show="showContactModal"
      @close="showContactModal = false"
    />
  </div>
</template>

<style scoped>
.glass-nav {
  background: rgba(10, 10, 15, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.perspective-1000 {
  perspective: 1000px;
}

.reveal-on-scroll {
  opacity: 0;
  transform: translateY(40px);
  transition:
    opacity 1s cubic-bezier(0.16, 1, 0.3, 1),
    transform 1s cubic-bezier(0.16, 1, 0.3, 1);
}

.reveal-visible {
  opacity: 1;
  transform: translateY(0);
}

.animate-pulse-slow {
  animation: pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}
</style>
