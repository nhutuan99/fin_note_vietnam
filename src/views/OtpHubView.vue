<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { httpClient } from '@/shared/api/httpClient'
import {
  Bell, BellRing, Copy, Check, Trash2, Plus, Settings, Users,
  Clock, ShieldCheck, KeyRound, Send, ChevronDown, ChevronUp, X
} from 'lucide-vue-next'
import LogoLoader from '@/components/ui/LogoLoader.vue'
import AppIntroCta from '@/components/ui/AppIntroCta.vue'

const ADMIN_EMAIL = 'tintphcm@gmail.com'
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// ── Stores ──
const auth = useAuthStore()
const ui = useUiStore()

// ── State ──
const loading = ref(true)
const otpCodes = ref<OtpCode[]>([])
const isAdmin = computed(() => auth.isAuthenticated && auth.user?.email === ADMIN_EMAIL)

// Push subscription state
const pushSupported = ref(false)
const pushSubscribed = ref(false)
const pushLoading = ref(false)

// Admin form state
const showAdminPanel = ref(false)
const showSettings = ref(false)
const adminForm = ref({
  service: 'netflix',
  serviceName: '',
  code: '',
  expiryMinutes: 15
})
const submitting = ref(false)
const subscriberCount = ref(0)
const defaultExpiry = ref(15)

// Countdown timers
const now = ref(Date.now())
let countdownInterval: ReturnType<typeof setInterval> | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null

// ── Types ──
interface OtpCode {
  id: string
  service: string
  serviceName: string
  code: string
  expiresAt: string
  createdAt: string
}

// ── Service Config ──
const SERVICES: Record<string, { name: string; color: string; icon: string }> = {
  netflix: { name: 'Netflix', color: '#E50914', icon: 'N' },
  spotify: { name: 'Spotify', color: '#1DB954', icon: '♫' },
  youtube: { name: 'YouTube', color: '#FF0000', icon: '▶' },
  discord: { name: 'Discord', color: '#5865F2', icon: '🎮' },
  github: { name: 'GitHub', color: '#8B5CF6', icon: '⌨' },
  google: { name: 'Google', color: '#4285F4', icon: 'G' },
  facebook: { name: 'Facebook', color: '#1877F2', icon: 'f' },
  apple: { name: 'Apple', color: '#A2AAAD', icon: '' },
  steam: { name: 'Steam', color: '#171A21', icon: '🎮' },
  custom: { name: 'Khác', color: '#8e7dfa', icon: '🔑' }
}

// Computed
const serviceOptions = Object.entries(SERVICES).map(([key, val]) => ({
  key,
  ...val
}))

const copiedId = ref<string | null>(null)

// ── Service name auto-fill ──
watch(() => adminForm.value.service, (s) => {
  adminForm.value.serviceName = SERVICES[s]?.name || ''
})

// ── Computed helpers ──
function getTimeRemaining(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - now.value)
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function getProgressPercent(code: OtpCode): number {
  const total = new Date(code.expiresAt).getTime() - new Date(code.createdAt).getTime()
  const remaining = getTimeRemaining(code.expiresAt)
  return total > 0 ? (remaining / total) * 100 : 0
}

function isExpired(code: OtpCode): boolean {
  return getTimeRemaining(code.expiresAt) <= 0
}

function getServiceConfig(service: string) {
  return SERVICES[service] || SERVICES.custom
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  return `${d} ngày trước`
}

// ── API Calls ──
async function fetchOtpCodes() {
  try {
    const res = await httpClient.get<OtpCode[]>('/api/otp-hub')
    if (res) otpCodes.value = res
  } catch {
    // Silently fail
  } finally {
    loading.value = false
  }
}

async function createOtp() {
  if (!adminForm.value.code.trim()) {
    ui.showToast('error', 'Vui lòng nhập mã OTP')
    return
  }
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
      ui.showToast('success', `Đã gửi OTP ${res.serviceName} đến ${subscriberCount.value} subscribers`)
    }
  } catch (err: any) {
    ui.showToast('error', err.message || 'Không thể tạo OTP')
  } finally {
    submitting.value = false
  }
}

async function deleteOtp(id: string) {
  try {
    await httpClient.del(`/api/otp-hub/${id}`)
    otpCodes.value = otpCodes.value.filter(c => c.id !== id)
    ui.showToast('success', 'Đã xóa OTP')
  } catch {
    ui.showToast('error', 'Không thể xóa OTP')
  }
}

async function fetchSubscriberCount() {
  try {
    const res = await httpClient.get<{ count: number }>('/api/otp-hub/subscribers/count')
    if (res) subscriberCount.value = res.count
  } catch { /* ignore */ }
}

async function fetchSettings() {
  try {
    const res = await httpClient.get<{ defaultExpiryMinutes: number }>('/api/otp-hub/settings')
    if (res) {
      defaultExpiry.value = res.defaultExpiryMinutes
      adminForm.value.expiryMinutes = res.defaultExpiryMinutes
    }
  } catch { /* ignore */ }
}

async function saveSettings() {
  try {
    await httpClient.put('/api/otp-hub/settings', {
      defaultExpiryMinutes: defaultExpiry.value
    })
    adminForm.value.expiryMinutes = defaultExpiry.value
    ui.showToast('success', 'Đã lưu cài đặt')
    showSettings.value = false
  } catch {
    ui.showToast('error', 'Không thể lưu cài đặt')
  }
}

// ── Push Notifications (anonymous) ──
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function checkPushState() {
  pushSupported.value = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!pushSupported.value) return

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    // Check if subscription endpoint is registered for OTP Hub
    if (sub) {
      // We assume if the user has a push sub, they might be subscribed to OTP Hub
      // The actual check would need backend, but we use localStorage as a flag
      pushSubscribed.value = localStorage.getItem('otp_hub_subscribed') === 'true'
    }
  } catch {
    pushSubscribed.value = false
  }
}

async function subscribePush() {
  if (!pushSupported.value) return
  pushLoading.value = true

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      ui.showToast('error', 'Bạn đã từ chối quyền thông báo')
      return
    }

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any
    })

    const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
    await fetch(`${API_BASE}/api/otp-hub/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON())
    })

    pushSubscribed.value = true
    localStorage.setItem('otp_hub_subscribed', 'true')
    ui.showToast('success', 'Đã đăng ký nhận OTP! Bạn sẽ nhận được thông báo khi có OTP mới.')
  } catch (err: any) {
    console.error('[OTP-PUSH] Subscribe error:', err)
    ui.showToast('error', err.message || 'Không thể đăng ký thông báo')
  } finally {
    pushLoading.value = false
  }
}

async function unsubscribePush() {
  if (!pushSupported.value) return
  pushLoading.value = true

  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()

    if (sub) {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
      await fetch(`${API_BASE}/api/otp-hub/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      })
    }

    pushSubscribed.value = false
    localStorage.removeItem('otp_hub_subscribed')
    ui.showToast('success', 'Đã hủy đăng ký nhận OTP')
  } catch (err: any) {
    ui.showToast('error', err.message || 'Không thể hủy đăng ký')
  } finally {
    pushLoading.value = false
  }
}

function copyCode(code: string, id: string) {
  navigator.clipboard.writeText(code).then(() => {
    copiedId.value = id
    setTimeout(() => { copiedId.value = null }, 2000)
  })
}

// ── Lifecycle ──
onMounted(async () => {
  fetchOtpCodes()
  checkPushState()

  // Update countdown every second
  countdownInterval = setInterval(() => {
    now.value = Date.now()
  }, 1000)

  // Poll for new OTP codes every 10s
  pollInterval = setInterval(() => {
    fetchOtpCodes()
  }, 10000)

  // Admin-specific
  if (isAdmin.value) {
    showAdminPanel.value = true
    fetchSubscriberCount()
    fetchSettings()
  }
})

onUnmounted(() => {
  if (countdownInterval) clearInterval(countdownInterval)
  if (pollInterval) clearInterval(pollInterval)
})

// Watch admin auth changes
watch(isAdmin, (val) => {
  if (val) {
    showAdminPanel.value = true
    fetchSubscriberCount()
    fetchSettings()
  }
})
</script>

<template>
  <div class="otp-hub">
    <div class="otp-hub__container">
      <!-- Header -->
      <header class="otp-header">
        <div class="otp-header__left">
          <div class="otp-header__icon">
            <KeyRound :size="28" />
          </div>
          <div>
            <h1 class="otp-header__title">OTP Hub</h1>
            <p class="otp-header__subtitle">Mã xác thực tài khoản chia sẻ</p>
          </div>
        </div>
        <div class="otp-header__actions">
          <!-- Subscribe/Unsubscribe Button -->
          <button
            v-if="pushSupported && !pushSubscribed"
            class="otp-subscribe-btn"
            :disabled="pushLoading"
            @click="subscribePush"
          >
            <Bell :size="16" />
            <span>{{ pushLoading ? 'Đang xử lý...' : 'Nhận thông báo' }}</span>
          </button>
          <button
            v-else-if="pushSupported && pushSubscribed"
            class="otp-unsubscribe-btn"
            :disabled="pushLoading"
            @click="unsubscribePush"
          >
            <BellRing :size="16" />
            <span>Đã đăng ký</span>
          </button>
        </div>
      </header>

      <!-- Subscription info banner -->
      <div v-if="pushSubscribed" class="otp-subscribed-banner">
        <BellRing :size="16" />
        <span>Bạn đã đăng ký nhận thông báo OTP. Khi có mã mới, bạn sẽ nhận được push notification ngay!</span>
      </div>

      <!-- Admin Panel -->
      <div v-if="isAdmin" class="admin-panel">
        <div class="admin-panel__header" @click="showAdminPanel = !showAdminPanel">
          <div class="admin-panel__title">
            <ShieldCheck :size="18" />
            <span>Admin Panel</span>
            <span class="admin-badge">{{ subscriberCount }} subscribers</span>
          </div>
          <component :is="showAdminPanel ? ChevronUp : ChevronDown" :size="18" />
        </div>

        <div v-if="showAdminPanel" class="admin-panel__body">
          <!-- Create OTP Form -->
          <div class="otp-form">
            <div class="otp-form__row">
              <div class="otp-form__field">
                <label>Dịch vụ</label>
                <div class="service-select">
                  <select v-model="adminForm.service">
                    <option v-for="s in serviceOptions" :key="s.key" :value="s.key">
                      {{ s.icon }} {{ s.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="otp-form__field" v-if="adminForm.service === 'custom'">
                <label>Tên dịch vụ</label>
                <input
                  v-model="adminForm.serviceName"
                  type="text"
                  placeholder="Nhập tên dịch vụ..."
                />
              </div>
            </div>

            <div class="otp-form__row">
              <div class="otp-form__field otp-form__field--code">
                <label>Mã OTP</label>
                <input
                  v-model="adminForm.code"
                  type="text"
                  placeholder="Nhập mã OTP..."
                  class="otp-code-input"
                  @keydown.enter="createOtp"
                />
              </div>
              <div class="otp-form__field otp-form__field--expiry">
                <label>Hết hạn (phút)</label>
                <input
                  v-model.number="adminForm.expiryMinutes"
                  type="number"
                  min="1"
                  max="60"
                />
              </div>
            </div>

            <div class="otp-form__actions">
              <button class="otp-send-btn" :disabled="submitting || !adminForm.code.trim()" @click="createOtp">
                <Send :size="16" />
                <span>{{ submitting ? 'Đang gửi...' : 'Gửi OTP' }}</span>
              </button>
              <button class="otp-settings-btn" @click="showSettings = !showSettings">
                <Settings :size="16" />
              </button>
            </div>
          </div>

          <!-- Settings Panel -->
          <div v-if="showSettings" class="settings-panel">
            <div class="settings-panel__row">
              <label>Thời gian hết hạn mặc định (phút)</label>
              <div class="settings-panel__input-group">
                <input v-model.number="defaultExpiry" type="number" min="1" max="60" />
                <button class="settings-save-btn" @click="saveSettings">Lưu</button>
              </div>
            </div>
            <div class="settings-panel__info">
              <Users :size="14" />
              <span>{{ subscriberCount }} người đang đăng ký nhận thông báo</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="otp-loading">
        <LogoLoader :size="40" />
      </div>

      <!-- OTP List -->
      <div v-else-if="otpCodes.length > 0" class="otp-list">
        <TransitionGroup name="otp-card">
          <div
            v-for="otp in otpCodes"
            :key="otp.id"
            class="otp-card"
            :class="{ 'otp-card--expired': isExpired(otp), 'otp-card--pulse': !isExpired(otp) && getTimeRemaining(otp.expiresAt) > 0 }"
          >
            <!-- Service badge -->
            <div class="otp-card__header">
              <div class="otp-card__service">
                <div
                  class="otp-card__service-icon"
                  :style="{ background: getServiceConfig(otp.service).color }"
                >
                  {{ getServiceConfig(otp.service).icon }}
                </div>
                <span class="otp-card__service-name">{{ otp.serviceName }}</span>
              </div>
              <div class="otp-card__meta">
                <span class="otp-card__time">{{ timeSince(otp.createdAt) }}</span>
                <button v-if="isAdmin" class="otp-card__delete" @click="deleteOtp(otp.id)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <!-- OTP Code Display -->
            <div class="otp-card__code-container">
              <div class="otp-card__code" :class="{ 'otp-card__code--expired': isExpired(otp) }">
                {{ otp.code }}
              </div>
              <button
                class="otp-card__copy"
                :class="{ 'otp-card__copy--copied': copiedId === otp.id }"
                @click="copyCode(otp.code, otp.id)"
                :disabled="isExpired(otp)"
              >
                <component :is="copiedId === otp.id ? Check : Copy" :size="16" />
                <span>{{ copiedId === otp.id ? 'Copied!' : 'Copy' }}</span>
              </button>
            </div>

            <!-- Countdown Timer -->
            <div class="otp-card__timer">
              <div class="otp-card__progress-bar">
                <div
                  class="otp-card__progress-fill"
                  :style="{
                    width: getProgressPercent(otp) + '%',
                    background: isExpired(otp) ? 'var(--error)' : getProgressPercent(otp) < 30 ? 'var(--warning)' : 'var(--success)'
                  }"
                />
              </div>
              <div class="otp-card__countdown">
                <Clock :size="12" />
                <span v-if="isExpired(otp)" class="otp-card__expired-text">Đã hết hạn</span>
                <span v-else>{{ formatCountdown(getTimeRemaining(otp.expiresAt)) }}</span>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>

      <!-- Empty State -->
      <div v-else class="otp-empty">
        <div class="otp-empty__icon">
          <KeyRound :size="48" />
        </div>
        <h2>Chưa có mã OTP nào</h2>
        <p>Khi admin gửi mã OTP, bạn sẽ thấy ở đây và nhận được push notification nếu đã đăng ký.</p>
        <button
          v-if="pushSupported && !pushSubscribed"
          class="otp-subscribe-btn otp-subscribe-btn--large"
          @click="subscribePush"
          :disabled="pushLoading"
        >
          <Bell :size="18" />
          <span>{{ pushLoading ? 'Đang xử lý...' : 'Đăng ký nhận thông báo' }}</span>
        </button>
      </div>

      <!-- Not supported banner -->
      <div v-if="!pushSupported" class="otp-not-supported">
        <p>⚠️ Trình duyệt của bạn không hỗ trợ Push Notification. Hãy thử mở page này trên Chrome/Safari hoặc cài FinNote làm PWA.</p>
      </div>

      <AppIntroCta />
    </div>
  </div>
</template>

<style scoped>
.otp-hub {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg-primary);
  padding: 1rem;
  padding-bottom: 6rem;
}

.otp-hub__container {
  max-width: 36rem;
  margin: 0 auto;
}

/* ── Header ── */
.otp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 0;
  margin-bottom: 0.5rem;
}

.otp-header__left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.otp-header__icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-xl);
  background: var(--accent-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.otp-header__title {
  font-size: var(--font-size-2xl);
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.otp-header__subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin-top: 0.125rem;
}

.otp-header__actions {
  flex-shrink: 0;
}

/* ── Subscribe Buttons ── */
.otp-subscribe-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: var(--radius-lg);
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: var(--font-size-sm);
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
}

.otp-subscribe-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
  transform: translateY(-1px);
}

.otp-subscribe-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.otp-subscribe-btn--large {
  padding: 0.875rem 1.5rem;
  font-size: var(--font-size-base);
  margin-top: 1rem;
}

.otp-unsubscribe-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: var(--radius-lg);
  background: var(--accent-subtle);
  color: var(--accent);
  font-weight: 600;
  font-size: var(--font-size-sm);
  border: 1px solid var(--accent);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
}

.otp-unsubscribe-btn:hover:not(:disabled) {
  background: var(--accent);
  color: white;
}

/* ── Subscribed Banner ── */
.otp-subscribed-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-lg);
  background: rgba(52, 211, 153, 0.08);
  border: 1px solid rgba(52, 211, 153, 0.2);
  color: var(--success);
  font-size: var(--font-size-sm);
  margin-bottom: 1rem;
  animation: fadeSlideIn 0.3s ease;
}

/* ── Admin Panel ── */
.admin-panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.admin-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: background var(--transition-fast);
  color: var(--text-secondary);
}

.admin-panel__header:hover {
  background: var(--bg-hover);
}

.admin-panel__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.admin-badge {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-subtle);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
}

.admin-panel__body {
  padding: 0 1.25rem 1.25rem;
  animation: fadeSlideIn 0.2s ease;
}

/* ── OTP Form ── */
.otp-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.otp-form__row {
  display: flex;
  gap: 0.75rem;
}

.otp-form__field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.otp-form__field--code {
  flex: 2;
}

.otp-form__field--expiry {
  flex: 0 0 5.5rem;
}

.otp-form__field label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.otp-form__field input,
.otp-form__field select,
.service-select select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-family: var(--font-family);
  transition: border-color var(--transition-fast);
  outline: none;
}

.otp-form__field input:focus,
.otp-form__field select:focus,
.service-select select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}

.otp-code-input {
  font-family: 'Courier New', monospace !important;
  font-size: var(--font-size-lg) !important;
  font-weight: 700 !important;
  letter-spacing: 0.15em;
}

.otp-form__actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.25rem;
}

.otp-send-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: white;
  font-weight: 700;
  font-size: var(--font-size-base);
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
}

.otp-send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
}

.otp-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.otp-settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.otp-settings-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ── Settings Panel ── */
.settings-panel {
  margin-top: 0.75rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  animation: fadeSlideIn 0.2s ease;
}

.settings-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.settings-panel__row label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.settings-panel__input-group {
  display: flex;
  gap: 0.5rem;
}

.settings-panel__input-group input {
  width: 4rem;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  text-align: center;
  outline: none;
}

.settings-save-btn {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
  font-size: var(--font-size-sm);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.settings-save-btn:hover {
  background: var(--accent-hover);
}

.settings-panel__info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

/* ── Loading ── */
.otp-loading {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

/* ── OTP Card List ── */
.otp-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── OTP Card ── */
.otp-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  padding: 1.25rem;
  transition: all var(--transition-base);
  animation: fadeSlideIn 0.3s ease;
  position: relative;
  overflow: hidden;
}

.otp-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.otp-card--expired {
  opacity: 0.5;
}

.otp-card--pulse::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent-gradient);
  animation: shimmer 2s ease-in-out infinite;
}

.otp-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.otp-card__service {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.otp-card__service-icon {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-base);
  font-weight: 900;
  color: white;
  flex-shrink: 0;
}

.otp-card__service-name {
  font-weight: 700;
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.otp-card__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.otp-card__time {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.otp-card__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.otp-card__delete:hover {
  background: rgba(251, 113, 133, 0.1);
  color: var(--error);
}

/* ── OTP Code Display ── */
.otp-card__code-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.otp-card__code {
  flex: 1;
  font-family: 'Courier New', 'SF Mono', monospace;
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: 0.25em;
  color: var(--text-primary);
  padding: 0.5rem 0;
  line-height: 1;
  transition: color var(--transition-base);
}

.otp-card__code--expired {
  color: var(--text-disabled);
  text-decoration: line-through;
}

.otp-card__copy {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  flex-shrink: 0;
}

.otp-card__copy:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.otp-card__copy--copied {
  background: rgba(52, 211, 153, 0.1) !important;
  border-color: var(--success) !important;
  color: var(--success) !important;
}

.otp-card__copy:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ── Countdown Timer ── */
.otp-card__timer {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.otp-card__progress-bar {
  height: 3px;
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  overflow: hidden;
}

.otp-card__progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 1s linear, background 0.5s ease;
}

.otp-card__countdown {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.otp-card__expired-text {
  color: var(--error);
}

/* ── Empty State ── */
.otp-empty {
  text-align: center;
  padding: 4rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.otp-empty__icon {
  width: 5rem;
  height: 5rem;
  border-radius: var(--radius-xl);
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  margin-bottom: 1.5rem;
}

.otp-empty h2 {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.otp-empty p {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  max-width: 20rem;
  line-height: 1.5;
}

/* ── Not Supported ── */
.otp-not-supported {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.2);
  color: var(--warning);
  font-size: var(--font-size-sm);
  margin-top: 1rem;
  line-height: 1.5;
}

/* ── Animations ── */
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ── Transition Group ── */
.otp-card-enter-active {
  animation: fadeSlideIn 0.3s ease;
}

.otp-card-leave-active {
  transition: all 0.2s ease;
}

.otp-card-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.otp-card-move {
  transition: transform 0.3s ease;
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .otp-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .otp-card__code {
    font-size: 1.75rem;
    letter-spacing: 0.2em;
  }

  .otp-form__row {
    flex-direction: column;
  }

  .otp-form__field--expiry {
    flex: 1;
  }

  .settings-panel__row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
