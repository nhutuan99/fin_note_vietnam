import { Env, RoutineData, RoutineRepeat, RoutineOccurrence, WalletData } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'
import {
  routinesKey,
  syncSlots,
  nextDueAt,
  refreshUserRoutines,
  loadOccurrences,
  saveOccurrences,
  applyLedger
} from '../services/routine.service'

const MAX_ROUTINES = 30

const withNext = (r: RoutineData, nowMs: number) => ({ ...r, nextDueAt: nextDueAt(r, nowMs) })

function parseRepeat(raw: any): RoutineRepeat | null {
  if (raw?.kind === 'daily') return { kind: 'daily' }
  if (raw?.kind === 'weekdays' && Array.isArray(raw.days)) {
    const days = [...new Set<number>(raw.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort()
    return days.length ? { kind: 'weekdays', days } : null
  }
  if (raw?.kind === 'monthly' && Number.isInteger(raw.day) && raw.day >= 1 && raw.day <= 31) return { kind: 'monthly', day: raw.day }
  return null
}

/** Validates the editable fields; returns an error message or the cleaned fields */
async function parseRoutineBody(userId: string, body: any, env: Env): Promise<string | Partial<RoutineData>> {
  const out: Partial<RoutineData> = {}
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return 'Tên routine không được trống'
    out.name = body.name.trim().substring(0, 60)
  }
  if (body.type !== undefined) {
    if (body.type !== 'income' && body.type !== 'expense') return 'Loại không hợp lệ'
    out.type = body.type
  }
  if (body.amount !== undefined) {
    if (typeof body.amount !== 'number' || !(body.amount > 0) || !isFinite(body.amount)) return 'Số tiền phải lớn hơn 0'
    out.amount = Math.round(body.amount)
  }
  if (body.category !== undefined) out.category = String(body.category).substring(0, 40)
  if (body.note !== undefined) out.note = String(body.note).substring(0, 200)
  if (body.walletId !== undefined) {
    const wallets = (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []
    if (!wallets.some((w) => w.id === body.walletId && w.kind !== 'gold')) return 'Ví không hợp lệ'
    out.walletId = body.walletId
  }
  if (body.repeat !== undefined) {
    const repeat = parseRepeat(body.repeat)
    if (!repeat) return 'Lịch lặp lại không hợp lệ'
    out.repeat = repeat
  }
  if (body.time !== undefined) {
    const m = typeof body.time === 'string' && body.time.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
    if (!m || Number(m[2]) % 15 !== 0) return 'Giờ nhắc phải theo bước 15 phút'
    out.time = body.time
  }
  if (body.tzOffset !== undefined) {
    if (!Number.isInteger(body.tzOffset) || Math.abs(body.tzOffset) > 14 * 60) return 'Múi giờ không hợp lệ'
    out.tzOffset = body.tzOffset
  }
  if (body.onMissed !== undefined) {
    if (body.onMissed !== 'record' && body.onMissed !== 'skip') return 'Tuỳ chọn không hợp lệ'
    out.onMissed = body.onMissed
  }
  if (body.enabled !== undefined) out.enabled = !!body.enabled
  if (body.pausedUntil !== undefined) {
    if (body.pausedUntil !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.pausedUntil)) return 'Ngày tạm dừng không hợp lệ'
    out.pausedUntil = body.pausedUntil ?? undefined
  }
  return out
}

export async function handleListRoutines(userId: string, env: Env): Promise<Response> {
  const routines = (await getJSON<RoutineData[]>(env.SMART_NOTE_KV, routinesKey(userId))) || []
  const now = Date.now()
  return jsonResponse({ success: true, data: routines.map((r) => withNext(r, now)) })
}

export async function handleCreateRoutine(userId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as any
  for (const field of ['name', 'type', 'amount', 'walletId', 'repeat', 'time', 'tzOffset']) {
    if (body[field] === undefined) return errorResponse(`Thiếu ${field}`)
  }
  const fields = await parseRoutineBody(userId, body, env)
  if (typeof fields === 'string') return errorResponse(fields)

  const routines = (await getJSON<RoutineData[]>(env.SMART_NOTE_KV, routinesKey(userId))) || []
  if (routines.length >= MAX_ROUTINES) return errorResponse(`Tối đa ${MAX_ROUTINES} routine`)

  const now = new Date().toISOString()
  // Required fields were checked above; the rest get defaults
  const routine = {
    id: generateId(),
    category: fields.type === 'income' ? 'other_income' : 'other_expense',
    note: '',
    onMissed: 'record',
    enabled: true,
    ...fields,
    activeFrom: now,
    createdAt: now,
    updatedAt: now
  } as RoutineData
  const next = [...routines, routine]
  await putJSON(env.SMART_NOTE_KV, routinesKey(userId), next)
  await syncSlots(env, userId, routines, next)
  return jsonResponse({ success: true, data: withNext(routine, Date.now()) }, 201)
}

export async function handleUpdateRoutine(userId: string, routineId: string, request: Request, env: Env): Promise<Response> {
  const routines = (await getJSON<RoutineData[]>(env.SMART_NOTE_KV, routinesKey(userId))) || []
  const idx = routines.findIndex((r) => r.id === routineId)
  if (idx === -1) return errorResponse('Routine not found', 404)

  const fields = await parseRoutineBody(userId, (await request.json()) as any, env)
  if (typeof fields === 'string') return errorResponse(fields)

  const before = routines[idx]
  const now = new Date().toISOString()
  const updated: RoutineData = { ...before, ...fields, updatedAt: now }
  // Turning a routine back on never back-fills the days it was off
  if (!before.enabled && updated.enabled) updated.activeFrom = now
  if (fields.pausedUntil === undefined && 'pausedUntil' in fields) delete updated.pausedUntil

  const next = routines.map((r, i) => (i === idx ? updated : r))
  await putJSON(env.SMART_NOTE_KV, routinesKey(userId), next)
  await syncSlots(env, userId, routines, next)
  return jsonResponse({ success: true, data: withNext(updated, Date.now()) })
}

export async function handleDeleteRoutine(userId: string, routineId: string, env: Env): Promise<Response> {
  const routines = (await getJSON<RoutineData[]>(env.SMART_NOTE_KV, routinesKey(userId))) || []
  const next = routines.filter((r) => r.id !== routineId)
  await putJSON(env.SMART_NOTE_KV, routinesKey(userId), next)
  await syncSlots(env, userId, routines, next)

  // Unanswered reminders of a deleted routine go away; recorded history stays
  const doc = await loadOccurrences(env, userId)
  const items = doc.items.filter((o) => !(o.routineId === routineId && o.status === 'pending'))
  if (items.length !== doc.items.length || doc.cursor[routineId]) {
    delete doc.cursor[routineId]
    await saveOccurrences(env, userId, { ...doc, items })
  }
  return jsonResponse({ success: true })
}

/**
 * What needs the user's attention: unanswered (remind-only) occurrences. Also the moment
 * occurrences are created/recorded when the user opens the app, so nothing depends on the
 * cron alone; `recorded` tells the app its balances just changed.
 */
export async function handleRoutineInbox(userId: string, env: Env): Promise<Response> {
  const now = Date.now()
  const { routines, doc, recorded } = await refreshUserRoutines(env, userId, now)
  const byDate = (a: RoutineOccurrence, b: RoutineOccurrence) => a.date.localeCompare(b.date)
  return jsonResponse({
    success: true,
    data: {
      pending: doc.items.filter((o) => o.status === 'pending').sort(byDate),
      recorded,
      routines: routines.map((r) => withNext(r, now))
    }
  })
}

/** Lookup for a notification link: any occurrence, whatever its state */
export async function handleGetOccurrence(userId: string, occurrenceId: string, env: Env): Promise<Response> {
  const { routines, doc } = await refreshUserRoutines(env, userId, Date.now())
  const occurrence = doc.items.find((o) => o.id === occurrenceId)
  if (!occurrence) return errorResponse('Occurrence not found', 404)
  const routine = routines.find((r) => r.id === occurrence.routineId)
  return jsonResponse({ success: true, data: { occurrence, routine: routine ?? null } })
}

/**
 * Confirm with (possibly edited) values. Works in every state: a pending one is recorded,
 * an auto-recorded / confirmed one has its transaction updated, a skipped one is recorded.
 */
export async function handleConfirmOccurrence(userId: string, occurrenceId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as any
  if (typeof body.amount !== 'number' || !(body.amount > 0) || !isFinite(body.amount)) {
    return errorResponse('Số tiền phải lớn hơn 0')
  }
  const { routines, doc } = await refreshUserRoutines(env, userId, Date.now())
  const o = doc.items.find((x) => x.id === occurrenceId)
  if (!o) return errorResponse('Occurrence not found', 404)
  const r = routines.find((x) => x.id === o.routineId)
  if (!r) return errorResponse('Routine not found', 404)

  if (typeof body.walletId === 'string' && body.walletId !== r.walletId) {
    const wallets = (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []
    if (!wallets.some((w) => w.id === body.walletId && w.kind !== 'gold')) return errorResponse('Ví không hợp lệ')
  }

  const values = {
    amount: Math.round(body.amount),
    walletId: typeof body.walletId === 'string' ? body.walletId : r.walletId,
    category: typeof body.category === 'string' ? body.category.substring(0, 40) : r.category,
    // Same as auto-recorded ones: no note → the routine's name
    note: (typeof body.note === 'string' && body.note.trim().substring(0, 200)) || r.note || r.name
  }

  if (o.txId && (o.status === 'auto' || o.status === 'confirmed')) {
    await applyLedger(env, userId, { update: [{ id: o.txId, patch: values }] })
  } else {
    const {
      created: [tx]
    } = await applyLedger(env, userId, {
      add: [{ type: r.type, source: 'routine', date: o.date, ...values }]
    })
    if (!tx) return errorResponse('Ví không còn tồn tại — chọn ví khác')
    o.txId = tx.id
  }
  // From here on the occurrence carries what was actually recorded
  Object.assign(o, { status: 'confirmed', amount: values.amount, resolvedAt: new Date().toISOString() })
  await saveOccurrences(env, userId, doc)
  return jsonResponse({ success: true, data: o })
}

/** Skip this time; an already recorded transaction is removed (undo) */
export async function handleSkipOccurrence(userId: string, occurrenceId: string, env: Env): Promise<Response> {
  const { doc } = await refreshUserRoutines(env, userId, Date.now())
  const o = doc.items.find((x) => x.id === occurrenceId)
  if (!o) return errorResponse('Occurrence not found', 404)
  if (o.txId) {
    await applyLedger(env, userId, { remove: [o.txId] })
    delete o.txId
  }
  Object.assign(o, { status: 'skipped', resolvedAt: new Date().toISOString() })
  await saveOccurrences(env, userId, doc)
  return jsonResponse({ success: true, data: o })
}
