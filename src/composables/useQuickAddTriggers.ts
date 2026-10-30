import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuickAddStore } from '@/stores/quickAdd'
import { useUiStore } from '@/stores/ui'
import { useEventListener } from '@/composables/useEventListener'
import type { TransactionType } from '@/types'

/** Ignore quick tab flicks (alt-tab and back) so the popup doesn't pop up constantly */
const MIN_AWAY_MS = 3000

/** Pages where an automatic popup would get in the way (writing, or already adding a transaction) */
const NO_AUTO_OPEN_ROUTES = new Set(['note-detail', 'add-transaction', 'onboarding', 'otp-hub'])

function isTyping() {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

/**
 * Opens the quick-add popup:
 * - when the user comes back to the app/tab (if enabled in settings), and
 * - from home-screen shortcuts / links with `?quick=1|income|expense`.
 * Mount once in the authenticated layout.
 */
export function useQuickAddTriggers() {
  const store = useQuickAddStore()
  const ui = useUiStore()
  const route = useRoute()
  const router = useRouter()

  let hiddenAt = 0

  function canAutoOpen() {
    return (
      store.prefs.enabled &&
      !store.isOpen &&
      !ui.confirmState.isOpen &&
      !ui.pinState.isOpen &&
      !NO_AUTO_OPEN_ROUTES.has(String(route.name)) &&
      !isTyping()
    )
  }

  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    if (hiddenAt && Date.now() - hiddenAt >= MIN_AWAY_MS && canAutoOpen()) {
      store.open('visibility')
    }
    hiddenAt = 0
  })

  /** `?quick=` from the PWA shortcuts; the param is removed so a reload doesn't reopen it */
  function handleQuickParam() {
    const quick = route.query.quick
    if (typeof quick !== 'string') return
    const type: TransactionType | null = quick === 'income' || quick === 'expense' ? quick : null
    store.open('shortcut', type)
    const { quick: _quick, ...rest } = route.query
    router.replace({ query: rest })
  }

  onMounted(() => {
    void store.loadPrefs()
    handleQuickParam()
  })

  watch(() => route.query.quick, handleQuickParam)
}
