import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface Toast {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(window.innerWidth >= 768)
  const searchOpen = ref(false)
  const showBugReport = ref(false)
  const showContactFeedback = ref(false)
  const showBuyMeCoffee = ref(false)
  const showWeeklyEvent = ref(false)
  const hasCompletedWeeklyEvent = ref(false)
  const toasts = ref<Toast[]>([])
  const theme = ref<'dark' | 'light'>(
    (localStorage.getItem('sn_theme') as 'dark' | 'light') || 'dark'
  )
  let toastId = 0

  // Apply theme to body
  watch(theme, (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('sn_theme', newTheme)
  }, { immediate: true })

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  const confirmState = ref<{
    isOpen: boolean
    options: ConfirmOptions
    resolve: ((value: boolean) => void) | null
  }>({
    isOpen: false,
    options: { title: '', message: '' },
    resolve: null
  })

  const pinState = ref<{
    isOpen: boolean
    title: string
    message: string
    resolve: ((value: boolean) => void) | null
  }>({
    isOpen: false,
    title: '',
    message: '',
    resolve: null
  })

  const hideBalances = ref(localStorage.getItem('sn_hide_balances') === 'true')
  const enableStocks = ref(localStorage.getItem('sn_enable_stocks') === 'true')

  watch(hideBalances, (val) => {
    localStorage.setItem('sn_hide_balances', val.toString())
  })

  watch(enableStocks, (val) => {
    localStorage.setItem('sn_enable_stocks', val.toString())
  })

  function toggleHideBalances() {
    hideBalances.value = !hideBalances.value
  }

  function checkWeeklyEvent() {
    const lastEvent = localStorage.getItem('sn_last_weekly_event')
    // Fallback to local storage or backend auth state. If we have the backend flag, use it instead.
    // Assuming we can sync it via auth store, but checking it here:
    // If it's been more than a week since the last event shown
    const now = Date.now()
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000
    if (!lastEvent || (now - parseInt(lastEvent)) > ONE_WEEK) {
      showWeeklyEvent.value = true
      hasCompletedWeeklyEvent.value = false
    } else {
      hasCompletedWeeklyEvent.value = true
    }
  }

  async function completeWeeklyEvent() {
    showWeeklyEvent.value = false
    hasCompletedWeeklyEvent.value = true
    const now = Date.now()
    localStorage.setItem('sn_last_weekly_event', now.toString())
    
    // Cache at BE
    try {
      const { httpClient } = await import('@/shared/api/httpClient')
      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      
      httpClient.put('/api/auth/profile', { lastWeeklyEvent: now })
        .then((updatedUser: any) => {
          if (updatedUser) auth.updateUser(updatedUser)
        })
        .catch(err => console.error('Failed to sync weekly event to BE:', err))
    } catch (e) {
      console.error('Failed to import for weekly event sync', e)
    }
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  function toggleSearch() {
    searchOpen.value = !searchOpen.value
  }

  function showToast(type: Toast['type'], message: string, duration = 4000) {
    const id = ++toastId
    toasts.value.push({ id, type, message })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, duration)
  }

  function removeToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function requestConfirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      confirmState.value = {
        isOpen: true,
        options,
        resolve
      }
    })
  }

  function resolveConfirm(result: boolean) {
    if (confirmState.value.resolve) {
      confirmState.value.resolve(result)
    }
    confirmState.value.isOpen = false
    // Delay clearing options to prevent UI flash during fade-out
    setTimeout(() => {
       confirmState.value.resolve = null
    }, 200)
  }

  async function requestPinValidation(title = 'Xác nhận bằng PIN', message = 'Nhập mã PIN để tiếp tục'): Promise<boolean> {
    try {
      const { httpClient } = await import('@/shared/api/httpClient')
      const data = await httpClient.get<{ hasPin: boolean }>('/api/pin')
      
      if (!data?.hasPin) {
        const confirmed = await requestConfirm({
          title: 'Yêu cầu mã PIN',
          message: 'Để bảo vệ dữ liệu, bạn cần thiết lập Mã PIN trước khi thực hiện các thao tác quan trọng.',
          confirmText: 'Thiết lập PIN ngay',
          danger: false
        })
        if (confirmed) {
          window.location.href = '/settings#pin'
        }
        return false
      }
      
      return new Promise((resolve) => {
        pinState.value = {
          isOpen: true,
          title,
          message,
          resolve
        }
      })
    } catch {
      return false
    }
  }

  function resolvePin(result: boolean) {
    if (pinState.value.resolve) {
      pinState.value.resolve(result)
    }
    pinState.value.isOpen = false
    setTimeout(() => {
       pinState.value.resolve = null
    }, 200)
  }

  return {
    sidebarOpen,
    searchOpen,
    toasts,
    theme,
    confirmState,
    pinState,
    hideBalances,
    enableStocks,
    toggleHideBalances,
    toggleSidebar,
    closeSidebar,
    toggleSearch,
    toggleTheme,
    showToast,
    removeToast,
    requestConfirm,
    resolveConfirm,
    requestPinValidation,
    resolvePin,
    showBugReport,
    showContactFeedback,
    showBuyMeCoffee,
    showWeeklyEvent,
    hasCompletedWeeklyEvent,
    checkWeeklyEvent,
    completeWeeklyEvent
  }
})
