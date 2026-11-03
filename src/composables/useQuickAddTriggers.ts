import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuickAddStore } from '@/stores/quickAdd'
import { useUiStore } from '@/stores/ui'
import { useEventListener } from '@/composables/useEventListener'
import type { TransactionType } from '@/types'

/**
 * Opens the quick-add popup:
 * - when the app starts and every time the user comes back to the app/tab, on any page (when enabled), and
 * - from home-screen shortcuts / links with `?quick=1|income|expense`.
 * Mount once in the authenticated layout.
 */
export function useQuickAddTriggers() {
  const store = useQuickAddStore()
  const ui = useUiStore()
  const route = useRoute()
  const router = useRouter()

  // Only a confirm/PIN prompt that is already waiting for an answer takes precedence
  function canAutoOpen() {
    return store.prefs.enabled && !store.isOpen && !ui.confirmState.isOpen && !ui.pinState.isOpen
  }

  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible' && canAutoOpen()) store.open('visibility')
  })

  /** `?quick=` from the PWA shortcuts; the param is removed so a reload doesn't reopen it */
  function handleQuickParam(): boolean {
    const quick = route.query.quick
    if (typeof quick !== 'string') return false
    const type: TransactionType | null = quick === 'income' || quick === 'expense' ? quick : null
    store.open('shortcut', type)
    const { quick: _quick, ...rest } = route.query
    router.replace({ query: rest })
    return true
  }

  /**
   * App start: open straight away from the cached prefs, or — first launch on this device —
   * as soon as the synced prefs say the popup is on. At most once per start.
   */
  let launchHandled = false
  function openOnLaunch() {
    if (launchHandled || !canAutoOpen()) return
    launchHandled = true
    store.open('launch')
  }

  onMounted(async () => {
    launchHandled = handleQuickParam()
    openOnLaunch()
    await store.loadPrefs()
    openOnLaunch()
    launchHandled = true
  })

  watch(() => route.query.quick, () => void handleQuickParam())
}
