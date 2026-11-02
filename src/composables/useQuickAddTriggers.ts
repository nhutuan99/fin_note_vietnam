import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuickAddStore } from '@/stores/quickAdd'
import { useUiStore } from '@/stores/ui'
import { useEventListener } from '@/composables/useEventListener'
import type { TransactionType } from '@/types'

/**
 * Opens the quick-add popup:
 * - every time the user comes back to the app/tab, on any page (when enabled in settings), and
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
