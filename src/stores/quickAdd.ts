import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TransactionType } from '@/types'
import { httpClient } from '@/shared/api/httpClient'
import { useAuthStore } from '@/stores/auth'
import { AUTH_TOKEN_KEY } from '@/constants/auth'

/** Synced across devices via /api/quick-add/prefs; mirrored in localStorage so the popup opens instantly. */
export interface QuickAddPrefs {
  enabled: boolean
  type: TransactionType
  walletId: string | null
  categories: { income: string; expense: string }
  updatedAt: string
}

/** Why the popup opened: automatic openings close themselves if left untouched */
export type QuickAddReason = 'launch' | 'visibility' | 'shortcut' | 'manual'

const CACHE_KEY = 'sn_quick_add_prefs'
const SAVE_DEBOUNCE_MS = 400

const DEFAULT_PREFS: QuickAddPrefs = {
  enabled: false,
  type: 'expense',
  walletId: null,
  categories: { income: 'salary', expense: 'food' },
  updatedAt: ''
}

function readCache(): QuickAddPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export const useQuickAddStore = defineStore('quickAdd', () => {
  const auth = useAuthStore()

  const prefs = ref<QuickAddPrefs>(readCache())
  const loaded = ref(false)
  const isOpen = ref(false)
  const reason = ref<QuickAddReason>('manual')
  /** Tab forced by the opener (e.g. the "money in" home-screen shortcut) */
  const forcedType = ref<TransactionType | null>(null)

  function canSync() {
    return !!localStorage.getItem(AUTH_TOKEN_KEY) || auth.isGuest
  }

  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(prefs.value))
    } catch {
      // Storage unavailable — the server copy still applies on next load
    }
  }

  async function loadPrefs() {
    if (!canSync()) return
    try {
      const data = await httpClient.get<QuickAddPrefs>('/api/quick-add/prefs', { silent: true })
      if (data) {
        prefs.value = { ...DEFAULT_PREFS, ...data }
        writeCache()
      }
    } catch (err) {
      console.error('Failed to load quick-add prefs:', err)
    } finally {
      loaded.value = true
    }
  }

  // Rapid changes (switching tabs, wallets) are merged into one request
  let pending: Partial<QuickAddPrefs> = {}
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function updatePrefs(patch: Partial<QuickAddPrefs>) {
    prefs.value = { ...prefs.value, ...patch }
    writeCache()
    if (!canSync()) return
    pending = { ...pending, ...patch }
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const body = pending
      pending = {}
      try {
        await httpClient.put('/api/quick-add/prefs', body, { silent: true })
      } catch (err) {
        console.error('Failed to save quick-add prefs:', err)
      }
    }, SAVE_DEBOUNCE_MS)
  }

  function open(why: QuickAddReason, type: TransactionType | null = null) {
    reason.value = why
    forcedType.value = type
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  return { prefs, loaded, isOpen, reason, forcedType, loadPrefs, updatePrefs, open, close }
})
