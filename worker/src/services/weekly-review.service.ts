import { Env, QuickAddPrefs, ReviewScheduleEntry } from '../types'
import { getJSON, putJSON } from './kv.service'
import { sendPushToUser } from '../controllers/push.controller'

/**
 * Weekly review reminder: on the days the user picked (each with its own time) the server
 * pushes a notification so they do a quick weekly overview instead of logging every day.
 *
 * Scheduling mirrors routines: each enabled (day, time) is indexed under a 15-minute UTC slot
 * (`weekly-review/slots/{HHmm}/{userId}`), so a cron run is a single `list` of the current
 * slot. The actual day-of-week match is checked at fire time against the user's local date.
 */

const SLOT_PREFIX = 'weekly-review/slots/'
const SLOT_MINUTES = 15

export const weeklyReviewPrefsKey = (userId: string) => `users/${userId}/quick_add`

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** "HHmm" of the 15-minute UTC slot the reminder fires in (local time − tzOffset) */
export function weeklyReviewSlot(time: string, tzOffset: number): string {
  const m = (((timeToMinutes(time) - tzOffset) % 1440) + 1440) % 1440
  const slot = m - (m % SLOT_MINUTES)
  return `${String(Math.floor(slot / 60)).padStart(2, '0')}${String(slot % 60).padStart(2, '0')}`
}

function slotsOf(schedule: ReviewScheduleEntry[], tzOffset: number): Set<string> {
  const slots = new Set<string>()
  for (const e of schedule) slots.add(weeklyReviewSlot(e.time, tzOffset))
  return slots
}

/** Keep the user's weekly-review slot keys in line with their prefs */
export async function syncWeeklyReviewSlots(
  env: Env,
  userId: string,
  before: QuickAddPrefs | null,
  after: QuickAddPrefs | null
) {
  const prev = before?.enabled ? slotsOf(before.reviewSchedule, before.tzOffset) : new Set<string>()
  const next = after?.enabled ? slotsOf(after.reviewSchedule, after.tzOffset) : new Set<string>()
  const ops: Promise<unknown>[] = []
  for (const slot of next) {
    if (!prev.has(slot)) ops.push(env.SMART_NOTE_KV.put(`${SLOT_PREFIX}${slot}/${userId}`, '1'))
  }
  for (const slot of prev) {
    if (!next.has(slot)) ops.push(env.SMART_NOTE_KV.delete(`${SLOT_PREFIX}${slot}/${userId}`))
  }
  await Promise.all(ops)
}

function localWeekday(nowMs: number, tzOffset: number): number {
  return new Date(nowMs + tzOffset * 60_000).getUTCDay()
}

function localDate(nowMs: number, tzOffset: number): string {
  return new Date(nowMs + tzOffset * 60_000).toISOString().slice(0, 10)
}

/** Cron entry: every user whose weekly reminder falls in the current 15-minute UTC slot */
export async function runWeeklyReviewSlot(env: Env, scheduledTime: number): Promise<string> {
  const d = new Date(scheduledTime)
  const minutes = d.getUTCMinutes() - (d.getUTCMinutes() % SLOT_MINUTES)
  const slot = `${String(d.getUTCHours()).padStart(2, '0')}${String(minutes).padStart(2, '0')}`
  const nowMs = Math.max(scheduledTime, Date.now())

  let cursor: string | undefined
  let users = 0
  do {
    const page: any = await env.SMART_NOTE_KV.list({ prefix: `${SLOT_PREFIX}${slot}/`, cursor })
    for (const key of page.keys) {
      const userId = key.name.slice(key.name.lastIndexOf('/') + 1)
      try {
        const prefs = await getJSON<QuickAddPrefs>(env.SMART_NOTE_KV, weeklyReviewPrefsKey(userId))
        if (!prefs?.enabled) continue
        const today = localDate(nowMs, prefs.tzOffset)
        if (prefs.reviewLastSent === today) continue
        const weekday = localWeekday(nowMs, prefs.tzOffset)
        const matched = prefs.reviewSchedule.some(
          (e) => e.day === weekday && weeklyReviewSlot(e.time, prefs.tzOffset) === slot
        )
        if (!matched) continue

        await sendPushToUser(userId, env, {
          title: 'Tổng kết tuần 📊',
          body: 'Dành 1 phút điểm lại thu chi tuần này nhé!',
          tag: `weekly-review-${today}`,
          url: '/?quick=1'
        })
        prefs.reviewLastSent = today
        await putJSON(env.SMART_NOTE_KV, weeklyReviewPrefsKey(userId), prefs)
        users++
      } catch (err) {
        console.error(`[WeeklyReview] user ${userId} failed:`, err)
      }
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return `[WeeklyReview] slot ${slot}: ${users} user(s)`
}
