import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuickAddStore } from '@/stores/quickAdd'
import { useRoutinesStore } from '@/stores/routines'
import { useUiStore } from '@/stores/ui'
import { useEventListener } from '@/composables/useEventListener'
import type { TransactionType } from '@/types'

/**
 * Opens the quick-add popup:
 * - when the app starts and every time the user comes back to the app/tab, on any page (when enabled),
 * - from home-screen shortcuts / links with `?quick=1|income|expense`, and
 * - in routine mode only from a routine notification (`?routine=<occurrence>`). Routines are
 *   recorded by the server at their time and announced by push — the app never pops them up
 *   by itself.
 * Mount once in the authenticated layout.
 */
export function useQuickAddTriggers() {
  const store = useQuickAddStore()
  const routines = useRoutinesStore()
  const ui = useUiStore()
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()

  // Only a confirm/PIN prompt that is already waiting for an answer takes precedence
  function canAutoOpen() {
    return store.prefs.enabled && !store.isOpen && !ui.confirmState.isOpen && !ui.pinState.isOpen
  }

  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible' && canAutoOpen()) store.open('visibility')
  })

  function dropQuery(key: string) {
    const { [key]: _drop, ...rest } = route.query
    router.replace({ query: rest })
  }

  /** `?quick=` from the PWA shortcuts; the param is removed so a reload doesn't reopen it */
  function handleQuickParam(): boolean {
    const quick = route.query.quick
    if (typeof quick !== 'string') return false
    const type: TransactionType | null = quick === 'income' || quick === 'expense' ? quick : null
    store.open('shortcut', type)
    dropQuery('quick')
    return true
  }

  /** `?routine=<occurrence id>` from a routine notification: that exact occurrence, whatever its state */
  async function handleRoutineParam(): Promise<boolean> {
    const id = route.query.routine
    if (typeof id !== 'string') return false
    dropQuery('routine')
    const item = await routines.getItem(id)
    if (!item) {
      ui.showToast('info', t('routine.notFound'))
      return true
    }
    if (store.isOpen) store.close()
    routines.queue = [item]
    routines.fromNotification = true
    store.open('routine')
    return true
  }

  /**
   * App start: the quick-add popup straight away from the cached prefs, or — first launch on this
   * device — as soon as the synced prefs say it's on. At most once per start.
   */
  let launchHandled = false
  function openOnLaunch() {
    if (launchHandled || !canAutoOpen()) return
    launchHandled = true
    store.open('launch')
  }

  onMounted(async () => {
    const prefsLoaded = store.loadPrefs()
    launchHandled = handleQuickParam() || (await handleRoutineParam())
    // Records routines that came due before the cron got to them (and refreshes balances if so).
    // Only after the notification lookup: both settle routines on the server, never at once.
    void routines.fetchInbox()
    openOnLaunch()
    await prefsLoaded
    openOnLaunch()
    launchHandled = true
  })

  watch(() => route.query.quick, () => void handleQuickParam())
  watch(() => route.query.routine, () => void handleRoutineParam())
}
