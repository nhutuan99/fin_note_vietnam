import { Env } from '../types'

export function corsHeaders(env: Env, requestOrigin?: string | null): HeadersInit {
  const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000']
  let origin = allowedOrigins[0]

  if (requestOrigin) {
    if (allowedOrigins.includes(requestOrigin) || requestOrigin.startsWith('app://') || requestOrigin.startsWith('capacitor://') || requestOrigin.startsWith('http://127.0.0.1:')) {
      origin = requestOrigin
    }
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret, x-device-id, X-Otp-Password',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status)
}
