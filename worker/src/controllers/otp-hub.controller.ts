import { Env, UserData, OtpCodeData, OtpHubSettings, OtpHubSubscriber } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'
import { buildPushPayload } from '@block65/webcrypto-web-push'

const ADMIN_EMAIL = 'tintphcm@gmail.com'

// KV keys
const KV_OTP_CODES = 'otp_hub/codes'
const KV_OTP_SUBSCRIBERS = 'otp_hub/subscribers'
const KV_OTP_SETTINGS = 'otp_hub/settings'

const DEFAULT_SETTINGS: OtpHubSettings = {
  defaultExpiryMinutes: 15,
  updatedAt: new Date().toISOString()
}

// ── Helpers ──

async function isAdmin(userId: string, env: Env): Promise<boolean> {
  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  return user?.email === ADMIN_EMAIL
}

// ====== Public Endpoints ======

/**
 * GET /api/otp-hub — List active OTP codes (public, no auth)
 * Returns only non-expired codes, sorted by newest first. Max 5.
 */
export async function handleListOtpCodes(env: Env): Promise<Response> {
  const codes = (await getJSON<OtpCodeData[]>(env.SMART_NOTE_KV, KV_OTP_CODES)) || []
  const now = new Date().toISOString()

  // Filter out expired codes and return newest first
  const active = codes
    .filter(c => c.expiresAt > now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  return jsonResponse({ success: true, data: active })
}

/**
 * POST /api/otp-hub/subscribe — Subscribe to OTP push notifications (anonymous)
 */
export async function handleOtpSubscribe(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as any
  const { endpoint, keys } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return errorResponse('Invalid push subscription data')
  }

  const subs = (await getJSON<OtpHubSubscriber[]>(env.SMART_NOTE_KV, KV_OTP_SUBSCRIBERS)) || []

  // Avoid duplicates
  const exists = subs.some(s => s.endpoint === endpoint)
  if (!exists) {
    subs.push({
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      createdAt: new Date().toISOString()
    })
    await putJSON(env.SMART_NOTE_KV, KV_OTP_SUBSCRIBERS, subs)
  }

  return jsonResponse({ success: true, message: 'Subscribed to OTP notifications' })
}

/**
 * POST /api/otp-hub/unsubscribe — Unsubscribe from OTP push notifications
 */
export async function handleOtpUnsubscribe(request: Request, env: Env): Promise<Response> {
  const { endpoint } = (await request.json()) as any
  if (!endpoint) return errorResponse('Endpoint is required')

  const subs = (await getJSON<OtpHubSubscriber[]>(env.SMART_NOTE_KV, KV_OTP_SUBSCRIBERS)) || []
  const filtered = subs.filter(s => s.endpoint !== endpoint)
  await putJSON(env.SMART_NOTE_KV, KV_OTP_SUBSCRIBERS, filtered)

  return jsonResponse({ success: true, message: 'Unsubscribed from OTP notifications' })
}

// ====== Admin Endpoints ======

/**
 * POST /api/otp-hub — Create a new OTP code and push to all subscribers (admin only)
 */
export async function handleCreateOtpCode(userId: string, request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) {
    return errorResponse('Forbidden', 403)
  }

  const body = (await request.json()) as any
  const { service, serviceName, code, expiryMinutes } = body

  if (!service || !code) {
    return errorResponse('Service and code are required')
  }

  // Get settings for default expiry
  const settings = (await getJSON<OtpHubSettings>(env.SMART_NOTE_KV, KV_OTP_SETTINGS)) || DEFAULT_SETTINGS
  const expiry = expiryMinutes || settings.defaultExpiryMinutes || 15

  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiry * 60 * 1000).toISOString()

  const otpCode: OtpCodeData = {
    id: generateId(),
    service,
    serviceName: serviceName || service,
    code,
    expiresAt,
    createdAt: now.toISOString()
  }

  // Save to KV
  const codes = (await getJSON<OtpCodeData[]>(env.SMART_NOTE_KV, KV_OTP_CODES)) || []
  codes.unshift(otpCode) // newest first

  // Keep only last 20 codes in storage
  const trimmed = codes.slice(0, 20)
  await putJSON(env.SMART_NOTE_KV, KV_OTP_CODES, trimmed)

  // Push notification to all OTP Hub subscribers
  await pushOtpToSubscribers(env, otpCode, expiry)

  return jsonResponse({ success: true, data: otpCode })
}

/**
 * DELETE /api/otp-hub/:id — Delete an OTP code (admin only)
 */
export async function handleDeleteOtpCode(userId: string, otpId: string, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) {
    return errorResponse('Forbidden', 403)
  }

  const codes = (await getJSON<OtpCodeData[]>(env.SMART_NOTE_KV, KV_OTP_CODES)) || []
  const filtered = codes.filter(c => c.id !== otpId)

  if (filtered.length === codes.length) {
    return errorResponse('OTP not found', 404)
  }

  await putJSON(env.SMART_NOTE_KV, KV_OTP_CODES, filtered)
  return jsonResponse({ success: true, message: 'OTP deleted' })
}

/**
 * GET /api/otp-hub/settings — Get admin settings (admin only)
 */
export async function handleGetOtpSettings(userId: string, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) {
    return errorResponse('Forbidden', 403)
  }

  const settings = (await getJSON<OtpHubSettings>(env.SMART_NOTE_KV, KV_OTP_SETTINGS)) || DEFAULT_SETTINGS
  return jsonResponse({ success: true, data: settings })
}

/**
 * PUT /api/otp-hub/settings — Update admin settings (admin only)
 */
export async function handleUpdateOtpSettings(userId: string, request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) {
    return errorResponse('Forbidden', 403)
  }

  const body = (await request.json()) as any
  const settings = (await getJSON<OtpHubSettings>(env.SMART_NOTE_KV, KV_OTP_SETTINGS)) || DEFAULT_SETTINGS

  if (body.defaultExpiryMinutes !== undefined) {
    settings.defaultExpiryMinutes = body.defaultExpiryMinutes
  }
  settings.updatedAt = new Date().toISOString()

  await putJSON(env.SMART_NOTE_KV, KV_OTP_SETTINGS, settings)
  return jsonResponse({ success: true, data: settings })
}

/**
 * GET /api/otp-hub/subscribers/count — Get subscriber count (admin only)
 */
export async function handleGetOtpSubscriberCount(userId: string, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) {
    return errorResponse('Forbidden', 403)
  }

  const subs = (await getJSON<OtpHubSubscriber[]>(env.SMART_NOTE_KV, KV_OTP_SUBSCRIBERS)) || []
  return jsonResponse({ success: true, data: { count: subs.length } })
}

// ── Push Helper ──

/**
 * Push OTP notification to all OTP Hub subscribers.
 * Best-effort: errors are logged but don't block the caller.
 */
async function pushOtpToSubscribers(env: Env, otp: OtpCodeData, expiryMinutes: number): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return

  const subs = (await getJSON<OtpHubSubscriber[]>(env.SMART_NOTE_KV, KV_OTP_SUBSCRIBERS)) || []
  if (subs.length === 0) return

  const vapid = {
    subject: 'mailto:admin@finnote.app',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  }

  const payload = {
    title: `🔑 OTP ${otp.serviceName}`,
    body: `Mã: ${otp.code} — Hết hạn sau ${expiryMinutes} phút`,
    tag: `otp-${otp.id}`,
    url: '/otp-hub',
    data: { otpId: otp.id, code: otp.code, service: otp.service }
  }

  const message = {
    data: JSON.stringify(payload),
    options: { ttl: expiryMinutes * 60 }
  }

  const expiredEndpoints: string[] = []

  for (const sub of subs) {
    try {
      const pushPayload = await buildPushPayload(
        message,
        { endpoint: sub.endpoint, expirationTime: null, keys: sub.keys },
        vapid
      )

      const fetchInit = {
        ...pushPayload,
        body: pushPayload.body instanceof Uint8Array
          ? pushPayload.body.buffer as ArrayBuffer
          : pushPayload.body
      }

      const res = await fetch(sub.endpoint, fetchInit as RequestInit)

      if (res.status === 404 || res.status === 410) {
        expiredEndpoints.push(sub.endpoint)
      }
    } catch (err) {
      console.error(`[OTP-PUSH] Failed to send to ${sub.endpoint}:`, err)
    }
  }

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    const remaining = subs.filter(s => !expiredEndpoints.includes(s.endpoint))
    await putJSON(env.SMART_NOTE_KV, KV_OTP_SUBSCRIBERS, remaining)
  }
}

// ====== Email OTP Webhook (Auto-detect from Gmail) ======

/**
 * Known email-to-service mapping.
 * Key: substring matched against the sender email (lowercase).
 * Value: { service key, display name, default expiry in minutes }
 */
const EMAIL_SERVICE_MAP: { match: string; service: string; name: string; expiry: number }[] = [
  { match: 'netflix',       service: 'netflix',   name: 'Netflix',      expiry: 15 },
  { match: 'spotify',       service: 'spotify',   name: 'Spotify',      expiry: 10 },
  { match: 'youtube',       service: 'youtube',   name: 'YouTube',      expiry: 15 },
  { match: 'google',        service: 'google',    name: 'Google',       expiry: 5  },
  { match: 'facebook',      service: 'facebook',  name: 'Facebook',     expiry: 10 },
  { match: 'meta.com',      service: 'facebook',  name: 'Facebook',     expiry: 10 },
  { match: 'discord',       service: 'discord',   name: 'Discord',      expiry: 10 },
  { match: 'github',        service: 'github',    name: 'GitHub',       expiry: 10 },
  { match: 'apple',         service: 'apple',     name: 'Apple',        expiry: 5  },
  { match: 'steam',         service: 'steam',     name: 'Steam',        expiry: 15 },
  { match: 'microsoft',     service: 'custom',    name: 'Microsoft',    expiry: 10 },
  { match: 'amazon',        service: 'custom',    name: 'Amazon',       expiry: 10 },
  { match: 'twitter',       service: 'custom',    name: 'Twitter/X',    expiry: 10 },
  { match: 'x.com',         service: 'custom',    name: 'Twitter/X',    expiry: 10 },
  { match: 'linkedin',      service: 'custom',    name: 'LinkedIn',     expiry: 10 },
  { match: 'shopee',        service: 'custom',    name: 'Shopee',       expiry: 5  },
  { match: 'lazada',        service: 'custom',    name: 'Lazada',       expiry: 5  },
  { match: 'grab',          service: 'custom',    name: 'Grab',         expiry: 5  },
]

/**
 * Extract OTP code from email text using multiple regex patterns.
 * Returns the OTP code string or null if not found.
 */
function extractOtpFromText(text: string): string | null {
  // Clean HTML tags if present
  const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')

  // Pattern 1: Explicit OTP/code/mã patterns (Vietnamese + English)
  const explicitPatterns = [
    /(?:mã|code|OTP|verification code|security code|mã xác (?:thực|nhận|minh)|mã đăng nhập|sign[- ]?in code|login code)[:\s]*(\d{4,8})/i,
    /(\d{4,8})\s*(?:là mã|is your|is the code|is your code)/i,
    /(?:enter|nhập|use)\s*(?:this\s*)?(?:code|mã)[:\s]*(\d{4,8})/i,
  ]

  for (const pattern of explicitPatterns) {
    const match = cleanText.match(pattern)
    if (match?.[1]) return match[1]
  }

  // Pattern 2: Standalone prominent number (4-8 digits, surrounded by whitespace or special formatting)
  // Netflix-style: big number in the middle of the email
  const standalonePattern = /(?:^|\s)(\d{4,8})(?:\s|$)/
  const lines = cleanText.split(/[.\n]/)
  for (const line of lines) {
    const trimmed = line.trim()
    // Short line with just a number = likely an OTP
    if (/^\d{4,8}$/.test(trimmed)) return trimmed
    // Line that is mostly a number
    if (trimmed.length < 20) {
      const match = trimmed.match(standalonePattern)
      if (match?.[1]) return match[1]
    }
  }

  // Pattern 3: Last resort — find any 4-6 digit number in the text
  const allNumbers = cleanText.match(/\b(\d{4,6})\b/g)
  if (allNumbers && allNumbers.length === 1) {
    // Only if there's exactly one number, it's likely the OTP
    return allNumbers[0]
  }

  return null
}

/**
 * Detect service from sender email address.
 */
function detectService(from: string): { service: string; name: string; expiry: number } {
  const lowerFrom = from.toLowerCase()
  for (const entry of EMAIL_SERVICE_MAP) {
    if (lowerFrom.includes(entry.match)) {
      return { service: entry.service, name: entry.name, expiry: entry.expiry }
    }
  }
  // Unknown service — extract domain name
  const domainMatch = lowerFrom.match(/@([^.]+)/)
  const domain = domainMatch?.[1] || 'Unknown'
  const name = domain.charAt(0).toUpperCase() + domain.slice(1)
  return { service: 'custom', name, expiry: 15 }
}

/**
 * POST /api/webhook/email-otp — Receive forwarded email content, parse OTP, push to subscribers.
 * 
 * Protected by X-Webhook-Secret header (reuses TELEGRAM_WEBHOOK_SECRET).
 * 
 * Body: { from: string, subject: string, body: string, timestamp?: string }
 */
export async function handleEmailOtpWebhook(request: Request, env: Env): Promise<Response> {
  // Verify webhook secret
  const secret = request.headers.get('X-Webhook-Secret')
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return errorResponse('Unauthorized webhook', 401)
  }

  const payload = (await request.json()) as {
    from?: string
    subject?: string
    body?: string
    timestamp?: string
  }

  const { from = '', subject = '', body = '' } = payload
  const fullText = `${subject} ${body}`

  // Extract OTP code
  const otpCode = extractOtpFromText(fullText)
  if (!otpCode) {
    return jsonResponse({
      success: false,
      error: 'No OTP code found in email',
      debug: { from, subject: subject.substring(0, 100) }
    })
  }

  // Detect service
  const serviceInfo = detectService(from)

  // Deduplication: check if we already have this exact code for this service (within last 5 min)
  const existingCodes = (await getJSON<OtpCodeData[]>(env.SMART_NOTE_KV, KV_OTP_CODES)) || []
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const isDuplicate = existingCodes.some(
    c => c.code === otpCode && c.service === serviceInfo.service && c.createdAt > fiveMinAgo
  )

  if (isDuplicate) {
    return jsonResponse({
      success: true,
      message: 'OTP already exists (dedup)',
      data: { code: otpCode, service: serviceInfo.name }
    })
  }

  // Get settings for override expiry
  const settings = (await getJSON<OtpHubSettings>(env.SMART_NOTE_KV, KV_OTP_SETTINGS)) || DEFAULT_SETTINGS
  const expiryMinutes = settings.defaultExpiryMinutes || serviceInfo.expiry

  // Create the OTP entry
  const now = new Date()
  const otp: OtpCodeData = {
    id: generateId(),
    service: serviceInfo.service,
    serviceName: serviceInfo.name,
    code: otpCode,
    expiresAt: new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString(),
    createdAt: now.toISOString()
  }

  existingCodes.unshift(otp)
  const trimmed = existingCodes.slice(0, 20)
  await putJSON(env.SMART_NOTE_KV, KV_OTP_CODES, trimmed)

  // Push to all subscribers
  await pushOtpToSubscribers(env, otp, expiryMinutes)

  return jsonResponse({
    success: true,
    message: `OTP ${serviceInfo.name} detected and pushed`,
    data: { id: otp.id, code: otpCode, service: serviceInfo.name, expiresAt: otp.expiresAt }
  })
}
