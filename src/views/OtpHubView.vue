<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import { httpClient } from '@/shared/api/httpClient'
import {
  Bell, BellRing, Copy, Check, Trash2, Settings, Users,
  Clock, ShieldCheck, KeyRound, Send, ChevronDown, ChevronUp
} from 'lucide-vue-next'
import LogoLoader from '@/components/ui/LogoLoader.vue'
import AppIntroCta from '@/components/ui/AppIntroCta.vue'

const ADMIN_EMAIL = 'tintphcm@gmail.com'
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

// ── State ──
const loading = ref(true)
const otpCodes = ref<OtpCode[]>([])
const isAdmin = computed(() => auth.isAuthenticated && auth.user?.email === ADMIN_EMAIL)

const pushSupported = ref(false)
const pushSubscribed = ref(false)
const pushLoading = ref(false)

const showAdminPanel = ref(false)
const showSettings = ref(false)
const adminForm = ref({ service: 'netflix', serviceName: '', code: '', expiryMinutes: 15 })
const submitting = ref(false)
const subscriberCount = ref(0)
const defaultExpiry = ref(15)

const now = ref(Date.now())
let countdownInterval: ReturnType<typeof setInterval> | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null

interface OtpCode {
  id: string; service: string; serviceName: string; code: string; expiresAt: string; createdAt: string
}

const SERVICES: Record<string, { name: string; color: string; icon: string }> = {
  netflix: { name: 'Netflix', color: '#E50914', icon: '🍿' },
  spotify: { name: 'Spotify', color: '#1DB954', icon: '🎵' },
  youtube: { name: 'YouTube', color: '#FF0000', icon: '📺' },
  discord: { name: 'Discord', color: '#5865F2', icon: '💬' },
  github: { name: 'GitHub', color: '#181717', icon: '💻' },
  google: { name: 'Google', color: '#4285F4', icon: '🔍' },
  facebook: { name: 'Facebook', color: '#1877F2', icon: '🔵' },
  apple: { name: 'Apple', color: '#000000', icon: '🍎' },
  steam: { name: 'Steam', color: '#171A21', icon: '🕹️' },
  custom: { name: 'Other', color: '#7c6ff7', icon: '🔑' }
}

const isServiceDropdownOpen = ref(false)
const serviceDropdownRef = ref<HTMLElement | null>(null)

function toggleServiceDropdown() {
  isServiceDropdownOpen.value = !isServiceDropdownOpen.value
}

function selectService(key: string) {
  adminForm.value.service = key
  isServiceDropdownOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (serviceDropdownRef.value && !serviceDropdownRef.value.contains(e.target as Node)) {
    isServiceDropdownOpen.value = false
  }
}

const serviceOptions = computed(() =>
  Object.entries(SERVICES).map(([key, val]) => ({
    key,
    ...val,
    displayName: key === 'custom' ? t('otpHub.other') : val.name
  }))
)
const copiedId = ref<string | null>(null)

watch(() => adminForm.value.service, (s) => {
  adminForm.value.serviceName = SERVICES[s]?.name || ''
})

// ── Helpers ──
function getTimeRemaining(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - now.value)
}
function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  return `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`
}
function getProgressPercent(code: OtpCode): number {
  const total = new Date(code.expiresAt).getTime() - new Date(code.createdAt).getTime()
  return total > 0 ? (Math.max(0, new Date(code.expiresAt).getTime() - now.value) / total) * 100 : 0
}
function isExpired(code: OtpCode): boolean { return getTimeRemaining(code.expiresAt) <= 0 }
function getServiceConfig(service: string) { return SERVICES[service] || SERVICES.custom }

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('otpHub.justNow')
  if (m < 60) return t('otpHub.minutesAgo', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('otpHub.hoursAgo', { n: h })
  return t('otpHub.daysAgo', { n: Math.floor(h / 24) })
}

// ── API ──
async function fetchOtpCodes() {
  try {
    const res = await httpClient.get<OtpCode[]>('/api/otp-hub')
    if (res) otpCodes.value = res
  } catch { /* silent */ } finally { loading.value = false }
}

async function createOtp() {
  if (!adminForm.value.code.trim()) { ui.showToast('error', t('otpHub.otpRequired')); return }
  submitting.value = true
  try {
    const res = await httpClient.post<OtpCode>('/api/otp-hub', {
      service: adminForm.value.service,
      serviceName: adminForm.value.serviceName || SERVICES[adminForm.value.service]?.name || adminForm.value.service,
      code: adminForm.value.code.trim(),
      expiryMinutes: adminForm.value.expiryMinutes
    })
    if (res) {
      otpCodes.value.unshift(res)
      adminForm.value.code = ''
      ui.showToast('success', t('otpHub.otpSent', { service: res.serviceName, count: subscriberCount.value }))
    }
  } catch (err: any) {
    ui.showToast('error', err.message || t('otpHub.otpCreateFailed'))
  } finally { submitting.value = false }
}

async function deleteOtp(id: string) {
  try {
    await httpClient.del(`/api/otp-hub/${id}`)
    otpCodes.value = otpCodes.value.filter(c => c.id !== id)
    ui.showToast('success', t('otpHub.otpDeleted'))
  } catch { ui.showToast('error', t('otpHub.otpDeleteFailed')) }
}

async function fetchSubscriberCount() {
  try { const res = await httpClient.get<{ count: number }>('/api/otp-hub/subscribers/count'); if (res) subscriberCount.value = res.count } catch {}
}

async function fetchSettings() {
  try {
    const res = await httpClient.get<{ defaultExpiryMinutes: number }>('/api/otp-hub/settings')
    if (res) { defaultExpiry.value = res.defaultExpiryMinutes; adminForm.value.expiryMinutes = res.defaultExpiryMinutes }
  } catch {}
}

async function saveSettings() {
  try {
    await httpClient.put('/api/otp-hub/settings', { defaultExpiryMinutes: defaultExpiry.value })
    adminForm.value.expiryMinutes = defaultExpiry.value
    ui.showToast('success', t('otpHub.settingsSaved'))
    showSettings.value = false
  } catch { ui.showToast('error', t('otpHub.settingsFailed')) }
}

// ── Push ──
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const out = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i)
  return out
}

async function checkPushState() {
  pushSupported.value = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!pushSupported.value) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) pushSubscribed.value = localStorage.getItem('otp_hub_subscribed') === 'true'
  } catch { pushSubscribed.value = false }
}

async function handleSubscribeClick() {
  if (!auth.isAuthenticated) {
    const confirmed = await ui.requestConfirm({
      title: t('otpHub.loginRequiredTitle'),
      message: t('otpHub.loginRequiredMessage'),
      confirmText: t('otpHub.goToLogin'),
      cancelText: t('common.cancel')
    })
    if (confirmed) {
      router.push({ path: '/login', query: { redirect: '/otp-hub' } })
    }
    return
  }
  await subscribePush()
}

async function subscribePush() {
  if (!pushSupported.value) return
  pushLoading.value = true
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { ui.showToast('error', t('otpHub.permissionDenied')); return }
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any })
    const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
    await fetch(`${API_BASE}/api/otp-hub/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) })
    pushSubscribed.value = true
    localStorage.setItem('otp_hub_subscribed', 'true')
    ui.showToast('success', t('otpHub.subscribeSuccess'))
  } catch (err: any) {
    ui.showToast('error', err.message || t('otpHub.subscribeFailed'))
  } finally { pushLoading.value = false }
}

async function unsubscribePush() {
  if (!pushSupported.value) return
  pushLoading.value = true
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
      await fetch(`${API_BASE}/api/otp-hub/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
    }
    pushSubscribed.value = false
    localStorage.removeItem('otp_hub_subscribed')
    ui.showToast('success', t('otpHub.unsubscribeSuccess'))
  } catch (err: any) {
    ui.showToast('error', err.message || t('otpHub.unsubscribeFailed'))
  } finally { pushLoading.value = false }
}

function copyCode(code: string, id: string) {
  navigator.clipboard.writeText(code).then(() => { copiedId.value = id; setTimeout(() => { copiedId.value = null }, 2000) })
}

// ── Lifecycle ──
onMounted(() => {
  fetchOtpCodes(); checkPushState()
  countdownInterval = setInterval(() => { now.value = Date.now() }, 1000)
  pollInterval = setInterval(() => { fetchOtpCodes() }, 10000)
  if (isAdmin.value) { showAdminPanel.value = true; fetchSubscriberCount(); fetchSettings() }
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
  if (pollInterval) clearInterval(pollInterval)
  document.removeEventListener('click', handleClickOutside)
})

watch(isAdmin, (val) => {
  if (val) { showAdminPanel.value = true; fetchSubscriberCount(); fetchSettings() }
})
</script>

<template>
  <div class="mx-auto max-w-[40rem] px-4 pb-24 pt-2">
    <!-- ── Hero Header ── -->
    <div class="mb-8">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff8fab] to-accent text-white shadow-[0_0_24px_rgba(124,111,247,0.25)]">
            <KeyRound :size="24" />
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">{{ t('otpHub.title') }}</h1>
            <p class="text-text-tertiary text-[0.8125rem]">{{ t('otpHub.subtitle') }}</p>
          </div>
        </div>

        <button
          v-if="!pushSubscribed"
          :disabled="pushLoading"
          @click="handleSubscribeClick"
          class="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[0.8125rem] font-semibold text-white transition-all duration-200 hover:bg-accent-hover hover:-translate-y-0.5 shadow-[0_4px_16px_rgba(124,111,247,0.3)] hover:shadow-[0_6px_24px_rgba(124,111,247,0.4)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Bell :size="15" />
          <span class="hidden sm:inline">{{ pushLoading ? t('otpHub.processing') : t('otpHub.subscribe') }}</span>
        </button>
        <button
          v-else-if="pushSupported && pushSubscribed"
          :disabled="pushLoading"
          @click="unsubscribePush"
          class="flex items-center gap-2 rounded-full bg-accent/10 border border-accent/30 px-4 py-2 text-[0.8125rem] font-semibold text-accent transition-all duration-200 hover:bg-accent hover:text-white whitespace-nowrap"
        >
          <BellRing :size="15" />
          <span class="hidden sm:inline">{{ t('otpHub.subscribed') }}</span>
        </button>
      </div>
    </div>

    <!-- ── Subscribed Banner ── -->
    <div v-if="pushSubscribed" class="mb-4 flex items-center gap-2.5 rounded-xl bg-success/8 border border-success/20 px-4 py-3 text-success text-[0.8125rem]">
      <BellRing :size="16" class="shrink-0" />
      <span>{{ t('otpHub.subscribedBanner') }}</span>
    </div>

    <!-- ── Admin Panel ── -->
    <div v-if="isAdmin" class="card-premium rounded-2xl mb-6 overflow-hidden">
      <button
        @click="showAdminPanel = !showAdminPanel"
        class="flex w-full items-center justify-between px-5 py-3.5 transition-colors hover:bg-bg-hover"
      >
        <div class="flex items-center gap-2.5">
          <ShieldCheck :size="16" class="text-accent" />
          <span class="text-[0.875rem] font-bold">{{ t('otpHub.adminPanel') }}</span>
          <span class="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-[0.6875rem] font-bold text-accent">
            {{ subscriberCount }} {{ t('otpHub.subscribers') }}
          </span>
        </div>
        <component :is="showAdminPanel ? ChevronUp : ChevronDown" :size="16" class="text-text-tertiary" />
      </button>

      <div v-if="showAdminPanel" class="border-t border-border-default px-5 pb-5 pt-4 space-y-4">
        <div class="flex gap-3">
          <div class="flex-1 space-y-1.5">
            <label class="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-tertiary">{{ t('otpHub.service') }}</label>
            <div class="relative" ref="serviceDropdownRef">
              <button
                type="button"
                @click="toggleServiceDropdown"
                class="flex w-full items-center justify-between gap-2.5 rounded-lg border border-border-default bg-bg-elevated px-3 py-2.5 text-left text-[0.875rem] text-text-primary outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
                :class="{ 'border-accent ring-2 ring-accent/20': isServiceDropdownOpen }"
              >
                <div class="flex items-center gap-2">
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded text-[0.6875rem] font-black text-white shrink-0"
                    :style="{ background: getServiceConfig(adminForm.service).color }"
                  >
                    {{ getServiceConfig(adminForm.service).icon }}
                  </div>
                  <span>{{ serviceOptions.find(s => s.key === adminForm.service)?.displayName }}</span>
                </div>
                <ChevronDown :size="14" class="text-text-tertiary transition-transform duration-200" :class="{ 'rotate-180': isServiceDropdownOpen }" />
              </button>

              <transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform scale-95 opacity-0 translate-y-[-10px]"
                enter-to-class="transform scale-100 opacity-100 translate-y-0"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform scale-100 opacity-100 translate-y-0"
                leave-to-class="transform scale-95 opacity-0 translate-y-[-10px]"
              >
                <div
                  v-if="isServiceDropdownOpen"
                  class="absolute left-0 right-0 z-[100] mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-border-default bg-bg-surface p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] custom-scrollbar"
                >
                  <div class="flex flex-col gap-0.5">
                    <button
                      v-for="s in serviceOptions"
                      :key="s.key"
                      type="button"
                      @click="selectService(s.key)"
                      class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[0.875rem] transition-colors"
                      :class="s.key === adminForm.service ? 'bg-accent/15 text-accent font-semibold' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'"
                    >
                      <div class="flex items-center gap-2 py-0.5">
                        <div
                          class="flex h-5 w-5 items-center justify-center rounded text-[0.6875rem] font-black text-white shrink-0"
                          :style="{ background: s.color }"
                        >
                          {{ s.icon }}
                        </div>
                        <span>{{ s.displayName }}</span>
                      </div>
                      <Check v-if="s.key === adminForm.service" :size="14" class="text-accent shrink-0" />
                    </button>
                  </div>
                </div>
              </transition>
            </div>
          </div>
          <div v-if="adminForm.service === 'custom'" class="flex-1 space-y-1.5">
            <label class="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-tertiary">{{ t('otpHub.serviceName') }}</label>
            <input
              v-model="adminForm.serviceName"
              type="text"
              :placeholder="t('otpHub.serviceNamePlaceholder')"
              class="w-full rounded-lg bg-bg-elevated border border-border-default px-3 py-2.5 text-[0.875rem] text-text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-text-disabled"
            />
          </div>
        </div>

        <div class="flex gap-3">
          <div class="flex-[2] space-y-1.5">
            <label class="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-tertiary">{{ t('otpHub.otpCode') }}</label>
            <input
              v-model="adminForm.code"
              type="text"
              :placeholder="t('otpHub.otpCodePlaceholder')"
              class="w-full rounded-lg bg-bg-elevated border border-border-default px-3 py-2.5 text-[1.125rem] font-bold tracking-[0.15em] font-mono text-text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 placeholder:text-text-disabled placeholder:text-[0.875rem] placeholder:font-normal placeholder:tracking-normal placeholder:font-sans"
              @keydown.enter="createOtp"
            />
          </div>
          <div class="w-20 space-y-1.5">
            <label class="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-tertiary">{{ t('otpHub.expiryMinutes') }}</label>
            <input
              v-model.number="adminForm.expiryMinutes"
              type="number" min="1" max="60"
              class="w-full rounded-lg bg-bg-elevated border border-border-default px-3 py-2.5 text-[0.875rem] text-text-primary text-center outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <button
            :disabled="submitting || !adminForm.code.trim()"
            @click="createOtp"
            class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[0.875rem] font-bold text-white transition-all duration-200 hover:bg-accent-hover shadow-[0_4px_16px_rgba(124,111,247,0.2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <Send :size="15" />
            <span>{{ submitting ? t('otpHub.sending') : t('otpHub.sendOtp') }}</span>
          </button>
          <button
            @click="showSettings = !showSettings"
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-bg-elevated border border-border-default text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <Settings :size="16" />
          </button>
        </div>

        <div v-if="showSettings" class="rounded-xl bg-bg-elevated border border-border-subtle p-4 space-y-3">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <span class="text-[0.8125rem] text-text-secondary">{{ t('otpHub.defaultExpiry') }}</span>
            <div class="flex items-center gap-2">
              <input
                v-model.number="defaultExpiry"
                type="number" min="1" max="60"
                class="w-16 rounded-md bg-bg-surface border border-border-default px-2 py-1.5 text-[0.8125rem] text-text-primary text-center outline-none focus:border-accent"
              />
              <span class="text-[0.8125rem] text-text-tertiary">{{ t('otpHub.minutes') }}</span>
              <button @click="saveSettings" class="btn-primary btn-sm">{{ t('otpHub.save') }}</button>
            </div>
          </div>
          <div class="flex items-center gap-1.5 text-[0.6875rem] text-text-disabled">
            <Users :size="12" />
            <span>{{ t('otpHub.subscribersCount', { count: subscriberCount }) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Loading ── -->
    <div v-if="loading" class="flex justify-center py-16">
      <LogoLoader :size="40" />
    </div>

    <!-- ── OTP Code List ── -->
    <div v-else-if="otpCodes.length > 0" class="space-y-3">
      <TransitionGroup name="otp-card">
        <div
          v-for="otp in otpCodes"
          :key="otp.id"
          class="card-premium rounded-2xl p-5 transition-all duration-200 hover:border-accent/30 hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] relative overflow-hidden group"
          :class="{ 'opacity-50': isExpired(otp) }"
        >
          <div v-if="!isExpired(otp)" class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#ff8fab] to-accent opacity-60" />

          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg text-[0.8125rem] font-black text-white shrink-0"
                :style="{ background: getServiceConfig(otp.service).color }"
              >
                {{ getServiceConfig(otp.service).icon }}
              </div>
              <span class="text-[0.9375rem] font-bold">{{ otp.serviceName }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[0.6875rem] text-text-disabled">{{ timeSince(otp.createdAt) }}</span>
              <button
                v-if="isAdmin"
                @click="deleteOtp(otp.id)"
                class="flex h-7 w-7 items-center justify-center rounded-md text-text-disabled opacity-0 group-hover:opacity-100 transition-all hover:bg-error/10 hover:text-error"
              >
                <Trash2 :size="13" />
              </button>
            </div>
          </div>

          <div class="flex items-center gap-3 mb-4">
            <div
              class="flex-1 font-mono text-[2rem] font-extrabold tracking-[0.2em] leading-none select-all transition-colors"
              :class="isExpired(otp) ? 'text-text-disabled line-through' : 'text-text-primary'"
            >
              {{ otp.code }}
            </div>
            <button
              :disabled="isExpired(otp)"
              @click="copyCode(otp.code, otp.id)"
              class="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[0.8125rem] font-semibold transition-all duration-150 shrink-0"
              :class="copiedId === otp.id
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-bg-elevated border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary hover:border-border-strong disabled:opacity-30 disabled:cursor-not-allowed'"
            >
              <component :is="copiedId === otp.id ? Check : Copy" :size="14" />
              <span>{{ copiedId === otp.id ? 'Copied!' : t('common.copy') }}</span>
            </button>
          </div>

          <div class="space-y-1.5">
            <div class="h-[3px] w-full rounded-full bg-bg-elevated overflow-hidden">
              <div
                class="h-full rounded-full transition-[width] duration-1000 linear"
                :style="{
                  width: getProgressPercent(otp) + '%',
                  background: isExpired(otp) ? 'var(--error)' : getProgressPercent(otp) < 30 ? 'var(--warning)' : 'var(--success)'
                }"
              />
            </div>
            <div class="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-text-tertiary tabular-nums">
              <Clock :size="11" />
              <span v-if="isExpired(otp)" class="text-error">{{ t('otpHub.expired') }}</span>
              <span v-else>{{ formatCountdown(getTimeRemaining(otp.expiresAt)) }}</span>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- ── Empty State ── -->
    <div v-else class="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="w-20 h-20 flex items-center justify-center rounded-3xl bg-accent/10 text-accent mb-6 shadow-[0_0_30px_rgba(124,111,247,0.15)] border border-accent/20">
        <KeyRound :size="40" />
      </div>
      <h3 class="text-xl font-bold mb-2">{{ t('otpHub.emptyTitle') }}</h3>
      <p class="text-text-tertiary text-[0.8125rem] mb-8 max-w-[280px] leading-relaxed">{{ t('otpHub.emptyDesc') }}</p>
      <button
        v-if="!pushSubscribed"
        :disabled="pushLoading"
        @click="handleSubscribeClick"
        class="flex items-center gap-2 px-6 py-3 rounded-full text-[0.875rem] font-bold text-white bg-accent hover:bg-accent-hover transition-all duration-200 shadow-[0_4px_16px_rgba(124,111,247,0.3)] hover:shadow-[0_6px_24px_rgba(124,111,247,0.4)] hover:-translate-y-0.5 disabled:opacity-50"
      >
        <Bell :size="18" />
        <span>{{ pushLoading ? t('otpHub.processing') : t('otpHub.emptySubscribe') }}</span>
      </button>
    </div>

    <!-- Not supported -->
    <div v-if="!pushSupported" class="mt-4 rounded-xl bg-warning/8 border border-warning/20 px-4 py-3 text-warning text-[0.8125rem] leading-relaxed">
      ⚠️ {{ t('otpHub.pushNotSupported') }}
    </div>

    <AppIntroCta />
  </div>
</template>

<style scoped>
.otp-card-enter-active { animation: fadeSlideIn 0.3s ease; }
.otp-card-leave-active { transition: all 0.2s ease; }
.otp-card-leave-to { opacity: 0; transform: translateX(-20px); }
.otp-card-move { transition: transform 0.3s ease; }

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.tabular-nums { font-variant-numeric: tabular-nums; }

/* Custom scrollbar for dropdown */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--color-border-strong);
  border-radius: 10px;
}

@media (max-width: 480px) {
  .font-mono.text-\[2rem\] { font-size: 1.5rem; letter-spacing: 0.15em; }
}
</style>
