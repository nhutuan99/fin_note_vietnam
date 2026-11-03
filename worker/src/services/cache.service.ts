/**
 * Short-lived cache for public market data (stock prices, fund NAVs, gold board).
 *
 * Kept in isolate memory, backed by the Cloudflare edge cache — never in KV, so
 * looking up a price costs no KV reads or writes. The edge cache is best-effort
 * (it can be unavailable, e.g. on some workers.dev setups); a miss just refetches upstream.
 */

const MAX_MEMORY_ENTRIES = 500
const memory = new Map<string, { value: unknown; expires: number }>()

const cacheUrl = (key: string) => `https://cache.smart-note.internal/${encodeURIComponent(key)}`

function remember(key: string, value: unknown, expires: number): void {
  // Map keeps insertion order → dropping the first key evicts the oldest entry
  if (memory.size >= MAX_MEMORY_ENTRIES && !memory.has(key)) {
    memory.delete(memory.keys().next().value as string)
  }
  memory.set(key, { value, expires })
}

export async function getCached<T>(key: string): Promise<T | null> {
  const hit = memory.get(key)
  if (hit) {
    if (hit.expires > Date.now()) return hit.value as T
    memory.delete(key)
  }

  try {
    const res = await caches.default.match(cacheUrl(key))
    if (!res) return null
    const value = (await res.json()) as T
    remember(key, value, Number(res.headers.get('X-Expires')) || Date.now() + 60_000)
    return value
  } catch {
    return null
  }
}

export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const expires = Date.now() + ttlSeconds * 1000
  remember(key, value, expires)

  try {
    await caches.default.put(
      cacheUrl(key),
      new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttlSeconds}`,
          'X-Expires': String(expires),
        },
      })
    )
  } catch {
    // Edge cache unavailable — the in-memory copy still serves this isolate
  }
}
