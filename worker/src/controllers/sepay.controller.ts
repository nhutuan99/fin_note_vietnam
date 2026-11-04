import { Env, WalletData } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
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
 *
 * Wallets: each bank account number is mapped to one wallet and remembered. A new account is
 * matched to a wallet named after its bank (preferring one with the account's last 4 digits);
 * with no such wallet a new one is created — never a guess that would overwrite another
 * wallet's balance with this account's.
 */

interface SepayAccount {
  walletId: string
  bank: string
  events: number
  lastEventAt?: string
}

interface SepayIntegration {
  apiKey: string
  /** Secret from SePay when HMAC-SHA256 is used */
  hmacSecret?: string
  createdAt: string
  lastEventAt?: string
  events: number
  /** Recent SePay transaction ids: SePay retries/replays carry the same id */
  seenIds: string[]
  /** Bank account number (digits) → wallet */
  accounts?: Record<string, SepayAccount>
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

const normalizeAccount = (raw: unknown) => String(raw ?? '').replace(/\D/g, '').slice(0, 30)
const lettersOnly = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Wallet for a bank account: the remembered one if it still exists; otherwise a wallet named after
 * the bank (one with the last 4 digits first), or a new wallet. The choice is remembered.
 */
async function walletForAccount(env: Env, userId: string, integration: SepayIntegration, account: string, bank: string): Promise<string> {
  const walletsKey = `users/${userId}/finance/wallets`
  const wallets = (await getJSON<WalletData[]>(env.SMART_NOTE_KV, walletsKey)) || []
  const cash = wallets.filter((w) => w.kind !== 'gold')
  integration.accounts ??= {}

  const mapped = integration.accounts[account]
  if (mapped && cash.some((w) => w.id === mapped.walletId)) {
    // Mapped by hand before its first transaction: learn the bank name now
    if (!mapped.bank && bank) mapped.bank = bank
    return mapped.walletId
  }

  const last4 = account.slice(-4)
  const bankKey = lettersOnly(bank)
  const named = bankKey ? cash.filter((w) => lettersOnly(w.name).includes(bankKey)) : []
  let wallet = (last4 && named.find((w) => w.name.includes(last4))) || named[0]

  if (!wallet) {
    wallet = {
      id: generateId(),
      name: [bank || 'Ngân hàng', last4 && `•${last4}`].filter(Boolean).join(' '),
      balance: 0,
      currency: 'VND',
      icon: '🏦',
      color: '#0ea5e9',
      order: wallets.length
    }
    wallets.push(wallet)
    await putJSON(env.SMART_NOTE_KV, walletsKey, wallets)
  }

  integration.accounts[account] = { walletId: wallet.id, bank, events: mapped?.events ?? 0, lastEventAt: mapped?.lastEventAt }
  return wallet.id
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

  const account = normalizeAccount(payload.accountNumber) || 'unknown'
  const walletId = await walletForAccount(env, userId, integration, account, payload.gateway || '')

  await processSmsTransaction(parsed, parsed.rawText, userId, env, undefined, {
    source: 'bank',
    label: 'SePay',
    date: datePart(payload.transactionDate),
    walletId
  })

  const now = new Date().toISOString()
  integration.seenIds = [eventId, ...integration.seenIds].slice(0, MAX_SEEN)
  integration.lastEventAt = now
  integration.events = (integration.events || 0) + 1
  const acc = integration.accounts![account]
  acc.events += 1
  acc.lastEventAt = now
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
    events: integration?.events ?? 0,
    accounts: Object.entries(integration?.accounts ?? {}).map(([accountNumber, a]) => ({ accountNumber, ...a }))
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

/**
 * Map a bank account number to a wallet (also before its first transaction), or forget the
 * mapping with walletId: null so the next transaction is matched again.
 */
export async function handleSetSepayAccount(userId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { accountNumber?: string; walletId?: string | null; bank?: string }
  const account = normalizeAccount(body.accountNumber)
  if (account.length < 6) return errorResponse('Số tài khoản không hợp lệ')

  const integration = await getJSON<SepayIntegration>(env.SMART_NOTE_KV, integrationKey(userId))
  if (!integration) return errorResponse('Tạo khoá kết nối trước', 400)
  integration.accounts ??= {}

  if (body.walletId === null) {
    delete integration.accounts[account]
  } else {
    const wallets = (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []
    if (!wallets.some((w) => w.id === body.walletId && w.kind !== 'gold')) return errorResponse('Ví không hợp lệ')
    const current = integration.accounts[account]
    integration.accounts[account] = {
      walletId: body.walletId!,
      bank: current?.bank || (typeof body.bank === 'string' ? body.bank.substring(0, 30) : ''),
      events: current?.events ?? 0,
      lastEventAt: current?.lastEventAt
    }
  }
  await putJSON(env.SMART_NOTE_KV, integrationKey(userId), integration)
  return jsonResponse({ success: true, data: summary(userId, env, integration) })
}

export async function handleDeleteSepayIntegration(userId: string, env: Env): Promise<Response> {
  await env.SMART_NOTE_KV.delete(integrationKey(userId))
  return jsonResponse({ success: true, data: summary(userId, env, null) })
}
