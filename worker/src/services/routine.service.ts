import { Env, RoutineData, RoutineOccurrence, RoutineOccurrenceDoc, TransactionData, WalletData } from '../types'
import { getJSON, putJSON } from './kv.service'
import { generateId } from '../utils/crypto'
import { sendPushToUser } from '../controllers/push.controller'

/**
 * Routines: recurring money in/out the user sets up once.
 *
 * - At the routine's time a push asks the user to confirm (or change) the amount.
 * - Unanswered by the end of that day → recorded automatically (or just marked missed).
 *
 * Scheduling is cheap on KV: each enabled routine is indexed under a 15-minute UTC slot
 * (`routines/slots/{HHmm}/{userId}`, routine ids in the key's metadata), so a cron run is a
 * single `list` of the current slot. Occurrences are also materialised lazily whenever the
 * user opens the app, so recording never depends on the cron alone.
 */

export const routinesKey = (userId: string) => `users/${userId}/routines`
const occurrencesKey = (userId: string) => `users/${userId}/routine_occurrences`
const SLOT_PREFIX = 'routines/slots/'

const SLOT_MINUTES = 15
const MAX_BACKFILL_DAYS = 31
/** Resolved occurrences kept for history (pending ones are always kept) */
const KEEP_RESOLVED = 120
/** Only occurrences that became due this recently get a push (not back-filled ones) */
const PUSH_FRESH_MS = 30 * 60 * 1000

const DAY_MS = 86_400_000

// ── Dates (all local to the routine's saved UTC offset) ──

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function localDate(ms: number, tzOffset: number): string {
  return new Date(ms + tzOffset * 60_000).toISOString().slice(0, 10)
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** UTC instant of the routine's reminder on a local date */
function dueAt(r: RoutineData, date: string): number {
  return Date.parse(`${date}T00:00:00Z`) + (timeToMinutes(r.time) - r.tzOffset) * 60_000
}

/** End of the local day (= start of the next one) */
function deadlineOf(r: RoutineData, date: string): number {
  return Date.parse(`${addDays(date, 1)}T00:00:00Z`) - r.tzOffset * 60_000
}

export function occursOn(r: RoutineData, date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`)
  if (r.repeat.kind === 'daily') return true
  if (r.repeat.kind === 'weekdays') return r.repeat.days.includes(d.getUTCDay())
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  return d.getUTCDate() === Math.min(r.repeat.day, lastDay)
}

/** "HHmm" of the 15-minute UTC slot the routine fires in */
export function utcSlot(r: RoutineData): string {
  const m = (((timeToMinutes(r.time) - r.tzOffset) % 1440) + 1440) % 1440
  const slot = m - (m % SLOT_MINUTES)
  return `${String(Math.floor(slot / 60)).padStart(2, '0')}${String(slot % 60).padStart(2, '0')}`
}

/** Next reminder instant (for the UI); null when disabled */
export function nextDueAt(r: RoutineData, nowMs: number): string | null {
  if (!r.enabled) return null
  let date = localDate(Math.max(nowMs, Date.parse(r.activeFrom)), r.tzOffset)
  if (r.pausedUntil && date < r.pausedUntil) date = r.pausedUntil
  for (let i = 0; i < 400; i++, date = addDays(date, 1)) {
    if (occursOn(r, date) && dueAt(r, date) >= nowMs) return new Date(dueAt(r, date)).toISOString()
  }
  return null
}

// ── Slot index ──

function slotsOf(routines: RoutineData[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const r of routines) {
    if (!r.enabled) continue
    const slot = utcSlot(r)
    map.set(slot, [...(map.get(slot) ?? []), r.id])
  }
  return map
}

/** Keep the user's slot keys in line with their routines (only changed keys are written) */
export async function syncSlots(env: Env, userId: string, before: RoutineData[], after: RoutineData[]) {
  const prev = slotsOf(before)
  const next = slotsOf(after)
  const ops: Promise<unknown>[] = []
  for (const [slot, ids] of next) {
    if (prev.get(slot)?.join() === ids.join()) continue
    ops.push(env.SMART_NOTE_KV.put(`${SLOT_PREFIX}${slot}/${userId}`, '1', { metadata: { ids } }))
  }
  for (const slot of prev.keys()) {
    if (!next.has(slot)) ops.push(env.SMART_NOTE_KV.delete(`${SLOT_PREFIX}${slot}/${userId}`))
  }
  await Promise.all(ops)
}

// ── Ledger: transactions + wallet balances, read and written once per batch ──

export interface LedgerOps {
  add?: Omit<TransactionData, 'id' | 'createdAt'>[]
  update?: { id: string; patch: Partial<Pick<TransactionData, 'amount' | 'walletId' | 'category' | 'note'>> }[]
  remove?: string[]
}

const signed = (t: Pick<TransactionData, 'type' | 'amount'>) => (t.type === 'income' ? t.amount : -t.amount)

/**
 * Applies the operations; returns the created transactions in the order of `ops.add`
 * (null for one whose wallet is gone or isn't a money wallet).
 */
export async function applyLedger(env: Env, userId: string, ops: LedgerOps): Promise<(TransactionData | null)[]> {
  const txKey = `users/${userId}/finance/transactions`
  const walletKey = `users/${userId}/finance/wallets`
  const [txs, wallets] = await Promise.all([
    getJSON<TransactionData[]>(env.SMART_NOTE_KV, txKey).then((v) => v || []),
    getJSON<WalletData[]>(env.SMART_NOTE_KV, walletKey).then((v) => v || [])
  ])
  const wallet = (id: string) => wallets.find((w) => w.id === id && w.kind !== 'gold')
  const adjust = (walletId: string, delta: number) => {
    const w = wallet(walletId)
    if (w) w.balance += delta
  }

  const created = (ops.add ?? []).map((input) => {
    if (!wallet(input.walletId)) return null
    const tx: TransactionData = { ...input, id: generateId(), createdAt: new Date().toISOString() }
    txs.push(tx)
    adjust(tx.walletId, signed(tx))
    return tx
  })

  for (const { id, patch } of ops.update ?? []) {
    const tx = txs.find((t) => t.id === id)
    if (!tx) continue
    adjust(tx.walletId, -signed(tx))
    Object.assign(tx, patch)
    adjust(tx.walletId, signed(tx))
  }

  for (const id of ops.remove ?? []) {
    const i = txs.findIndex((t) => t.id === id)
    if (i === -1) continue
    adjust(txs[i].walletId, -signed(txs[i]))
    txs.splice(i, 1)
  }

  await Promise.all([putJSON(env.SMART_NOTE_KV, txKey, txs), putJSON(env.SMART_NOTE_KV, walletKey, wallets)])
  return created
}

// ── Occurrences ──

function activeFromDate(r: RoutineData): string {
  // First local date whose reminder is at/after the moment the routine became active
  const from = Date.parse(r.activeFrom)
  const date = localDate(from, r.tzOffset)
  return dueAt(r, date) >= from ? date : addDays(date, 1)
}

/** Creates the occurrences that have become due since the last run (idempotent) */
function materialise(routines: RoutineData[], doc: RoutineOccurrenceDoc, nowMs: number): RoutineOccurrence[] {
  const created: RoutineOccurrence[] = []
  const known = new Set(doc.items.map((o) => o.id))
  for (const r of routines) {
    if (!r.enabled) continue
    const today = localDate(nowMs, r.tzOffset)
    const cursor = doc.cursor[r.id]
    let date = [cursor ? addDays(cursor, 1) : '', activeFromDate(r), addDays(today, -MAX_BACKFILL_DAYS)].sort().pop()!
    let last = cursor
    for (; date <= today && dueAt(r, date) <= nowMs; date = addDays(date, 1)) {
      last = date
      if (r.pausedUntil && date < r.pausedUntil) continue
      if (!occursOn(r, date)) continue
      const id = `${r.id}:${date}`
      if (known.has(id)) continue
      const occurrence: RoutineOccurrence = {
        id,
        routineId: r.id,
        date,
        status: 'pending',
        amount: r.amount,
        deadline: new Date(deadlineOf(r, date)).toISOString(),
        createdAt: new Date(nowMs).toISOString()
      }
      doc.items.push(occurrence)
      created.push(occurrence)
    }
    if (last) doc.cursor[r.id] = last
  }
  return created
}

function transactionFor(r: RoutineData, o: RoutineOccurrence, amount = o.amount): Omit<TransactionData, 'id' | 'createdAt'> {
  return {
    type: r.type,
    amount,
    category: r.category,
    note: r.note || r.name,
    walletId: r.walletId,
    source: 'routine',
    date: o.date
  }
}

/** Unanswered occurrences past their deadline: record them (or mark missed) */
async function settleOverdue(env: Env, userId: string, routines: RoutineData[], doc: RoutineOccurrenceDoc, nowMs: number) {
  const overdue = doc.items.filter((o) => o.status === 'pending' && Date.parse(o.deadline) <= nowMs)
  if (!overdue.length) return false
  const toRecord: { o: RoutineOccurrence; r: RoutineData }[] = []
  for (const o of overdue) {
    const r = routines.find((x) => x.id === o.routineId)
    if (r?.onMissed === 'record') toRecord.push({ o, r })
    else Object.assign(o, { status: 'missed', resolvedAt: new Date(nowMs).toISOString() })
  }
  if (toRecord.length) {
    const txs = await applyLedger(env, userId, { add: toRecord.map(({ o, r }) => transactionFor(r, o)) })
    toRecord.forEach(({ o }, i) => {
      const tx = txs[i]
      Object.assign(o, tx
        ? { status: 'auto', txId: tx.id, acknowledged: false, resolvedAt: new Date(nowMs).toISOString() }
        : { status: 'missed', resolvedAt: new Date(nowMs).toISOString() })
    })
  }
  return true
}

function prune(doc: RoutineOccurrenceDoc, routines: RoutineData[]) {
  const alive = new Set(routines.map((r) => r.id))
  for (const id of Object.keys(doc.cursor)) if (!alive.has(id)) delete doc.cursor[id]
  const pending = doc.items.filter((o) => o.status === 'pending')
  const resolved = doc.items
    .filter((o) => o.status !== 'pending')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, KEEP_RESOLVED)
  doc.items = [...pending, ...resolved]
}

export async function loadOccurrences(env: Env, userId: string): Promise<RoutineOccurrenceDoc> {
  return (await getJSON<RoutineOccurrenceDoc>(env.SMART_NOTE_KV, occurrencesKey(userId))) || { cursor: {}, items: [] }
}

export async function saveOccurrences(env: Env, userId: string, doc: RoutineOccurrenceDoc) {
  await putJSON(env.SMART_NOTE_KV, occurrencesKey(userId), doc)
}

/**
 * Brings a user's occurrences up to date: create what became due, settle what expired.
 * With `push`, freshly due occurrences are announced to the user's devices.
 */
export async function refreshUserRoutines(env: Env, userId: string, nowMs: number, push = false) {
  const routines = (await getJSON<RoutineData[]>(env.SMART_NOTE_KV, routinesKey(userId))) || []
  const doc = await loadOccurrences(env, userId)
  const created = materialise(routines, doc, nowMs)
  const settled = await settleOverdue(env, userId, routines, doc, nowMs)
  if (created.length || settled) {
    prune(doc, routines)
    await saveOccurrences(env, userId, doc)
  }

  if (push) {
    for (const o of created) {
      const r = routines.find((x) => x.id === o.routineId)
      if (!r || nowMs - dueAt(r, o.date) > PUSH_FRESH_MS || o.status !== 'pending') continue
      const money = `${r.type === 'expense' ? '−' : '+'}${new Intl.NumberFormat('vi-VN').format(o.amount)}đ`
      await sendPushToUser(userId, env, {
        title: `${r.name} · ${money}`,
        body: r.onMissed === 'record'
          ? 'Chạm để xác nhận hoặc sửa số tiền. Không phản hồi thì tự ghi lúc hết ngày.'
          : 'Chạm để ghi lại khoản này.',
        tag: o.id,
        url: `/?routine=${encodeURIComponent(o.id)}`
      })
    }
  }

  return { routines, doc }
}

/** Cron entry: every user with a routine in the current 15-minute slot */
export async function runRoutineSlot(env: Env, scheduledTime: number): Promise<string> {
  const d = new Date(scheduledTime)
  const minutes = d.getUTCMinutes() - (d.getUTCMinutes() % SLOT_MINUTES)
  const slot = `${String(d.getUTCHours()).padStart(2, '0')}${String(minutes).padStart(2, '0')}`
  // The slot's due time; a run that starts a little late still counts as on time
  const nowMs = Math.max(scheduledTime, Date.now())

  let cursor: string | undefined
  let users = 0
  do {
    const page: any = await env.SMART_NOTE_KV.list({ prefix: `${SLOT_PREFIX}${slot}/`, cursor })
    for (const key of page.keys) {
      const userId = key.name.slice(key.name.lastIndexOf('/') + 1)
      try {
        await refreshUserRoutines(env, userId, nowMs, true)
        users++
      } catch (err) {
        console.error(`[Routines] user ${userId} failed:`, err)
      }
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return `[Routines] slot ${slot}: ${users} user(s)`
}
