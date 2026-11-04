import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Routine, RoutineInbox, RoutineInput, RoutineOccurrence } from '@/types'
import { httpClient } from '@/shared/api/httpClient'
import { useFinanceStore } from '@/stores/finance'
import { useAuthStore } from '@/stores/auth'

/** An occurrence shown in the quick-add popup, with the routine it belongs to */
export interface RoutineItem {
  occurrence: RoutineOccurrence
  routine: Routine
}

/** Minutes east of UTC, as the worker expects (Vietnam = 420) */
export const localTzOffset = () => -new Date().getTimezoneOffset()

const occurrenceUrl = (id: string, action?: string) =>
  `/api/routines/occurrences/${encodeURIComponent(id)}${action ? `/${action}` : ''}`

export const useRoutinesStore = defineStore('routines', () => {
  const routines = ref<Routine[]>([])
  const pending = ref<RoutineOccurrence[]>([])
  const loaded = ref(false)

  /** Occurrences shown one after another in the quick-add popup */
  const queue = ref<RoutineItem[]>([])
  const current = computed(() => queue.value[0] ?? null)
  /** The popup was opened from a routine notification: once handled, land on the transactions */
  const fromNotification = ref(false)

  const withRoutine = (list: RoutineOccurrence[]) =>
    list.flatMap((occurrence) => {
      const routine = routines.value.find((r) => r.id === occurrence.routineId)
      return routine ? [{ occurrence, routine }] : []
    })

  /** Waiting on the user: remind-only occurrences not recorded yet (auto-record ones never wait) */
  const attention = computed<RoutineItem[]>(() => withRoutine(pending.value))

  function upsert(routine: Routine) {
    const i = routines.value.findIndex((r) => r.id === routine.id)
    if (i === -1) routines.value.push(routine)
    else routines.value[i] = routine
  }

  async function fetchRoutines() {
    try {
      routines.value = (await httpClient.get<Routine[]>('/api/routines')) ?? []
    } finally {
      loaded.value = true
    }
  }

  /**
   * Also creates/records due occurrences on the server. Concurrent calls share one request,
   * so the server never settles the same routine twice at once.
   */
  let inboxRequest: Promise<RoutineItem[]> | null = null
  function fetchInbox(): Promise<RoutineItem[]> {
    inboxRequest ??= loadInbox().finally(() => (inboxRequest = null))
    return inboxRequest
  }

  async function loadInbox(): Promise<RoutineItem[]> {
    try {
      const data = await httpClient.get<RoutineInbox>('/api/routines/inbox', { silent: true })
      if (data) {
        routines.value = data.routines
        pending.value = data.pending
        loaded.value = true
        // Recorded just now (the cron hadn't got to it yet): balances on screen are stale
        if (data.recorded) refreshFinance()
      }
    } catch (err) {
      console.error('Failed to load routine inbox:', err)
    }
    return attention.value
  }

  async function getItem(occurrenceId: string): Promise<RoutineItem | null> {
    try {
      const data = await httpClient.get<{ occurrence: RoutineOccurrence; routine: Routine | null }>(occurrenceUrl(occurrenceId), {
        silent: true
      })
      return data?.routine ? { occurrence: data.occurrence, routine: data.routine } : null
    } catch {
      return null
    }
  }

  async function create(input: RoutineInput) {
    const routine = await httpClient.post<Routine>('/api/routines', { ...input, tzOffset: localTzOffset() })
    if (routine) upsert(routine)
    return routine
  }

  async function update(id: string, patch: Partial<RoutineInput> & { enabled?: boolean; pausedUntil?: string | null }) {
    const routine = await httpClient.put<Routine>(`/api/routines/${id}`, { ...patch, tzOffset: localTzOffset() })
    if (routine) upsert(routine)
    return routine
  }

  async function remove(id: string) {
    await httpClient.del(`/api/routines/${id}`)
    routines.value = routines.value.filter((r) => r.id !== id)
    pending.value = pending.value.filter((o) => o.routineId !== id)
  }

  function forget(occurrenceId: string) {
    pending.value = pending.value.filter((o) => o.id !== occurrenceId)
  }

  /** Money moved: refresh balances and the dashboard in the background */
  function refreshFinance() {
    const finance = useFinanceStore()
    void finance.fetchWallets()
    void finance.fetchStats()
  }

  async function confirm(occurrenceId: string, values: { amount: number; walletId: string; category: string; note: string }) {
    const occurrence = await httpClient.post<RoutineOccurrence>(occurrenceUrl(occurrenceId, 'confirm'), values)
    forget(occurrenceId)
    refreshFinance()
    return occurrence
  }

  async function skip(occurrenceId: string) {
    const occurrence = await httpClient.post<RoutineOccurrence>(occurrenceUrl(occurrenceId, 'skip'), {})
    forget(occurrenceId)
    refreshFinance()
    return occurrence
  }

  function reset() {
    routines.value = []
    pending.value = []
    queue.value = []
    fromNotification.value = false
    loaded.value = false
  }

  // Another account signed in (or signed out): drop everything cached for the previous one
  watch(() => useAuthStore().user?.id, reset)

  return {
    routines,
    pending,
    attention,
    loaded,
    queue,
    current,
    fromNotification,
    fetchRoutines,
    fetchInbox,
    getItem,
    create,
    update,
    remove,
    confirm,
    skip,
    reset
  }
})
