/**
 * HTTP Client — Single source of truth for all API calls.
 *
 * Features:
 * - Auto-inject JWT token from auth store
 * - Unwrap { success, data, error } response format
 * - 401 → attempt silent refresh via refresh token, then retry original request
 * - If refresh fails → logout + navigate to /login via Vue Router
 * - Configurable base URL (dev proxy vs production worker)
 *
 * @see vue-expert.md §5 Repository Pattern
 */

import type { ApiResponse, PaginatedApiResponse } from '@/types'
import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_REFRESH_TOKEN_KEY } from '@/constants/auth'

// In dev, Vite proxy handles /api → localhost:8787
// In production, use the full worker URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

import { localDbMock } from '@/shared/localDb'

async function tryLocalMock(method: string, url: string, body?: any): Promise<any> {
  const auth = useAuthStore()
  if (
    auth.isGuest &&
    url.startsWith('/api/') &&
    !url.startsWith('/api/proxy/') &&
    !url.startsWith('/api/otp-hub') &&
    !url.startsWith('/api/blogs')
  ) {
    return await localDbMock(method, url, body)
  }
  return null
}

// ── 401 handling state ────────────────────────────────────────────────────────

let _router: Router | null = null
let _isHandling401 = false
let _isRefreshing = false
let _refreshPromise: Promise<boolean> | null = null

/** Call once from main.ts after router is created. */
export function setHttpClientRouter(router: Router) {
  _router = router
}

/**
 * Attempt to silently refresh the access token using the stored refresh token.
 * Returns true if refresh succeeded, false if it failed (→ must logout).
 */
async function tryRefreshToken(): Promise<boolean> {
  // Dedup: if already refreshing, wait for the same promise
  if (_isRefreshing && _refreshPromise) return _refreshPromise

  _isRefreshing = true
  _refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY)
      if (!refreshToken) return false

      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })

      if (!response.ok) return false

      const json = (await response.json()) as ApiResponse<{
        token: string
        refreshToken: string
        user: any
      }>

      if (!json.success || !json.data) return false

      // Update tokens in auth store
      try {
        const auth = useAuthStore()
        auth.setTokens(json.data.token, json.data.refreshToken)
      } catch {
        // Fallback: update localStorage directly
        localStorage.setItem(AUTH_TOKEN_KEY, json.data.token)
        localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, json.data.refreshToken)
      }

      return true
    } catch {
      return false
    } finally {
      _isRefreshing = false
      _refreshPromise = null
    }
  })()

  return _refreshPromise
}

function handle401() {
  if (_isHandling401) return
  _isHandling401 = true

  // Clear auth: MUST call logout() to clear Pinia reactive state,
  // not just localStorage — otherwise router guard still sees isAuthenticated=true
  // and redirects away from /login → black screen redirect loop.
  try {
    const auth = useAuthStore()
    auth.logout()
  } catch {
    // Fallback if Pinia not ready
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY)
  }

  // Navigate via Vue Router (SPA-safe, no page reload)
  if (_router) {
    _router.push('/login').finally(() => {
      _isHandling401 = false
    })
  } else {
    // Fallback if router not injected yet
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    _isHandling401 = false
  }
}

// ── Core ──────────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

function buildHeaders(hasBody: boolean, isExternal: boolean = false): HeadersInit {
  const headers: Record<string, string> = {}

  if (!isExternal) {
    const token = getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const locale = localStorage.getItem('sn_locale') || 'vi'
    headers['Accept-Language'] = locale
  }

  if (hasBody) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

async function handleResponse<T>(
  response: Response,
  retryFn?: () => Promise<T>,
  silent?: boolean
): Promise<T> {
  if (response.status === 401 && retryFn) {
    // Attempt silent refresh before giving up
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      // Retry the original request with the new token
      return retryFn()
    }
    // Refresh failed → hard logout
    handle401()
    throw new Error('Session expired')
  }

  if (response.status === 401) {
    handle401()
    throw new Error('Session expired')
  }

  // Handle non-JSON error responses (e.g. 500 plain text from worker)
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const isSpaFallback = response.status === 200
    const errorMsg = isSpaFallback
      ? 'API not found (SPA fallback)'
      : `Request failed (${response.status})`
    if (!silent) {
      try {
        const { useUiStore } = await import('@/stores/ui')
        useUiStore().showToast(isSpaFallback ? 'warning' : 'error', errorMsg)
      } catch (e) {}
    }
    throw new Error(errorMsg)
  }

  // If it's an external URL, the response is likely raw JSON, not our { success, data } wrapper
  if (response.url && !response.url.includes(API_BASE) && response.url.startsWith('http')) {
    const rawJson = await response.json()
    return rawJson as T
  }

  const json: ApiResponse<T> = await response.json()

  if (!json.success) {
    const errorMsg = json.error || `Request failed (${response.status})`
    if (!silent) {
      try {
        const { useUiStore } = await import('@/stores/ui')
        useUiStore().showToast('error', errorMsg)
      } catch (e) {}
    }
    throw new Error(errorMsg)
  }

  return json.data as T
}

async function get<T>(url: string, options?: { silent?: boolean }): Promise<T> {
  const mock = await tryLocalMock('GET', url)
  if (mock) return mock.data as T

  const isExternal = url.startsWith('http')
  const fullUrl = isExternal ? url : `${API_BASE}${url}`
  const silent = options?.silent

  const doRequest = async (): Promise<T> => {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: buildHeaders(false, isExternal),
      cache: 'no-store'
    })
    return handleResponse<T>(response, undefined, silent)
  }

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: buildHeaders(false, isExternal),
    cache: 'no-store'
  })
  return handleResponse<T>(response, doRequest, silent)
}

async function post<T>(url: string, body?: unknown, options?: { silent?: boolean }): Promise<T> {
  const mock = await tryLocalMock('POST', url, body)
  if (mock) return mock.data as T

  const isExternal = url.startsWith('http')
  const fullUrl = isExternal ? url : `${API_BASE}${url}`
  const silent = options?.silent

  const doRequest = async (): Promise<T> => {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: buildHeaders(true, isExternal),
      body: body ? JSON.stringify(body) : undefined
    })
    return handleResponse<T>(response, undefined, silent)
  }

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: buildHeaders(true, isExternal),
    body: body ? JSON.stringify(body) : undefined
  })
  return handleResponse<T>(response, doRequest, silent)
}

async function put<T>(url: string, body?: unknown): Promise<T> {
  const mock = await tryLocalMock('PUT', url, body)
  if (mock) return mock.data as T

  const isExternal = url.startsWith('http')
  const fullUrl = isExternal ? url : `${API_BASE}${url}`

  const doRequest = async (): Promise<T> => {
    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers: buildHeaders(true, isExternal),
      body: body ? JSON.stringify(body) : undefined
    })
    return handleResponse<T>(response)
  }

  const response = await fetch(fullUrl, {
    method: 'PUT',
    headers: buildHeaders(true, isExternal),
    body: body ? JSON.stringify(body) : undefined
  })
  return handleResponse<T>(response, doRequest)
}

async function del(url: string): Promise<void> {
  const mock = await tryLocalMock('DELETE', url)
  if (mock) return mock.data as void

  const isExternal = url.startsWith('http')
  const fullUrl = isExternal ? url : `${API_BASE}${url}`

  const doRequest = async (): Promise<void> => {
    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: buildHeaders(false, isExternal)
    })
    await handleResponse<void>(response)
  }

  const response = await fetch(fullUrl, {
    method: 'DELETE',
    headers: buildHeaders(false, isExternal)
  })
  await handleResponse<void>(response, doRequest)
}

/**
 * GET that returns the full paginated wrapper { data, total, page, limit }.
 * Use for endpoints that support pagination (e.g. /api/transactions?page=1&limit=15).
 */
async function getPaginated<T>(
  url: string,
  options?: { silent?: boolean }
): Promise<PaginatedApiResponse<T>> {
  const mock = await tryLocalMock('GET', url)
  if (mock) return mock as PaginatedApiResponse<T>

  const fullUrl = `${API_BASE}${url}`
  const silent = options?.silent

  const doRequest = async (): Promise<PaginatedApiResponse<T>> => {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: buildHeaders(false, false),
      cache: 'no-store'
    })
    return handlePaginatedResponse<T>(response, undefined, silent)
  }

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: buildHeaders(false, false),
    cache: 'no-store'
  })
  return handlePaginatedResponse<T>(response, doRequest, silent)
}

async function handlePaginatedResponse<T>(
  response: Response,
  retryFn?: () => Promise<PaginatedApiResponse<T>>,
  silent?: boolean
): Promise<PaginatedApiResponse<T>> {
  if (response.status === 401 && retryFn) {
    const refreshed = await tryRefreshToken()
    if (refreshed) return retryFn()
    handle401()
    throw new Error('Session expired')
  }
  if (response.status === 401) {
    handle401()
    throw new Error('Session expired')
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const errorMsg = `Request failed (${response.status})`
    if (!silent) {
      try {
        const { useUiStore } = await import('@/stores/ui')
        useUiStore().showToast('error', errorMsg)
      } catch (e) {}
    }
    throw new Error(errorMsg)
  }

  const json = (await response.json()) as PaginatedApiResponse<T>

  if (!json.success) {
    const errorMsg = json.error || `Request failed (${response.status})`
    if (!silent) {
      try {
        const { useUiStore } = await import('@/stores/ui')
        useUiStore().showToast('error', errorMsg)
      } catch (e) {}
    }
    throw new Error(errorMsg)
  }

  return json
}

export const httpClient = { get, getPaginated, post, put, del }
