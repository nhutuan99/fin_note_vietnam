import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuickAddStore } from '@/stores/quickAdd'
import { useRoutinesStore } from '@/stores/routines'
import { useUiStore } from '@/stores/ui'
import type { TransactionType } from '@/types'

/**
 * Opens the quick-add popup only when the user asks for it:
 * - from home-screen shortcuts / links with `?quick=1|income|expense` (the weekly-review push
 *   also lands here), and
 * - in routine mode from a routine notification (`?routine=<occurrence>`). Routines are
 *   recorded by the server at their time and announced by push — the app never pops them up
 *   by itself.
 *
 * The popup no longer auto-opens on every launch/return; instead the server pushes a weekly
 * review reminder (configurable day) and tapping it opens the popup.
 * Mount once in the authenticated layout.
 */
export function useQuickAddTriggers() {
  const store = useQuickAddStore()
  const routines = useRoutinesStore()
  const ui = useUiStore()
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()

  function dropQuery(key: string) {
    const { [key]: _drop, ...rest } = route.query
    router.replace({ query: rest })
  }

  /** `?quick=` from the PWA shortcuts or the weekly-review push; removed so a reload doesn't reopen it */
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

  onMounted(async () => {
    void store.loadPrefs()
    if (!handleQuickParam()) await handleRoutineParam()
    // Records routines that came due before the cron got to them (and refreshes balances if so).
    void routines.fetchInbox()
  })

  watch(() => route.query.quick, () => void handleQuickParam())
  watch(() => route.query.routine, () => void handleRoutineParam())
}
