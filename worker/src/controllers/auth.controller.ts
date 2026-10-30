import { Env, UserData, WalletData } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId, hashPassword } from '../utils/crypto'
import { createJWT, createRefreshToken, verifyJWT } from '../utils/jwt'
import { getJSON, putJSON } from '../services/kv.service'
import { GOOGLE_OAUTH_AUTH_URL, GOOGLE_OAUTH_TOKEN_URL, GOOGLE_OAUTH_USERINFO_URL } from '../constants/api'

const DEFAULT_WALLETS: Omit<WalletData, 'id'>[] = [
  { name: 'Ngân hàng', balance: 0, currency: 'VND', icon: '🏦', color: '#3b82f6', order: 0 },
  { name: 'Ví điện tử', balance: 0, currency: 'VND', icon: '📱', color: '#8b5cf6', order: 1 },
  { name: 'Tiền mặt',   balance: 0, currency: 'VND', icon: '💵', color: '#10b981', order: 2 },
]

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const { email, password, name } = (await request.json()) as any
  if (!email || !password) return errorResponse('Email and password required')
  if (typeof password !== 'string' || password.length < 6) return errorResponse('Mật khẩu phải có ít nhất 6 ký tự')
  if (typeof email !== 'string' || !email.includes('@')) return errorResponse('Email không hợp lệ')

  const usersIndex =
    (await getJSON<Record<string, string>>(env.SMART_NOTE_KV, 'users/_index')) || {}
  if (usersIndex[email]) return errorResponse('Email already registered')

  const id = generateId()
  const user: UserData = {
    id,
    email,
    name: name || email.split('@')[0],
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString()
  }

  await putJSON(env.SMART_NOTE_KV, `users/${id}/profile`, user)
  usersIndex[email] = id
  await putJSON(env.SMART_NOTE_KV, 'users/_index', usersIndex)
  await putJSON(env.SMART_NOTE_KV, `users/${id}/notes/_index`, { notes: [] })

  const defaultWallets: WalletData[] = DEFAULT_WALLETS.map((w) => ({
    ...w,
    id: generateId()
  }))
  await putJSON(env.SMART_NOTE_KV, `users/${id}/finance/wallets`, defaultWallets)
  await putJSON(env.SMART_NOTE_KV, `users/${id}/finance/transactions`, [])

  const token = await createJWT({ userId: id }, env.JWT_SECRET)
  const refreshToken = await createRefreshToken({ userId: id }, env.JWT_SECRET)
  return jsonResponse({
    success: true,
    data: {
      token,
      refreshToken,
      user: {
        id,
        email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        hasCompletedOnboarding: user.hasCompletedOnboarding
      }
    }
  })
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { email, password } = (await request.json()) as any
  if (!email || !password) return errorResponse('Email and password required')

  const usersIndex =
    (await getJSON<Record<string, string>>(env.SMART_NOTE_KV, 'users/_index')) || {}
  const userId = usersIndex[email]
  if (!userId) return errorResponse('Invalid credentials', 401)

  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (!user) return errorResponse('User not found', 404)

  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) return errorResponse('Invalid credentials', 401)

  const token = await createJWT({ userId: user.id }, env.JWT_SECRET)
  const refreshToken = await createRefreshToken({ userId: user.id }, env.JWT_SECRET)
  return jsonResponse({
    success: true,
    data: {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        hasCompletedOnboarding: user.hasCompletedOnboarding
      }
    }
  })
}

export async function handleUpdateProfile(userId: string, request: Request, env: Env): Promise<Response> {
  const { name, avatarUrl, hasCompletedOnboarding, disableLargeTransferConfirmation } = (await request.json()) as any
  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (!user) return errorResponse('User not found', 404)

  if (name) user.name = name
  if (avatarUrl !== undefined) {
    if (!avatarUrl || avatarUrl.trim() === '') {
      delete user.avatarUrl
    } else {
      user.avatarUrl = avatarUrl.trim()
    }
  }
  if (hasCompletedOnboarding !== undefined) {
    user.hasCompletedOnboarding = hasCompletedOnboarding
  }
  if (disableLargeTransferConfirmation !== undefined) {
    user.disableLargeTransferConfirmation = disableLargeTransferConfirmation
  }

  await putJSON(env.SMART_NOTE_KV, `users/${userId}/profile`, user)

  return jsonResponse({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl || '',
      createdAt: user.createdAt,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      disableLargeTransferConfirmation: user.disableLargeTransferConfirmation
    }
  })
}

export async function handleDeleteAccount(userId: string, request: Request, env: Env): Promise<Response> {
  const { password } = (await request.json()) as any
  if (!password) return errorResponse('Password is required', 400)

  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (!user) return errorResponse('User not found', 404)

  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) {
    return errorResponse('Mật khẩu không chính xác', 400)
  }

  const usersIndex = (await getJSON<Record<string, string>>(env.SMART_NOTE_KV, 'users/_index')) || {}
  delete usersIndex[user.email]
  await putJSON(env.SMART_NOTE_KV, 'users/_index', usersIndex)

  await env.SMART_NOTE_KV.delete(`users/${userId}/profile`)
  await env.SMART_NOTE_KV.delete(`users/${userId}/notes/_index`)
  await env.SMART_NOTE_KV.delete(`users/${userId}/finance/wallets`)
  await env.SMART_NOTE_KV.delete(`users/${userId}/finance/transactions`)
  await env.SMART_NOTE_KV.delete(`users/${userId}/pin`)
  await env.SMART_NOTE_KV.delete(`users/${userId}/otp`)

  return jsonResponse({ success: true, message: 'Account deleted successfully' })
}

export async function handleGoogleOAuthUrl(request: Request, env: Env): Promise<Response> {
  const { email, redirectUri } = (await request.json()) as any
  if (!email) return errorResponse('Email is required')
  if (!redirectUri) return errorResponse('Redirect URI is required')

  const usersIndex = (await getJSON<Record<string, string>>(env.SMART_NOTE_KV, 'users/_index')) || {}
  const userId = usersIndex[email]
  if (!userId) return errorResponse('Email không tồn tại trong hệ thống', 400)

  if (!env.GOOGLE_CLIENT_ID) return errorResponse('Google OAuth not configured', 503)

  const nonce = generateId() + generateId()
  const nonceHash = await hashPassword(nonce)
  await env.SMART_NOTE_KV.put(`oauth_nonce/${nonceHash}`, email, { expirationTtl: 600 })

  const state = btoa(JSON.stringify({ nonce, email }))
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'online',
    state,
    prompt: 'select_account',
    login_hint: email
  })

  const oauthUrl = `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`
  return jsonResponse({ success: true, data: { url: oauthUrl } })
}

export async function handleGoogleVerify(request: Request, env: Env): Promise<Response> {
  const { code, state, redirectUri } = (await request.json()) as any
  if (!code || !state || !redirectUri) return errorResponse('Missing required fields')

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return errorResponse('Google OAuth not configured', 503)
  }

  let stateData: { nonce: string; email: string }
  try {
    stateData = JSON.parse(atob(state))
  } catch {
    return errorResponse('Invalid state parameter', 400)
  }

  const nonceHash = await hashPassword(stateData.nonce)
  const storedEmail = await env.SMART_NOTE_KV.get(`oauth_nonce/${nonceHash}`)
  if (!storedEmail || storedEmail !== stateData.email) {
    return errorResponse('Phiên xác minh đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.', 400)
  }

  const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  })

  if (!tokenResponse.ok) return errorResponse('Xác minh Google thất bại. Vui lòng thử lại.', 400)

  const tokenData = (await tokenResponse.json()) as any
  const accessToken = tokenData.access_token
  if (!accessToken) return errorResponse('No access token from Google', 400)

  const userInfoResponse = await fetch(GOOGLE_OAUTH_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!userInfoResponse.ok) return errorResponse('Không thể lấy thông tin từ Google', 400)

  const googleUser = (await userInfoResponse.json()) as { email?: string; verified_email?: boolean }

  if (!googleUser.email || !googleUser.verified_email) return errorResponse('Email Google chưa được xác minh', 400)

  if (googleUser.email.toLowerCase() !== stateData.email.toLowerCase()) {
    return errorResponse('Email Google không khớp với email đăng ký. Vui lòng đăng nhập đúng tài khoản Google.', 400)
  }

  const usersIndex = (await getJSON<Record<string, string>>(env.SMART_NOTE_KV, 'users/_index')) || {}
  const userId = usersIndex[stateData.email]
  if (!userId) return errorResponse('User not found', 404)

  const resetToken = generateId() + generateId()
  const resetTokenHash = await hashPassword(resetToken)
  await env.SMART_NOTE_KV.put(`users/${userId}/otp/reset_token`, resetTokenHash, { expirationTtl: 900 })

  await env.SMART_NOTE_KV.delete(`oauth_nonce/${nonceHash}`)

  return jsonResponse({ success: true, data: { resetToken, email: stateData.email } })
}

export async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  const { email, resetToken, newPassword } = (await request.json()) as any
  if (!email || !resetToken || !newPassword) return errorResponse('Missing required fields')
  if (newPassword.length < 6) return errorResponse('Mật khẩu phải có ít nhất 6 ký tự')

  const usersIndex = (await getJSON<Record<string, string>>(env.SMART_NOTE_KV, 'users/_index')) || {}
  const userId = usersIndex[email]
  if (!userId) return errorResponse('Yêu cầu không hợp lệ', 400)

  const storedTokenHash = await env.SMART_NOTE_KV.get(`users/${userId}/otp/reset_token`)
  if (!storedTokenHash) return errorResponse('Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thử lại.', 400)

  const inputHash = await hashPassword(resetToken)
  if (inputHash !== storedTokenHash) return errorResponse('Reset token không hợp lệ', 400)

  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (!user) return errorResponse('User not found', 404)

  user.passwordHash = await hashPassword(newPassword)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/profile`, user)
  await env.SMART_NOTE_KV.delete(`users/${userId}/otp/reset_token`)

  return jsonResponse({ success: true, message: 'Đặt lại mật khẩu thành công' })
}

export async function handleGoogleSignIn(request: Request, env: Env): Promise<Response> {
  const { code, redirectUri } = (await request.json()) as any
  if (!code || !redirectUri) return errorResponse('Missing required fields')

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return errorResponse('Google OAuth not configured', 503)

  const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  })

  if (!tokenResponse.ok) return errorResponse('Đăng nhập Google thất bại. Vui lòng thử lại.', 400)

  const tokenData = (await tokenResponse.json()) as any
  const accessToken = tokenData.access_token
  if (!accessToken) return errorResponse('No access token from Google', 400)

  const userInfoResponse = await fetch(GOOGLE_OAUTH_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!userInfoResponse.ok) return errorResponse('Không thể lấy thông tin từ Google', 400)

  const googleUser = (await userInfoResponse.json()) as { email?: string; verified_email?: boolean; name?: string; picture?: string }

  if (!googleUser.email || !googleUser.verified_email) return errorResponse('Email Google chưa được xác minh', 400)

  const email = googleUser.email.toLowerCase()
  const usersIndex = (await getJSON<Record<string, string>>(env.SMART_NOTE_KV, 'users/_index')) || {}

  let userId = usersIndex[email]

  if (userId) {
    const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
    if (!user) return errorResponse('User not found', 404)

    if (googleUser.picture && user.avatarUrl !== googleUser.picture) {
      user.avatarUrl = googleUser.picture
      await putJSON(env.SMART_NOTE_KV, `users/${userId}/profile`, user)
    }

    const token = await createJWT({ userId: user.id }, env.JWT_SECRET)
    const refreshToken = await createRefreshToken({ userId: user.id }, env.JWT_SECRET)
    return jsonResponse({
      success: true,
      data: {
        token,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt, hasCompletedOnboarding: user.hasCompletedOnboarding },
        isNewUser: false
      }
    })
  } else {
    userId = generateId()
    const randomPass = generateId() + generateId() + generateId()
    const user: UserData = {
      id: userId,
      email,
      name: googleUser.name || email.split('@')[0],
      avatarUrl: googleUser.picture,
      passwordHash: await hashPassword(randomPass),
      createdAt: new Date().toISOString()
    }

    await putJSON(env.SMART_NOTE_KV, `users/${userId}/profile`, user)
    usersIndex[email] = userId
    await putJSON(env.SMART_NOTE_KV, 'users/_index', usersIndex)
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/notes/_index`, { notes: [] })

    const defaultWallets: WalletData[] = DEFAULT_WALLETS.map((w) => ({ ...w, id: generateId() }))
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, defaultWallets)
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`, [])

    const token = await createJWT({ userId }, env.JWT_SECRET)
    const refreshToken = await createRefreshToken({ userId }, env.JWT_SECRET)
    return jsonResponse({
      success: true,
      data: {
        token,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt, hasCompletedOnboarding: user.hasCompletedOnboarding },
        isNewUser: true
      }
    })
  }
}

export async function handleForgotPin(userId: string, request: Request, env: Env): Promise<Response> {
  const { password } = (await request.json()) as any
  if (!password) return errorResponse('Vui lòng nhập mật khẩu', 400)

  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (!user) return errorResponse('User not found', 404)

  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) return errorResponse('Mật khẩu không chính xác', 400)

  const resetToken = generateId() + generateId()
  const resetTokenHash = await hashPassword(resetToken)
  await env.SMART_NOTE_KV.put(`users/${userId}/otp/pin_reset_token`, resetTokenHash, { expirationTtl: 300 })

  return jsonResponse({ success: true, data: { resetToken } })
}

export async function handleResetPin(userId: string, request: Request, env: Env): Promise<Response> {
  const { resetToken, newPin } = (await request.json()) as any
  if (!resetToken || !newPin) return errorResponse('Missing required fields')
  if (!newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) return errorResponse('PIN phải là 4 chữ số')

  const storedTokenHash = await env.SMART_NOTE_KV.get(`users/${userId}/otp/pin_reset_token`)
  if (!storedTokenHash) return errorResponse('Phiên đặt lại PIN đã hết hạn. Vui lòng thử lại.', 400)

  const inputHash = await hashPassword(resetToken)
  if (inputHash !== storedTokenHash) return errorResponse('Reset token không hợp lệ', 400)

  const pinHash = await hashPassword(newPin)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/pin`, pinHash)
  await env.SMART_NOTE_KV.delete(`users/${userId}/otp/pin_reset_token`)

  return jsonResponse({ success: true, message: 'Đặt lại PIN thành công' })
}

// ====== Refresh Token ======

export async function handleRefreshToken(request: Request, env: Env): Promise<Response> {
  const { refreshToken } = (await request.json()) as any
  if (!refreshToken) return errorResponse('Refresh token is required', 400)

  const payload = await verifyJWT(refreshToken, env.JWT_SECRET)
  if (!payload || payload.type !== 'refresh') {
    return errorResponse('Invalid or expired refresh token', 401)
  }

  // Verify user still exists
  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${payload.userId}/profile`)
  if (!user) return errorResponse('User not found', 401)

  // Issue new token pair
  const newToken = await createJWT({ userId: payload.userId }, env.JWT_SECRET)
  const newRefreshToken = await createRefreshToken({ userId: payload.userId }, env.JWT_SECRET)

  return jsonResponse({
    success: true,
    data: {
      token: newToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        hasCompletedOnboarding: user.hasCompletedOnboarding
      }
    }
  })
}
