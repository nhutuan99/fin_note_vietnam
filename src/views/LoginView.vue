<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { httpClient } from '@/shared/api/httpClient'
import { useRouter, useRoute } from 'vue-router'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, KeyRound, RotateCcw, CheckCircle2, ChevronLeft, ShieldCheck, Sparkles, LogIn, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { setLocale, currentLocale } from '@/i18n'
import { useEventListener } from '@/composables/useEventListener'
import LogoLoader from '@/components/ui/LogoLoader.vue'
import { GOOGLE_OAUTH_AUTH_URL } from '@/constants/api'

// Ã¢â€â‚¬Ã¢â€â‚¬ Interactive Mouse Glow Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const mouseX = ref(0)
const mouseY = ref(0)
const isMouseActive = ref(false)

function handleMouseMove(e: MouseEvent) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
  isMouseActive.value = true
}

useEventListener(window, 'mousemove', handleMouseMove as EventListener)
useEventListener(document, 'mouseleave', () => { isMouseActive.value = false })

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()

// Ã¢â€â‚¬Ã¢â€â‚¬ Login / Register Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const isLogin = ref(true)
const loading = ref(false)
const showPassword = ref(false)
const error = ref('')
const form = ref({ email: '', password: '', name: '' })


const isValid = computed(() => {
  if (!form.value.email || !form.value.password) return false
  if (!isLogin.value && !form.value.name) return false
  return true
})

async function handleSubmit() {
  if (!isValid.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const endpoint = isLogin.value ? '/api/auth/login' : '/api/auth/register'
    const result = await httpClient.post<{ token: string; refreshToken?: string; user: any }>(endpoint, form.value)
    if (result) {
      auth.setAuth(result.token, result.user, result.refreshToken)
      ui.showToast('success', `${t(isLogin.value ? 'login.welcomeBack' : 'common.confirm')}, ${result.user.name}!`)
      router.push('/')
    }
  } catch (err: any) {
    error.value = err.message || t('common.somethingWentWrong')
    ui.showToast('error', error.value)
  } finally {
    loading.value = false
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Google Sign-In Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const googleLoading = ref(false)
const googleError = ref('')

/** Redirect user to Google OAuth for sign-in / sign-up */
function startGoogleSignIn() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    // Fallback: request from backend (works even without env var)
    startGoogleSignInViaBackend()
    return
  }
  const redirectUri = `${window.location.origin}/login`
  const state = btoa(JSON.stringify({ flow: 'signin' }))
  sessionStorage.setItem('google_signin_flow', 'true')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'online',
    state,
    prompt: 'select_account'
  })
  window.location.href = `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`
}

/** Fallback: request OAuth URL from backend (re-uses google-oauth-url endpoint without email check) */
async function startGoogleSignInViaBackend() {
  googleLoading.value = true
  googleError.value = ''
  try {
    // Use a dummy email just to get the OAuth URL â€” backend will be updated to handle this
    const redirectUri = `${window.location.origin}/login`
    sessionStorage.setItem('google_signin_flow', 'true')
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email profile',
      access_type: 'online',
      state: btoa(JSON.stringify({ flow: 'signin' })),
      prompt: 'select_account'
    })
    window.location.href = `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`
  } catch (err: any) {
    googleError.value = err.message || t('common.somethingWentWrong')
  } finally {
    googleLoading.value = false
  }
}

/** Handle Google OAuth callback for sign-in */
async function handleGoogleSignInCallback(code: string) {
  googleLoading.value = true
  googleError.value = ''
  try {
    const res = await httpClient.post<{ token: string; refreshToken?: string; user: any; isNewUser?: boolean }>('/api/auth/google-signin', {
      code,
      redirectUri: `${window.location.origin}/login`
    })
    if (res?.token && res?.user) {
      auth.setAuth(res.token, res.user, res.refreshToken)
      const welcomeMsg = res.isNewUser
        ? `${t('login.createAccount')} ${t('common.confirm')}! ${t('login.welcomeBack')}, ${res.user.name}!`
        : `${t('login.welcomeBack')}, ${res.user.name}!`
      ui.showToast('success', welcomeMsg)
      router.push('/')
    }
  } catch (err: any) {
    googleError.value = err.message || t('common.somethingWentWrong')
    error.value = googleError.value
  } finally {
    googleLoading.value = false
    sessionStorage.removeItem('google_signin_flow')
    window.history.replaceState({}, '', '/login')
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Forgot Password Flow (Google OAuth Verification) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// step: 'login' | 'email' | 'google-pending' | 'newpass' | 'done'
const fpStep = ref<'login' | 'email' | 'google-pending' | 'newpass' | 'done'>('login')
const fpEmail = ref('')
const fpResetToken = ref('')
const fpNewPass = ref('')
const fpConfirmPass = ref('')
const fpShowNew = ref(false)
const fpShowConfirm = ref(false)
const fpLoading = ref(false)
const fpError = ref('')

const showGuestWelcome = ref(!route.query.expired && !localStorage.getItem('guest_popup_closed'))

function closeGuestWelcome() {
  showGuestWelcome.value = false
  localStorage.setItem('guest_popup_closed', 'true')
}

function goForgot() {
  fpStep.value = 'email'
  fpEmail.value = ''
  fpResetToken.value = ''
  fpNewPass.value = ''
  fpConfirmPass.value = ''
  fpError.value = ''
}

function goBack() {
  fpError.value = ''
  if (fpStep.value === 'email') fpStep.value = 'login'
  else if (fpStep.value === 'google-pending') fpStep.value = 'email'
  else if (fpStep.value === 'newpass') fpStep.value = 'email'
  else fpStep.value = 'login'
}

/** Get the redirect URI for Google OAuth (current page URL without query params) */
function getRedirectUri(): string {
  return `${window.location.origin}/login`
}

/** Step 1: Request Google OAuth URL from backend, then redirect user to Google */
async function requestGoogleOAuth() {
  if (!fpEmail.value) return
  fpLoading.value = true
  fpError.value = ''
  try {
    const res = await httpClient.post<{ url: string }>('/api/auth/google-oauth-url', {
      email: fpEmail.value,
      redirectUri: getRedirectUri()
    })
    if (res?.url) {
      // Save email to sessionStorage so we can use it after redirect back
      sessionStorage.setItem('fp_email', fpEmail.value)
      // Redirect to Google OAuth
      window.location.href = res.url
    }
  } catch (err: any) {
    fpError.value = err.message || t('forgot.googleVerifyFailed')
  } finally {
    fpLoading.value = false
  }
}

/** Step 2: Handle Google OAuth callback â€” exchange code for resetToken */
async function handleOAuthCallback(code: string, state: string) {
  fpStep.value = 'google-pending'
  fpLoading.value = true
  fpError.value = ''
  fpEmail.value = sessionStorage.getItem('fp_email') || ''

  try {
    const res = await httpClient.post<{ resetToken: string; email: string }>('/api/auth/google-verify', {
      code,
      state,
      redirectUri: getRedirectUri()
    })
    if (res?.resetToken) {
      fpResetToken.value = res.resetToken
      fpEmail.value = res.email
      fpStep.value = 'newpass'
      ui.showToast('success', t('forgot.googleVerified'))
    }
  } catch (err: any) {
    fpError.value = err.message || t('forgot.googleVerifyFailed')
  } finally {
    fpLoading.value = false
    sessionStorage.removeItem('fp_email')
    // Clean URL params without reload
    window.history.replaceState({}, '', '/login')
  }
}

/** Step 3: Set new password */
async function resetPassword() {
  fpError.value = ''
  if (fpNewPass.value.length < 6) {
    fpError.value = t('forgot.passMinLength')
    return
  }
  if (fpNewPass.value !== fpConfirmPass.value) {
    fpError.value = t('forgot.passMismatch')
    return
  }
  fpLoading.value = true
  try {
    await httpClient.post('/api/auth/reset-password', {
      email: fpEmail.value,
      resetToken: fpResetToken.value,
      newPassword: fpNewPass.value
    })
    fpStep.value = 'done'
    ui.showToast('success', t('forgot.resetSuccess'))
  } catch (err: any) {
    fpError.value = err.message || t('forgot.resetFailed')
  } finally {
    fpLoading.value = false
  }
}

function backToLoginFromDone() {
  fpStep.value = 'login'
  isLogin.value = true
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Handle OAuth callback on page load Ã¢â€â‚¬Ã¢â€â‚¬
watch(
  () => route.query,
  (query) => {
    if (query.expired === '1') {
      ui.showToast('warning', t('login.guestExpired'))
      router.replace({ path: '/login' })
    }
    const code = query.code as string
    const state = query.state as string
    if (code && state && fpStep.value === 'login') {
      // Determine if this is a sign-in callback or forgot-password callback
      let isSignInFlow = sessionStorage.getItem('google_signin_flow') === 'true'
      try {
        const stateData = JSON.parse(atob(state))
        if (stateData.flow === 'signin') isSignInFlow = true
      } catch {}

      if (isSignInFlow) {
        handleGoogleSignInCallback(code)
      } else {
        handleOAuthCallback(code, state)
      }
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="bg-bg-base text-text-primary relative flex min-h-screen min-h-[100dvh] items-center justify-center p-4 pt-[max(env(safe-area-inset-top,0px),1rem)]">
    <!-- Language Switcher -->
    <div class="absolute right-4 z-10 flex items-center gap-1" style="top: max(env(safe-area-inset-top, 0px), 1rem)">
      <button
        @click="setLocale('vi')"
        :class="['text-sm font-semibold transition-colors rounded-lg px-3 py-2', locale === 'vi' ? 'text-accent bg-accent-subtle' : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover']"
      >
        VI
      </button>
      <span class="text-border-strong text-xs select-none">|</span>
      <button
        @click="setLocale('en')"
        :class="['text-sm font-semibold transition-colors rounded-lg px-3 py-2', locale === 'en' ? 'text-accent bg-accent-subtle' : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover']"
      >
        EN
      </button>
    </div>

    <!-- Background grid -->
    <div class="pointer-events-none absolute inset-0">
      <div
        class="absolute inset-0"
        style="
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 3.75rem 3.75rem;
        "
      ></div>
    </div>

    <!-- Interactive Mouse Glow -->
    <div
      class="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
      :style="{ opacity: isMouseActive ? 1 : 0 }"
      aria-hidden="true"
    >
      <div
        class="absolute inset-0"
        :style="{
          background: `radial-gradient(800px circle at ${mouseX}px ${mouseY}px, rgba(124, 111, 247, 0.12), transparent 40%)`
        }"
      ></div>
    </div>

    <!-- Ambient violet orbs (background glow) -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="login-orb login-orb-1"></div>
      <div class="login-orb login-orb-2"></div>
    </div>

    <div class="relative z-10 w-full max-w-[25rem] px-4">
      <!-- Logo & Brand -->
      <div class="mb-7 text-center flex flex-col items-center">
        <div class="relative z-10 flex h-16 w-16 items-center justify-center mb-3">
          <img src="/images/logo-512.png" alt="FinNote Logo" class="h-full w-full rounded-2xl drop-shadow-[0_0_18px_rgba(124,111,247,0.55)] object-cover" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-text-primary">FinNote</h1>
        <p class="text-text-tertiary text-sm mt-1">{{ t('login.tagline') }}</p>
      </div>

      <!-- â•â• STEP: LOGIN / REGISTER â•â• -->
      <div v-if="fpStep === 'login'" class="bg-bg-surface border-border-default rounded-2xl border p-6 shadow-xl relative z-10 backdrop-blur-xl">
        <div class="mb-5">
          <h2 class="mb-0.5 text-lg font-semibold">
            {{ isLogin ? t('login.welcomeBack') : t('login.createAccount') }}
          </h2>
          <p class="text-text-tertiary text-sm">
            {{ isLogin ? t('login.signInDesc') : t('login.signUpDesc') }}
          </p>
        </div>

        <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
          <!-- Name -->
          <transition name="slide">
            <div v-if="!isLogin" class="flex flex-col gap-2">
              <label for="name-input" class="text-text-secondary text-xs font-semibold uppercase tracking-wide">{{ t('login.name') }}</label>
              <div class="relative flex items-center">
                <User :size="15" class="text-text-tertiary pointer-events-none absolute left-3" />
                <input
                  id="name-input"
                  v-model="form.name"
                  type="text"
                  :placeholder="t('login.namePlaceholder')"
                  autocomplete="name"
                  @focus="error = ''"
                  class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border py-2.5 pr-3 pl-[2.25rem] text-sm transition-all duration-150 focus:ring-2 focus:outline-none"
                />
              </div>
            </div>
          </transition>

          <!-- Email -->
          <div class="flex flex-col gap-2">
            <label for="email-input" class="text-text-secondary text-xs font-semibold uppercase tracking-wide">{{ t('login.email') }}</label>
            <div class="relative flex items-center">
              <Mail :size="15" class="text-text-tertiary pointer-events-none absolute left-3" />
              <input
                id="email-input"
                v-model="form.email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
                @focus="error = ''"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border py-2.5 pr-3 pl-[2.25rem] text-sm transition-all duration-150 focus:ring-2 focus:outline-none"
              />
            </div>
          </div>

          <!-- Password -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label for="password-input" class="text-text-secondary text-xs font-semibold uppercase tracking-wide">{{ t('login.password') }}</label>
              <button
                v-if="isLogin"
                type="button"
                class="text-accent hover:text-accent-text text-xs transition-colors duration-150"
                @click="goForgot"
              >
                {{ t('login.forgotPassword') }}
              </button>
            </div>
            <div class="relative flex items-center">
              <Lock :size="15" class="text-text-tertiary pointer-events-none absolute left-3" />
              <input
                id="password-input"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                autocomplete="current-password"
                required
                @focus="error = ''"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border py-2.5 pr-10 pl-[2.25rem] text-sm transition-all duration-150 focus:ring-2 focus:outline-none"
              />
              <button type="button" class="text-text-tertiary hover:text-text-primary absolute right-3 transition-colors duration-150" @click="showPassword = !showPassword">
                <component :is="showPassword ? EyeOff : Eye" :size="15" />
              </button>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="bg-error/10 border-error/20 text-error rounded-lg border px-3 py-2.5 text-sm flex items-start gap-2">
            <span class="shrink-0 mt-0.5">⚠</span>
            <span>{{ error }}</span>
          </div>

          <!-- Submit -->
          <button
            id="submit-btn"
            type="submit"
            :disabled="!isValid || loading"
            class="btn-primary w-full justify-center py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <AppSpinner v-if="loading" :size="16" />
            <span>{{ isLogin ? t('login.signIn') : t('login.signUp') }}</span>
            <ArrowRight :size="15" v-if="!loading" />
          </button>
        </form>

        <!-- Divider -->
        <div class="relative my-4">
          <div class="border-border-default absolute inset-0 flex items-center">
            <div class="w-full border-t"></div>
          </div>
          <div class="relative flex justify-center">
            <span class="bg-bg-surface text-text-disabled px-3 text-xs">{{ t('login.orContinueWith') }}</span>
          </div>
        </div>

        <!-- Google Sign-In Button -->
        <button
          type="button"
          :disabled="googleLoading"
          class="border-border-default bg-bg-elevated hover:bg-bg-hover text-text-primary flex w-full items-center justify-center gap-2.5 rounded-xl border py-2.5 text-sm font-medium transition-all duration-150 disabled:opacity-50"
          @click="startGoogleSignIn"
        >
          <AppSpinner v-if="googleLoading" :size="15" />
          <svg v-if="!googleLoading" viewBox="0 0 24 24" class="h-[1.0625rem] w-[1.0625rem]">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>{{ t('login.continueWithGoogle') }}</span>
        </button>

        <div class="border-border-default text-text-tertiary mt-4 border-t pt-4 text-center text-sm">
          <span>{{ isLogin ? t('login.noAccount') : t('login.hasAccount') }}</span>
          <button class="text-accent hover:text-accent-text ml-1 font-medium transition-colors duration-150" @click="isLogin = !isLogin; error = ''">
            {{ isLogin ? t('login.signUp') : t('login.signIn') }}
          </button>
        </div>
      </div>

      <!-- â•â• STEP 1: Enter Email â•â• -->
      <div v-else-if="fpStep === 'email'" class="bg-bg-surface border-border-default rounded-2xl border p-6 shadow-xl relative z-10 backdrop-blur-xl">
        <button @click="goBack" class="text-text-tertiary hover:text-text-primary mb-4 flex items-center gap-1.5 text-sm transition-colors">
          <ChevronLeft :size="16" />
          {{ t('login.backToLogin') }}
        </button>

        <div class="mb-5 flex items-start gap-3">
          <div class="bg-accent/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <KeyRound :size="20" class="text-accent" />
          </div>
          <div>
            <h2 class="mb-0.5 text-lg font-semibold">{{ t('forgot.title') }}</h2>
            <p class="text-text-tertiary text-sm">{{ t('forgot.desc') }}</p>
          </div>
        </div>

        <form @submit.prevent="requestGoogleOAuth()" class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-text-secondary text-xs font-semibold uppercase tracking-wide">{{ t('login.email') }}</label>
            <div class="relative flex items-center">
              <Mail :size="15" class="text-text-tertiary pointer-events-none absolute left-3" />
              <input
                v-model="fpEmail"
                type="email"
                :placeholder="t('forgot.emailPlaceholder')"
                autocomplete="email"
                required
                @focus="fpError = ''"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border py-2.5 pr-3 pl-[2.25rem] text-sm transition-all duration-150 focus:ring-2 focus:outline-none"
              />
            </div>
          </div>

          <!-- Google OAuth info -->
          <div class="bg-accent/5 border-accent/20 rounded-lg border px-3 py-3">
            <div class="flex items-start gap-2">
              <ShieldCheck :size="15" class="text-accent mt-0.5 shrink-0" />
              <p class="text-text-secondary text-xs leading-relaxed">
                {{ t('forgot.googleOAuthHint') }}
              </p>
            </div>
          </div>

          <div v-if="fpError" class="bg-error/10 border-error/20 text-error rounded-lg border px-3 py-2.5 text-sm">
            {{ fpError }}
          </div>

          <button
            type="submit"
            :disabled="fpLoading || !fpEmail"
            class="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
          >
            <AppSpinner v-if="fpLoading" :size="16" />
            <template v-else>
              <!-- Google icon -->
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>{{ t('forgot.verifyWithGoogle') }}</span>
            </template>
          </button>
        </form>
      </div>

      <!-- â•â• STEP: Google Pending (loading while exchanging code) â•â• -->
      <div v-else-if="fpStep === 'google-pending'" class="bg-bg-surface border-border-default rounded-2xl border p-8 shadow-xl text-center">
        <div class="mb-4 flex justify-center">
          <div class="bg-accent/10 flex h-16 w-16 items-center justify-center rounded-full">
            <ShieldCheck :size="36" class="text-accent" />
          </div>
        </div>

        <template v-if="fpLoading">
          <h2 class="mb-2 text-xl font-bold">{{ t('forgot.googleVerifying') }}</h2>
          <p class="text-text-tertiary mb-6 text-sm">{{ t('forgot.googleVerifyingDesc') }}</p>
          <div class="flex justify-center">
            <LogoLoader :size="32" :showGlow="true" />
          </div>
        </template>

        <template v-else-if="fpError">
          <h2 class="mb-2 text-xl font-bold text-error">{{ t('forgot.googleVerifyFailed') }}</h2>
          <p class="text-text-tertiary mb-6 text-sm">{{ fpError }}</p>
          <button @click="goForgot" class="btn-primary w-full justify-center py-3">
            <RotateCcw :size="16" />
            <span>{{ t('forgot.tryAgain') }}</span>
          </button>
        </template>
      </div>

      <!-- â•â• STEP 3: New Password â•â• -->
      <div v-else-if="fpStep === 'newpass'" class="bg-bg-surface border-border-default rounded-2xl border p-6 shadow-xl relative z-10 backdrop-blur-xl">
        <div class="mb-5 flex items-start gap-3">
          <div class="bg-success/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Lock :size="20" class="text-success" />
          </div>
          <div>
            <h2 class="mb-0.5 text-lg font-semibold">{{ t('forgot.newPassTitle') }}</h2>
            <p class="text-text-tertiary text-sm">{{ t('forgot.newPassDesc') }}</p>
          </div>
        </div>

        <!-- Verified badge -->
        <div class="bg-success/5 border-success/20 mb-4 flex items-center gap-2 rounded-lg border px-3 py-2.5">
          <CheckCircle2 :size="15" class="text-success shrink-0" />
          <span class="text-success text-xs font-medium">{{ t('forgot.emailVerified', { email: fpEmail }) }}</span>
        </div>

        <form @submit.prevent="resetPassword" class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-text-secondary text-xs font-semibold uppercase tracking-wide">{{ t('forgot.newPassword') }}</label>
            <div class="relative">
              <Lock :size="15" class="text-text-tertiary pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
              <input
                v-model="fpNewPass"
                :type="fpShowNew ? 'text' : 'password'"
                required
                @focus="fpError = ''"
                :placeholder="t('forgot.newPassPlaceholder')"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border py-2.5 pr-10 pl-[2.25rem] text-sm transition-all focus:ring-2 focus:outline-none"
              />
              <button type="button" @click="fpShowNew = !fpShowNew" class="text-text-tertiary hover:text-text-primary absolute top-1/2 right-3 -translate-y-1/2">
                <component :is="fpShowNew ? EyeOff : Eye" :size="15" />
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-text-secondary text-xs font-semibold uppercase tracking-wide">{{ t('forgot.confirmPassword') }}</label>
            <div class="relative">
              <Lock :size="15" class="text-text-tertiary pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
              <input
                v-model="fpConfirmPass"
                :type="fpShowConfirm ? 'text' : 'password'"
                required
                @focus="fpError = ''"
                :placeholder="t('forgot.confirmPassPlaceholder')"
                class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border py-2.5 pr-10 pl-[2.25rem] text-sm transition-all focus:ring-2 focus:outline-none"
              />
              <button type="button" @click="fpShowConfirm = !fpShowConfirm" class="text-text-tertiary hover:text-text-primary absolute top-1/2 right-3 -translate-y-1/2">
                <component :is="fpShowConfirm ? EyeOff : Eye" :size="15" />
              </button>
            </div>
          </div>

          <div v-if="fpError" class="bg-error/10 border-error/20 text-error rounded-lg border px-3 py-2.5 text-sm">
            {{ fpError }}
          </div>

          <button
            type="submit"
            :disabled="fpLoading || !fpNewPass || !fpConfirmPass"
            class="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
          >
            <AppSpinner v-if="fpLoading" :size="16" />
            <span>{{ t('forgot.resetPassword') }}</span>
            <ArrowRight :size="15" v-if="!fpLoading" />
          </button>
        </form>
      </div>

      <!-- â•â• DONE â•â• -->
      <div v-else-if="fpStep === 'done'" class="bg-bg-surface border-border-default rounded-2xl border p-8 shadow-xl text-center">
        <div class="bg-success/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <CheckCircle2 :size="36" class="text-success" />
        </div>
        <h2 class="mb-2 text-xl font-bold">{{ t('forgot.doneTitle') }}</h2>
        <p class="text-text-tertiary mb-6 text-sm">{{ t('forgot.resetSuccess') }}</p>
        <button @click="backToLoginFromDone" class="btn-primary w-full justify-center py-3">
          <RotateCcw :size="16" />
          <span>{{ t('login.backToLogin') }}</span>
        </button>
      </div>

      <!-- Guest mode pill â€” only on login step, replaces the blocking popup -->
      <div v-if="fpStep === 'login' && !route.query.expired" class="mt-4">
        <button
          @click="auth.startGuestMode(router)"
          class="border-border-default bg-bg-surface hover:bg-bg-hover text-text-secondary flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all duration-150"
        >
          <Sparkles :size="14" class="text-accent" />
          <span>{{ t('login.guestMode') }}</span>
        </button>
      </div>

      <p class="text-text-disabled mt-5 text-center text-[0.6875rem]">
        {{ t('common.version') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition:
    transform 300ms ease,
    opacity 300ms ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateY(0.75rem);
}
.slide-leave-to {
  opacity: 0;
  transform: translateY(-0.75rem);
}

/* â”€â”€ Ambient orbs â”€â”€ */
.login-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.28;
}
.login-orb-1 {
  width: 32rem;
  height: 32rem;
  background: radial-gradient(circle, #7c6ff7 0%, transparent 65%);
  top: -10rem;
  left: -10rem;
}
.login-orb-2 {
  width: 26rem;
  height: 26rem;
  background: radial-gradient(circle, #a78bfa 0%, transparent 65%);
  bottom: -8rem;
  right: -8rem;
}
</style>
