import { Env, UserData, PendingNotification } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { hashPassword } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'

// ====== PIN System ======

export async function handleSetPin(userId: string, request: Request, env: Env): Promise<Response> {
  const { pin, currentPin } = (await request.json()) as any
  if (!pin || pin.length !== 4) {
    return errorResponse('PIN phải là 4 chữ số')
  }
  if (!/^\d+$/.test(pin)) {
    return errorResponse('PIN chỉ được chứa số')
  }

  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (!user) return errorResponse('User not found', 404)

  // If PIN already exists, verify current PIN first
  const existingPin = await getJSON<string>(env.SMART_NOTE_KV, `users/${userId}/pin`)
  if (existingPin) {
    if (!currentPin) return errorResponse('Cần nhập PIN hiện tại')
    const currentHash = await hashPassword(currentPin)
    if (currentHash !== existingPin) return errorResponse('PIN hiện tại không đúng', 400)
  }

  const pinHash = await hashPassword(pin)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/pin`, pinHash)

  return jsonResponse({ success: true, message: 'PIN đã được thiết lập' })
}

export async function handleVerifyPin(userId: string, request: Request, env: Env): Promise<Response> {
  const { pin } = (await request.json()) as any
  if (!pin) return errorResponse('PIN is required')

  const storedHash = await getJSON<string>(env.SMART_NOTE_KV, `users/${userId}/pin`)
  if (!storedHash) return errorResponse('Chưa thiết lập PIN', 404)

  const inputHash = await hashPassword(pin)
  if (inputHash !== storedHash) return errorResponse('PIN không đúng', 400)

  return jsonResponse({ success: true, message: 'PIN verified' })
}

export async function handleCheckPin(userId: string, env: Env): Promise<Response> {
  const storedHash = await getJSON<string>(env.SMART_NOTE_KV, `users/${userId}/pin`)
  return jsonResponse({ success: true, data: { hasPin: !!storedHash } })
}

export async function handleListPending(userId: string, env: Env): Promise<Response> {
  const pending = (await getJSON<PendingNotification[]>(
    env.SMART_NOTE_KV,
    `users/${userId}/finance/pending`
  )) || []
  return jsonResponse({ success: true, data: pending })
}

export async function handleResolvePending(userId: string, pendingId: string, env: Env): Promise<Response> {
  const pending = (await getJSON<PendingNotification[]>(
    env.SMART_NOTE_KV,
    `users/${userId}/finance/pending`
  )) || []
  const idx = pending.findIndex(p => p.id === pendingId)
  if (idx === -1) return errorResponse('Pending notification not found', 404)
  pending[idx].status = 'resolved'
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/pending`, pending)
  return jsonResponse({ success: true })
}

