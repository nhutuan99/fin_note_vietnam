import { Env, ReminderData } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'

// ====== Reminder Handlers ======

const OFFSET_MS: Record<string, number> = {
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '2h': 2 * 60 * 60_000,
  '3h': 3 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '2d': 2 * 24 * 60 * 60_000,
  '3d': 3 * 24 * 60 * 60_000,
  '1w': 7 * 24 * 60 * 60_000,
}

/** Calculate remindAt ISO strings from eventDate + offsets + optional custom datetime */
function calculateRemindAt(eventDate: string, offsets: string[], customRemindAt?: string): string[] {
  const eventMs = new Date(eventDate).getTime()
  if (isNaN(eventMs)) return []

  const results: string[] = []

  // Preset offsets
  for (const offset of offsets) {
    const ms = OFFSET_MS[offset]
    if (!ms) continue
    const fireTime = eventMs - ms
    if (fireTime > Date.now()) {
      results.push(new Date(fireTime).toISOString())
    }
  }

  // Custom user-defined datetime
  if (customRemindAt) {
    const customMs = new Date(customRemindAt).getTime()
    if (!isNaN(customMs) && customMs > Date.now()) {
      results.push(new Date(customMs).toISOString())
    }
  }

  // Deduplicate and sort
  return [...new Set(results)].sort()
}

const REPEAT_MS: Record<string, number> = {
  daily: 24 * 60 * 60_000,
  weekly: 7 * 24 * 60 * 60_000,
  monthly: 30 * 24 * 60 * 60_000,
}

/** Repeat step in ms: a preset, or a custom interval in minutes. 0 = not repeating */
function repeatStepMs(interval?: string): number {
  if (!interval || interval === 'none') return 0
  if (REPEAT_MS[interval]) return REPEAT_MS[interval]
  const minutes = parseInt(interval, 10)
  return minutes > 0 ? minutes * 60_000 : 0
}

/** Move a past recurring reminder to its next upcoming cycle (done on read — no cron) */
function advanceRecurring(r: ReminderData, step: number, now: number): void {
  const eventMs = new Date(r.eventDate).getTime()
  const shift = (Math.floor((now - eventMs) / step) + 1) * step
  r.eventDate = new Date(eventMs + shift).toISOString()
  if (r.customRemindAt) r.customRemindAt = new Date(new Date(r.customRemindAt).getTime() + shift).toISOString()
  r.remindAt = calculateRemindAt(r.eventDate, r.offsets, r.customRemindAt)
  r.notifiedAt = []
  r.acknowledged = false
  r.lastChanceSent = false
  r.updatedAt = new Date(now).toISOString()
}

export async function handleListReminders(userId: string, env: Env): Promise<Response> {
  const reminders = (await getJSON<ReminderData[]>(
    env.SMART_NOTE_KV, `users/${userId}/reminders`
  )) || []

  // Past reminders: recurring ones roll over to their next cycle, the rest expire
  const now = Date.now()
  let modified = false
  for (const r of reminders) {
    // `!(x < now)` also skips an unparsable date (NaN), as before
    if (r.status !== 'active' || !(new Date(r.eventDate).getTime() < now)) continue
    const step = repeatStepMs(r.repeatInterval)
    if (step) {
      advanceRecurring(r, step, now)
    } else {
      r.status = 'expired'
      r.updatedAt = new Date(now).toISOString()
    }
    modified = true
  }
  if (modified) {
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/reminders`, reminders)
  }

  // Sort: active first (by eventDate asc), then completed/expired
  reminders.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1
    if (a.status !== 'active' && b.status === 'active') return 1
    return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  })

  return jsonResponse({ success: true, data: reminders })
}

export async function handleCreateReminder(userId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as any
  const { title, description, eventDate, offsets, customRemindAt, repeatInterval, sourceType, sourceId, url } = body

  if (!title || !eventDate) {
    return errorResponse('Title and eventDate are required')
  }

  const validOffsets = (offsets || ['1h', '1d']).filter((o: string) => OFFSET_MS[o])
  const remindAt = calculateRemindAt(eventDate, validOffsets, customRemindAt)

  const now = new Date().toISOString()
  const reminder: ReminderData = {
    id: generateId(),
    title: title.trim(),
    description: (description || '').trim(),
    url: url ? url.trim() : undefined,
    eventDate,
    remindAt,
    offsets: validOffsets,
    customRemindAt: customRemindAt || undefined,
    repeatInterval: repeatInterval || 'none',
    notifiedAt: [],
    acknowledged: false,
    lastChanceSent: false,
    sourceType: sourceType || 'manual',
    sourceId: sourceId || undefined,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  const reminders = (await getJSON<ReminderData[]>(
    env.SMART_NOTE_KV, `users/${userId}/reminders`
  )) || []

  reminders.push(reminder)

  // Clean old expired/completed reminders (keep last 30 days only)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60_000
  const cleaned = reminders.filter(r =>
    r.status === 'active' || new Date(r.updatedAt).getTime() > thirtyDaysAgo
  )

  await putJSON(env.SMART_NOTE_KV, `users/${userId}/reminders`, cleaned)

  return jsonResponse({ success: true, data: reminder }, 201)
}

export async function handleUpdateReminder(
  userId: string, reminderId: string, request: Request, env: Env
): Promise<Response> {
  const reminders = (await getJSON<ReminderData[]>(
    env.SMART_NOTE_KV, `users/${userId}/reminders`
  )) || []

  const idx = reminders.findIndex(r => r.id === reminderId)
  if (idx === -1) return errorResponse('Reminder not found', 404)

  const body = (await request.json()) as any
  const existing = reminders[idx]

  if (body.title !== undefined) existing.title = body.title.trim()
  if (body.description !== undefined) existing.description = body.description.trim()
  if (body.url !== undefined) existing.url = body.url ? body.url.trim() : undefined
  if (body.eventDate !== undefined) existing.eventDate = body.eventDate
  if (body.offsets !== undefined) existing.offsets = body.offsets.filter((o: string) => OFFSET_MS[o])
  if (body.customRemindAt !== undefined) existing.customRemindAt = body.customRemindAt || undefined
  if (body.repeatInterval !== undefined) existing.repeatInterval = body.repeatInterval
  if (body.acknowledged !== undefined) existing.acknowledged = body.acknowledged

  // Recalculate remindAt when eventDate, offsets, or customRemindAt change
  if (body.eventDate !== undefined || body.offsets !== undefined || body.customRemindAt !== undefined) {
    existing.remindAt = calculateRemindAt(existing.eventDate, existing.offsets, existing.customRemindAt)
    existing.notifiedAt = []
    existing.lastChanceSent = false
  }

  if (body.status !== undefined) existing.status = body.status
  existing.updatedAt = new Date().toISOString()

  reminders[idx] = existing
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/reminders`, reminders)

  return jsonResponse({ success: true, data: existing })
}

export async function handleDeleteReminder(userId: string, reminderId: string, env: Env): Promise<Response> {
  const reminders = (await getJSON<ReminderData[]>(
    env.SMART_NOTE_KV, `users/${userId}/reminders`
  )) || []

  const filtered = reminders.filter(r => r.id !== reminderId)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/reminders`, filtered)

  return jsonResponse({ success: true })
}

export async function handleClearReminders(userId: string, request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status') || 'all'
  
  let reminders = (await getJSON<ReminderData[]>(
    env.SMART_NOTE_KV, `users/${userId}/reminders`
  )) || []

  if (statusFilter === 'all') {
    reminders = []
  } else if (statusFilter === 'completed') {
    reminders = reminders.filter(r => r.status !== 'completed' && r.status !== 'expired')
  } else if (statusFilter === 'active') {
    reminders = reminders.filter(r => r.status !== 'active')
  } else if (statusFilter === 'expired') {
    reminders = reminders.filter(r => r.status !== 'expired')
  }

  await putJSON(env.SMART_NOTE_KV, `users/${userId}/reminders`, reminders)

  return jsonResponse({ success: true })
}

export async function handleCompleteReminder(userId: string, reminderId: string, env: Env): Promise<Response> {
  const reminders = (await getJSON<ReminderData[]>(
    env.SMART_NOTE_KV, `users/${userId}/reminders`
  )) || []

  const idx = reminders.findIndex(r => r.id === reminderId)
  if (idx === -1) return errorResponse('Reminder not found', 404)

  reminders[idx].status = 'completed'
  reminders[idx].acknowledged = true
  reminders[idx].updatedAt = new Date().toISOString()

  await putJSON(env.SMART_NOTE_KV, `users/${userId}/reminders`, reminders)

  return jsonResponse({ success: true })
}

/**
 * Acknowledge a reminder (user has seen it — prevents last-chance noti).
 */
export async function handleAcknowledgeReminder(userId: string, reminderId: string, env: Env): Promise<Response> {
  const reminders = (await getJSON<ReminderData[]>(
    env.SMART_NOTE_KV, `users/${userId}/reminders`
  )) || []

  const idx = reminders.findIndex(r => r.id === reminderId)
  if (idx === -1) return errorResponse('Reminder not found', 404)

  reminders[idx].acknowledged = true
  reminders[idx].updatedAt = new Date().toISOString()
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/reminders`, reminders)

  return jsonResponse({ success: true })
}

/**
 * Strip markdown formatting to get clean plain text for AI processing.
 */
function stripMarkdown(text: string): string {
  return text
    // Extract URLs from markdown links [text](url) → text (url)
    .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '$1 $2')
    // Remove bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points but keep content
    .replace(/^\s*[-*+]\s+/gm, '• ')
    // Remove backticks
    .replace(/`([^`]+)`/g, '$1')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * AI Detection: Analyze text content for events/deadlines, return structured suggestions.
 */
export async function handleAiDetectReminders(userId: string, request: Request, env: Env): Promise<Response> {
  if (!env.AI) return errorResponse('AI binding not configured', 503)

  const body = (await request.json()) as any
  const { content } = body
  if (!content) return errorResponse('Content is required')

  // Pre-process: strip markdown + HTML to give AI clean text
  const cleanContent = stripMarkdown(content)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentDateISO = now.toISOString()

  const systemPrompt = `Bạn là AI chuyên trích xuất sự kiện, task, deadline từ văn bản.
Phân tích nội dung và trả về danh sách các sự kiện dưới dạng JSON ARRAY.

QUY TẮC BẮT BUỘC:
1. CHỈ trả về JSON ARRAY hợp lệ (tối đa 5 item). KHÔNG giải thích, KHÔNG thêm text bên ngoài.
2. Cấu trúc mỗi item: {"title": "string", "eventDate": "ISO 8601", "description": "string", "url": "string hoặc null"}
3. CÁCH PARSE NGÀY:
   - "13/5" → "${currentYear}-05-13T09:00:00.000Z"
   - "19/5" → "${currentYear}-05-19T09:00:00.000Z"  
   - "Build 1: 13/5" → eventDate = "${currentYear}-05-13T09:00:00.000Z"
   - Nếu có giờ cụ thể (VD: "3h chiều") → dùng giờ đó
   - Nếu KHÔNG có giờ → mặc định 09:00:00
4. "description": Giữ nguyên mô tả task/chi tiết từ văn bản gốc.
5. "url": Trích xuất mọi đường link https://... nếu có. Nếu không có url → null
6. Nếu KHÔNG tìm thấy sự kiện nào → trả về []

Thời gian hiện tại: ${currentDateISO}

VÍ DỤ:
Input: "Build 1: 13/5 - Task: Chuyển API monitor cho SCC - Link: https://jira.example.com/123"
Output: [{"title":"Build 1","eventDate":"${currentYear}-05-13T09:00:00.000Z","description":"Task: Chuyển API monitor cho SCC","url":"https://jira.example.com/123"}]

Input: "Họp team lúc 2h chiều ngày 20/5"
Output: [{"title":"Họp team","eventDate":"${currentYear}-05-20T07:00:00.000Z","description":"Họp team lúc 2h chiều ngày 20/5","url":null}]`

  try {
    const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: cleanContent.substring(0, 3000) }
      ],
      max_tokens: 1024,
      temperature: 0.1
    }) as any

    // Workers AI may return response as string, object, or array — always coerce to string
    const rawResponse = response?.response ?? response?.result ?? ''
    const text = String(typeof rawResponse === 'object' ? JSON.stringify(rawResponse) : rawResponse).trim()

    let events: any[] = []
    try {
      // Try parsing directly first (if AI returned pure JSON)
      const parsed = JSON.parse(text)
      events = Array.isArray(parsed) ? parsed : []
    } catch {
      // Fallback: extract JSON array from mixed text
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) events = JSON.parse(jsonMatch[0])
      } catch { events = [] }
    }

    // Post-process: validate and fix dates
    const validEvents = events
      .filter((e: any) => e?.title && e?.eventDate)
      .map((e: any) => {
        let eventDate = String(e.eventDate)
        // Fix common AI date mistakes - ensure valid ISO
        if (isNaN(new Date(eventDate).getTime())) {
          // Try to parse dd/M or d/M format from the date string
          const dateMatch = eventDate.match(/(\d{1,2})\/(\d{1,2})/)
          if (dateMatch) {
            const day = dateMatch[1].padStart(2, '0')
            const month = dateMatch[2].padStart(2, '0')
            eventDate = `${currentYear}-${month}-${day}T09:00:00.000Z`
          }
        }
        return {
          title: String(e.title).substring(0, 100),
          eventDate,
          description: String(e.description || '').substring(0, 300),
          url: e.url && e.url !== 'null' ? String(e.url).substring(0, 500) : undefined,
        }
      })
      .filter((e: any) => !isNaN(new Date(e.eventDate).getTime())) // final validation
      .slice(0, 5)

    return jsonResponse({ success: true, data: validEvents })
  } catch (err: any) {
    return errorResponse(err.message || 'AI detection failed', 500)
  }
}
