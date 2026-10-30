import { Env, SavingsGoalData } from '../types'
import { getJSON, putJSON } from './kv.service'
import { sendPushToUser } from '../controllers/push.controller'

const SAVINGS_KEY = (userId: string) => `users/${userId}/savings`
const USERS_INDEX_KEY = 'users/_index' // email -> userId

/** Convert a UTC Date to "HH:MM" string in Vietnam timezone (UTC+7) */
function toVnTime(date: Date): { hour: number; minute: number; dateStr: string } {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000
  const vnMs = date.getTime() + VN_OFFSET_MS
  const vnDate = new Date(vnMs)
  const hour = vnDate.getUTCHours()
  const minute = vnDate.getUTCMinutes()
  const dateStr = vnDate.toISOString().substring(0, 10) // YYYY-MM-DD in VN time
  return { hour, minute, dateStr }
}

export async function checkSavingsReminders(env: Env): Promise<string> {
  const usersIndex = (await getJSON<Record<string, string>>(env.SMART_NOTE_KV, USERS_INDEX_KEY)) || {}
  const userIds = [...new Set(Object.values(usersIndex))]
  if (userIds.length === 0) return '[SavingsReminder] No users registered'

  const now = new Date()
  const { hour: vnHour, dateStr: vnToday } = toVnTime(now)
  
  // Only send reminders around 9:00 AM VN time (between 9:00 and 9:15)
  if (vnHour !== 9) {
    return '[SavingsReminder] Not 9 AM VN time yet'
  }

  let sent = 0
  let skipped = 0

  for (const userId of userIds) {
    try {
      const savings = (await getJSON<SavingsGoalData[]>(env.SMART_NOTE_KV, SAVINGS_KEY(userId))) || []
      const activeAutoSaves = savings.filter(s => s.autoSaveEnabled && s.currentAmount < s.targetAmount)

      if (activeAutoSaves.length === 0) {
        skipped++
        continue
      }

      // We only send one notification per day summarizing the active auto saves
      // In a real app we'd track lastNotifiedDate per user for savings, but we can use KV
      const configKey = `users/${userId}/savings-config`
      const config = (await getJSON<any>(env.SMART_NOTE_KV, configKey)) || {}
      
      if (config.reminderNotifiedDate === vnToday) {
        skipped++
        continue
      }

      let totalAmount = 0
      activeAutoSaves.forEach(s => totalAmount += (s.autoSaveAmount || 0))

      if (totalAmount > 0) {
        await sendPushToUser(userId, env, {
          title: '🎯 Nhắc nhở tiết kiệm',
          body: `Đến lúc trích ${totalAmount.toLocaleString('vi-VN')}đ cho ${activeAutoSaves.length} mục tiêu tiết kiệm!`,
          tag: `savings-reminder-${vnToday}`,
          url: '/savings'
        })

        config.reminderNotifiedDate = vnToday
        await putJSON(env.SMART_NOTE_KV, configKey, config)
        sent++
      } else {
        skipped++
      }

    } catch (err) {
      console.error(`[SavingsReminder] Error processing user ${userId}:`, err)
    }
  }

  return `[SavingsReminder] Processed ${userIds.length} users — sent ${sent}, skipped ${skipped}`
}
