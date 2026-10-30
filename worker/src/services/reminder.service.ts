/**
 * Reminder Service
 * Checks all users' reminders and sends push notifications when due.
 * Features:
 * - Standard offset-based reminders
 * - Custom user-defined reminder times
 * - Auto "last chance" notification 1h before deadline if user hasn't acknowledged
 * - Recurring reminders (daily/weekly/monthly)
 *
 * Called by Cloudflare Cron Trigger every 15 minutes.
 */

import { Env, ReminderData } from '../types'
import { getJSON, putJSON } from './kv.service'
import { sendPushToUser } from '../controllers/push.controller'

const REMINDER_USERS_KEY = 'public/reminder-users'

const REPEAT_MS: Record<string, number> = {
  daily: 24 * 60 * 60_000,
  weekly: 7 * 24 * 60 * 60_000,
  monthly: 30 * 24 * 60 * 60_000,
}

export async function registerReminderUser(userId: string, env: Env): Promise<void> {
  const users = (await getJSON<string[]>(env.SMART_NOTE_KV, REMINDER_USERS_KEY)) || []
  if (!users.includes(userId)) {
    users.push(userId)
    await putJSON(env.SMART_NOTE_KV, REMINDER_USERS_KEY, users)
  }
}

export async function unregisterReminderUserIfEmpty(userId: string, env: Env): Promise<void> {
  const reminders = (await getJSON<ReminderData[]>(env.SMART_NOTE_KV, `users/${userId}/reminders`)) || []
  const hasActive = reminders.some(r => r.status === 'active')
  if (!hasActive) {
    const users = (await getJSON<string[]>(env.SMART_NOTE_KV, REMINDER_USERS_KEY)) || []
    const filtered = users.filter(u => u !== userId)
    await putJSON(env.SMART_NOTE_KV, REMINDER_USERS_KEY, filtered)
  }
}

function formatCountdown(eventDate: string): string {
  const diff = new Date(eventDate).getTime() - Date.now()
  if (diff <= 0) return 'Đã đến hạn!'
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `Còn ${days} ngày`
  if (hours > 0) return `Còn ${hours} giờ`
  return `Còn ${minutes} phút`
}

/**
 * Advance a recurring reminder to the next cycle.
 */
function advanceRecurring(reminder: ReminderData): void {
  const interval = reminder.repeatInterval
  if (!interval || interval === 'none') return

  const eventMs = new Date(reminder.eventDate).getTime()
  let nextMs = eventMs

  if (REPEAT_MS[interval]) {
    nextMs = eventMs + REPEAT_MS[interval]
  } else {
    // Custom interval in minutes
    const customMinutes = parseInt(interval, 10)
    if (!isNaN(customMinutes) && customMinutes > 0) {
      nextMs = eventMs + customMinutes * 60_000
    } else {
      return // Invalid interval
    }
  }

  // Update reminder for next cycle
  reminder.eventDate = new Date(nextMs).toISOString()
  reminder.notifiedAt = []
  reminder.acknowledged = false
  reminder.lastChanceSent = false

  // Recalculate remindAt for next cycle
  const OFFSET_MS: Record<string, number> = {
    '15m': 15 * 60_000, '30m': 30 * 60_000,
    '1h': 60 * 60_000, '2h': 2 * 60 * 60_000, '3h': 3 * 60 * 60_000,
    '1d': 24 * 60 * 60_000, '2d': 2 * 24 * 60 * 60_000,
    '3d': 3 * 24 * 60 * 60_000, '1w': 7 * 24 * 60 * 60_000,
  }

  const results: string[] = []
  for (const offset of reminder.offsets) {
    const ms = OFFSET_MS[offset]
    if (ms) {
      const fireTime = nextMs - ms
      if (fireTime > Date.now()) results.push(new Date(fireTime).toISOString())
    }
  }
  if (reminder.customRemindAt) {
    // Shift custom reminder by the same interval
    const customMs = new Date(reminder.customRemindAt).getTime()
    const newCustomMs = customMs + (nextMs - eventMs)
    if (newCustomMs > Date.now()) {
      reminder.customRemindAt = new Date(newCustomMs).toISOString()
      results.push(reminder.customRemindAt)
    }
  }
  reminder.remindAt = [...new Set(results)].sort()
  reminder.updatedAt = new Date().toISOString()
}

/**
 * Main cron entry point — check all users' reminders.
 */
export async function checkAllReminders(env: Env): Promise<string> {
  const userIds = (await getJSON<string[]>(env.SMART_NOTE_KV, REMINDER_USERS_KEY)) || []
  if (userIds.length === 0) return 'No users with reminders'

  const now = Date.now()
  const ONE_HOUR = 60 * 60_000
  let totalNotified = 0
  let totalExpired = 0

  for (const userId of userIds) {
    try {
      const reminders = (await getJSON<ReminderData[]>(env.SMART_NOTE_KV, `users/${userId}/reminders`)) || []
      let modified = false

      for (const reminder of reminders) {
        if (reminder.status !== 'active') continue

        const eventMs = new Date(reminder.eventDate).getTime()

        // ── 1. Check standard remindAt times ──
        for (const fireTime of reminder.remindAt) {
          const fireMs = new Date(fireTime).getTime()
          if (fireMs <= now && !reminder.notifiedAt.includes(fireTime)) {
            reminder.notifiedAt.push(fireTime)
            modified = true
            totalNotified++

            const countdown = formatCountdown(reminder.eventDate)
            await sendPushToUser(userId, env, {
              title: `🔔 ${reminder.title}`,
              body: `${countdown} — ${reminder.description || 'Đến giờ nhắc nhở!'}`,
              tag: `reminder-${reminder.id}-${fireTime}`,
              url: '/reminders',
              data: { type: 'reminder', reminderId: reminder.id }
            })
          }
        }

        // ── 2. Last-chance notification: 1h before deadline ──
        // If user hasn't acknowledged and we haven't sent last-chance yet
        if (!reminder.acknowledged && !reminder.lastChanceSent) {
          const timeUntilEvent = eventMs - now
          // Fire when <= 1 hour remaining (but event hasn't passed yet)
          if (timeUntilEvent > 0 && timeUntilEvent <= ONE_HOUR) {
            reminder.lastChanceSent = true
            modified = true
            totalNotified++

            await sendPushToUser(userId, env, {
              title: `🚨 LẦN CUỐI: ${reminder.title}`,
              body: `⏰ Còn chưa đầy 1 giờ! ${reminder.description || 'Hãy kiểm tra ngay!'}`,
              tag: `reminder-lastchance-${reminder.id}`,
              url: '/reminders',
              data: { type: 'reminder_lastchance', reminderId: reminder.id }
            })
          }
        }

        // ── 3. Handle expiration or recurring advancement ──
        if (eventMs < now) {
          if (reminder.repeatInterval && reminder.repeatInterval !== 'none') {
            // Advance to next cycle
            advanceRecurring(reminder)
            modified = true
          } else {
            reminder.status = 'expired'
            reminder.updatedAt = new Date().toISOString()
            modified = true
            totalExpired++
          }
        }
      }

      if (modified) {
        await putJSON(env.SMART_NOTE_KV, `users/${userId}/reminders`, reminders)
      }

      // Clean up registry
      const hasActive = reminders.some(r => r.status === 'active')
      if (!hasActive) {
        const users = (await getJSON<string[]>(env.SMART_NOTE_KV, REMINDER_USERS_KEY)) || []
        await putJSON(env.SMART_NOTE_KV, REMINDER_USERS_KEY, users.filter(u => u !== userId))
      }
    } catch (err) {
      console.error(`[Reminder] Error checking user ${userId}:`, err)
    }
  }

  return `Checked ${userIds.length} users, sent ${totalNotified} notifications, expired ${totalExpired} reminders`
}
