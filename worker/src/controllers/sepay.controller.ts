import { Env } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { getJSON, putJSON } from '../services/kv.service'
import { processSmsTransaction, type SmsParsedResult } from './notification.controller'

/**
 * SePay bank sync: SePay watches a linked bank account (e.g. TPBank) and POSTs every
 * money-in / money-out to /api/webhook/sepay?userId=… — recorded like a bank SMS, with the
 * wallet balance set to the bank's own balance after the transaction.
 *
 * Auth (either, per the SePay webhook "Security" step):
 * - API Key: FinNote generates the key, the user pastes it into SePay → `Authorization: Apikey <key>`
 * - HMAC-SHA256: SePay generates the secret, the user pastes it into FinNote →
 *   `X-SePay-Signature: sha256=<hex of HMAC(secret, "{timestamp}.{raw body}")>` + `X-SePay-Timestamp`
 */

interface SepayIntegration {
  apiKey: string
  /** Secret from SePay when HMAC-SHA256 is used */
  hmacSecret?: string
  createdAt: string
  lastEventAt?: string
  events: number
  /** Recent SePay transaction ids: SePay retries/replays carry the same id */
  seenIds: string[]
}

interface SepayPayload {
  id: number | string
  gateway?: string
  transactionDate?: string
  accountNumber?: string
  content?: string
  transferType?: 'in' | 'out'
  description?: string
  transferAmount?: number
  accumulated?: number
  referenceCode?: string
}

const integrationKey = (userId: string) => `users/${userId}/integrations/sepay`
const MAX_SEEN = 300
const MAX_SIGNATURE_AGE_S = 300

function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthorized(request: Request, rawBody: string, integration: SepayIntegration): Promise<boolean> {
  const auth = request.headers.get('Authorization') || ''
  if (auth.startsWith('Apikey ')) return safeEqual(auth.slice(7).trim(), integration.apiKey)

  const signature = request.headers.get('X-SePay-Signature') || ''
  const timestamp = request.headers.get('X-SePay-Timestamp') || ''
  if (!integration.hmacSecret || !signature.startsWith('sha256=') || !/^\d+$/.test(timestamp)) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SIGNATURE_AGE_S) return false
  const expected = await hmacHex(integration.hmacSecret, `${timestamp}.${rawBody}`)
  return safeEqual(signature.slice(7).toLowerCase(), expected)
}

/** "2024-07-02 11:08:33" → "2024-07-02" (bank local date) */
function datePart(transactionDate?: string): string | undefined {
  const m = transactionDate?.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : undefined
}

export async function handleSepayWebhook(request: Request, env: Env): Promise<Response> {
  const userId = new URL(request.url).searchParams.get('userId')
  if (!userId) return errorResponse('Missing userId query param', 400)

  const integration = await getJSON<SepayIntegration>(env.SMART_NOTE_KV, integrationKey(userId))
  if (!integration) return errorResponse('SePay is not connected for this user', 401)

  const rawBody = await request.text()
  if (!(await isAuthorized(request, rawBody, integration))) return errorResponse('Unauthorized', 401)

  let payload: SepayPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const amount = Number(payload.transferAmount)
  if (payload.id === undefined || (payload.transferType !== 'in' && payload.transferType !== 'out') || !(amount > 0)) {
    return errorResponse('Invalid SePay transaction', 400)
  }

  // SePay expects exactly {"success": true}; a retry of something already recorded is acknowledged as-is
  const eventId = String(payload.id)
  if (integration.seenIds.includes(eventId)) return jsonResponse({ success: true })

  const note = (payload.content || payload.description || '').trim()
  const parsed: SmsParsedResult = {
    type: payload.transferType === 'in' ? 'income' : 'expense',
    amount,
    note: note.substring(0, 200),
    txRef: payload.referenceCode || `sepay-${eventId}`,
    account: payload.accountNumber || '',
    // The bank's balance after this transaction: the wallet is set to it exactly
    balance: typeof payload.accumulated === 'number' && payload.accumulated > 0 ? payload.accumulated : 0,
    bankName: payload.gateway || '',
    rawText: (payload.description || note).substring(0, 200)
  }

  await processSmsTransaction(parsed, parsed.rawText, userId, env, undefined, {
    source: 'bank',
    label: 'SePay',
    date: datePart(payload.transactionDate)
  })

  integration.seenIds = [eventId, ...integration.seenIds].slice(0, MAX_SEEN)
  integration.lastEventAt = new Date().toISOString()
  integration.events = (integration.events || 0) + 1
  await putJSON(env.SMART_NOTE_KV, integrationKey(userId), integration)

  return jsonResponse({ success: true })
}

// ── Settings (signed-in user) ──

function webhookUrl(userId: string, env: Env) {
  return `${env.API_URL || 'https://smart-note-api.smart-note.workers.dev'}/api/webhook/sepay?userId=${userId}`
}

function summary(userId: string, env: Env, integration: SepayIntegration | null) {
  return {
    connected: !!integration,
    webhookUrl: webhookUrl(userId, env),
    keyHint: integration ? `…${integration.apiKey.slice(-4)}` : null,
    hasHmacSecret: !!integration?.hmacSecret,
    lastEventAt: integration?.lastEventAt ?? null,
    events: integration?.events ?? 0
  }
}

export async function handleGetSepayIntegration(userId: string, env: Env): Promise<Response> {
  const integration = await getJSON<SepayIntegration>(env.SMART_NOTE_KV, integrationKey(userId))
  return jsonResponse({ success: true, data: summary(userId, env, integration) })
}

/** New API key (shown in full only in this response); keeps history and any HMAC secret */
export async function handleCreateSepayKey(userId: string, env: Env): Promise<Response> {
  const existing = await getJSON<SepayIntegration>(env.SMART_NOTE_KV, integrationKey(userId))
  const integration: SepayIntegration = {
    seenIds: [],
    events: 0,
    ...existing,
    apiKey: randomKey(),
    createdAt: existing?.createdAt ?? new Date().toISOString()
  }
  await putJSON(env.SMART_NOTE_KV, integrationKey(userId), integration)
  return jsonResponse({ success: true, data: { ...summary(userId, env, integration), apiKey: integration.apiKey } })
}

/** Save (or clear with an empty string) the HMAC-SHA256 secret copied from SePay */
export async function handleSetSepaySecret(userId: string, request: Request, env: Env): Promise<Response> {
  const { secret } = (await request.json()) as { secret?: string }
  const integration = await getJSON<SepayIntegration>(env.SMART_NOTE_KV, integrationKey(userId))
  if (!integration) return errorResponse('Tạo khoá kết nối trước', 400)
  const value = typeof secret === 'string' ? secret.trim() : ''
  if (value.length > 200) return errorResponse('Secret không hợp lệ')
  integration.hmacSecret = value || undefined
  await putJSON(env.SMART_NOTE_KV, integrationKey(userId), integration)
  return jsonResponse({ success: true, data: summary(userId, env, integration) })
}

export async function handleDeleteSepayIntegration(userId: string, env: Env): Promise<Response> {
  await env.SMART_NOTE_KV.delete(integrationKey(userId))
  return jsonResponse({ success: true, data: summary(userId, env, null) })
}
