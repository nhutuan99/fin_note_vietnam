import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuickAddStore } from '@/stores/quickAdd'
import { useRoutinesStore, type RoutineItem } from '@/stores/routines'
import { useUiStore } from '@/stores/ui'
import { useEventListener } from '@/composables/useEventListener'
import type { TransactionType } from '@/types'

/** Routine inbox fetched within this window is reused when coming back to the app */
const INBOX_MAX_AGE_MS = 5 * 60 * 1000
/** Never hold the popup back longer than this waiting for the inbox */
const INBOX_WAIT_MS = 700

/**
 * Opens the quick-add popup:
 * - when the app starts and every time the user comes back to the app/tab, on any page (when enabled),
 * - from home-screen shortcuts / links with `?quick=1|income|expense`, and
 * - in routine mode from a routine notification (`?routine=<occurrence>`), or whenever routine
 *   occurrences are waiting for the user — these come first.
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
  function nothingOpen() {
    return !store.isOpen && !ui.confirmState.isOpen && !ui.pinState.isOpen
  }

  function canAutoOpen() {
    return store.prefs.enabled && nothingOpen()
  }

  function openRoutineQueue(items: RoutineItem[]) {
    routines.queue = [...items]
    store.open('routine')
  }

  /** App start: waiting routine occurrences open first (regardless of the quick-add switch) */
  async function openRoutinesIfWaiting(): Promise<boolean> {
    if (!nothingOpen()) return false
    const items = await Promise.race([
      routines.fetchInbox(),
      new Promise<RoutineItem[]>((resolve) => setTimeout(() => resolve(routines.attention), INBOX_WAIT_MS))
    ])
    if (!items.length || !nothingOpen()) return false
    openRoutineQueue(items)
    return true
  }

  /**
   * Back in the app: open at once from what is already known — never wait on the network — then
   * refresh the routine inbox in the background. Newly waiting occurrences take over the popup only
   * if it opened by itself and hasn't been touched; otherwise they wait for the next return.
   */
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !nothingOpen()) return
    if (routines.attention.length) openRoutineQueue(routines.attention)
    else if (canAutoOpen()) store.open('visibility')
    const openedNow = store.isOpen

    void routines.fetchInbox(INBOX_MAX_AGE_MS).then((items) => {
      if (!items.length) return
      if (!store.isOpen) {
        // Nothing was shown on this return (quick add off) → show the routines; but a popup the
        // user already closed is not brought back
        if (!openedNow && nothingOpen()) openRoutineQueue(items)
        return
      }
      if (store.reason === 'routine') return
      const queueBefore = routines.queue
      routines.queue = [...items]
      if (!store.switchToRoutine()) routines.queue = queueBefore
    })
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
    store.open('routine')
    return true
  }

  /**
   * App start: waiting routine occurrences first; otherwise the quick-add popup straight away from
   * the cached prefs, or — first launch on this device — as soon as the synced prefs say it's on.
   * At most once per start.
   */
  let launchHandled = false
  function openOnLaunch() {
    if (launchHandled || !canAutoOpen()) return
    launchHandled = true
    store.open('launch')
  }

  onMounted(async () => {
    const prefsLoaded = store.loadPrefs()
    launchHandled = handleQuickParam() || (await handleRoutineParam()) || (await openRoutinesIfWaiting())
    openOnLaunch()
    await prefsLoaded
    openOnLaunch()
    launchHandled = true
  })

  watch(() => route.query.quick, () => void handleQuickParam())
  watch(() => route.query.routine, () => void handleRoutineParam())
}
