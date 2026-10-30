import { Env, NotificationData, PushSubscriptionRecord } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { getJSON, putJSON } from '../services/kv.service'

// ====== Push Notification Handlers ======

import { buildPushPayload } from '@block65/webcrypto-web-push'

export async function handlePushSubscribe(userId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as any
  const { endpoint, keys } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return errorResponse('Invalid push subscription data')
  }

  // Load existing subscriptions
  const subs = (await getJSON<PushSubscriptionRecord[]>(env.SMART_NOTE_KV, `users/${userId}/push_subscriptions`)) || []

  // Avoid duplicates
  const exists = subs.some(s => s.endpoint === endpoint)
  if (!exists) {
    subs.push({
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      createdAt: new Date().toISOString()
    })
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/push_subscriptions`, subs)
  }

  return jsonResponse({ success: true, message: 'Push subscription saved' })
}

export async function handlePushUnsubscribe(userId: string, request: Request, env: Env): Promise<Response> {
  const { endpoint } = (await request.json()) as any
  if (!endpoint) return errorResponse('Endpoint is required')

  const subs = (await getJSON<PushSubscriptionRecord[]>(env.SMART_NOTE_KV, `users/${userId}/push_subscriptions`)) || []
  const filtered = subs.filter(s => s.endpoint !== endpoint)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/push_subscriptions`, filtered)

  return jsonResponse({ success: true, message: 'Push subscription removed' })
}

export async function handlePushTest(userId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as any
  const title = body.title || 'FinNote'
  const text = body.body || 'Bạn có thông báo mới'
  const notiList = (await getJSON<NotificationData[]>(env.SMART_NOTE_KV, `users/${userId}/notifications`)) || []
  const unreadCount = notiList.filter(n => !n.read).length
  await sendPushToUser(userId, env, { title, body: text, url: '/', unreadCount })
  return jsonResponse({ success: true, message: 'Push notification sent' })
}

/**
 * Send a push notification to all registered devices for a user.
 * Best-effort: errors are logged but don't block the caller.
 */
export async function sendPushToUser(
  userId: string,
  env: Env,
  payload: { title: string; body: string; tag?: string; url?: string; data?: any; unreadCount?: number }
): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return

  const subs = (await getJSON<PushSubscriptionRecord[]>(env.SMART_NOTE_KV, `users/${userId}/push_subscriptions`)) || []
  if (subs.length === 0) return

  const vapid = {
    subject: 'mailto:admin@finnote.app',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  }

  const expiredEndpoints: string[] = []

  // Build the message according to the library API: { data: string, options: { ttl } }
  const message = {
    data: JSON.stringify(payload),
    options: { ttl: 60 * 60 } // 1 hour TTL
  }

  for (const sub of subs) {
    try {
      const pushPayload = await buildPushPayload(
        message,
        { endpoint: sub.endpoint, expirationTime: null, keys: sub.keys },
        vapid
      )

      // CF Workers fetch doesn't accept Uint8Array directly — convert to ArrayBuffer
      const fetchInit = {
        ...pushPayload,
        body: pushPayload.body instanceof Uint8Array
          ? pushPayload.body.buffer as ArrayBuffer
          : pushPayload.body
      }

      const res = await fetch(sub.endpoint, fetchInit as RequestInit)

      // 404 or 410 means the subscription is expired/invalid → clean up
      if (res.status === 404 || res.status === 410) {
        expiredEndpoints.push(sub.endpoint)
      }
    } catch (err) {
      console.error(`[PUSH] Failed to send to ${sub.endpoint}:`, err)
    }
  }

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    const remaining = subs.filter(s => !expiredEndpoints.includes(s.endpoint))
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/push_subscriptions`, remaining)
  }
}


