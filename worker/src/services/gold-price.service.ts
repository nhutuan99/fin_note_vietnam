import { Env, GoldPriceItem, GoldPrices } from '../types'
import { PNJ_GOLD_PRICE_API, VANG_TODAY_API } from '../constants/api'

/**
 * Vietnamese retail gold prices, normalised to VND per chỉ (1 cây/lượng = 10 chỉ = 100 phân).
 *
 * Primary source: PNJ's public price board (every purity: 999.9, 999, 22K, 18K, 14K, 10K…).
 * Fallback: vang.today (SJC bars/rings and 24K only) when PNJ is unreachable.
 * Cached in KV for 5 minutes; when every source fails the last good board is served as stale.
 */

const CACHE_KEY = 'public/gold/prices'
const FRESH_MS = 5 * 60 * 1000

/** In-isolate copy so a burst of wallet reads doesn't hit KV each time */
let memo: { fetchedAt: number; data: GoldPrices } | null = null

/** PNJ quotes in thousand VND per chỉ ("14,000" = 14,000,000 ₫/chỉ) */
function pnjToVnd(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.]/g, ''))
  if (!isFinite(n) || n <= 0) return 0
  return n < 100_000 ? Math.round(n * 1000) : Math.round(n)
}

/** "02/11/2026 14:44:57" (Vietnam time) → ISO */
function parseVnDate(s: unknown): string {
  const m = typeof s === 'string' && s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return new Date().toISOString()
  const [, d, mo, y, h, mi, sec] = m
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - 7, +mi, +(sec || 0))).toISOString()
}

async function fetchPnj(): Promise<GoldPrices> {
  const res = await fetch(PNJ_GOLD_PRICE_API, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 FinNote' },
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) throw new Error(`PNJ HTTP ${res.status}`)
  const json = (await res.json()) as any
  const items: GoldPriceItem[] = (Array.isArray(json?.data) ? json.data : [])
    .map((p: any) => ({
      code: String(p.masp ?? '').trim(),
      name: String(p.tensp ?? '').trim(),
      buy: pnjToVnd(p.giamua),
      sell: pnjToVnd(p.giaban)
    }))
    .filter((p: GoldPriceItem) => p.code && p.name && p.buy > 0)
  if (!items.length) throw new Error('PNJ returned no prices')
  return { source: 'PNJ', updatedAt: parseVnDate(json.updateDate), items }
}

/** vang.today codes → our (PNJ) codes; prices there are per lượng */
const VANG_TODAY_MAP: Record<string, { code: string; name: string }> = {
  SJL1L10: { code: 'SJC', name: 'Vàng miếng SJC 999.9' },
  SJ9999: { code: 'N24K', name: 'Nhẫn trơn 999.9' },
  PQHN24NTT: { code: '24K', name: 'Vàng nữ trang 999.9' }
}

async function fetchVangToday(): Promise<GoldPrices> {
  const res = await fetch(VANG_TODAY_API, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) throw new Error(`vang.today HTTP ${res.status}`)
  const json = (await res.json()) as any
  // { prices: { SJL1L10: { name, buy, sell, ... }, ... } } — keyed by product code
  const rows: Record<string, any> = json?.prices && typeof json.prices === 'object' ? json.prices : {}
  const items: GoldPriceItem[] = []
  for (const [code, r] of Object.entries(rows)) {
    const mapped = VANG_TODAY_MAP[code]
    const buy = Number(r?.buy)
    if (!mapped || !(buy > 0)) continue
    items.push({ ...mapped, buy: Math.round(buy / 10), sell: Math.round((Number(r?.sell) || 0) / 10) })
  }
  if (!items.length) throw new Error('vang.today returned no prices')
  const ts = Number(json?.timestamp)
  return { source: 'vang.today', updatedAt: ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString(), items }
}

export async function getGoldPrices(env: Env, force = false): Promise<GoldPrices | null> {
  const now = Date.now()
  if (!force && memo && now - memo.fetchedAt < FRESH_MS) return memo.data

  let cached: { fetchedAt: number; data: GoldPrices } | null = null
  try {
    cached = await env.SMART_NOTE_KV.get(CACHE_KEY, 'json')
  } catch { /* treat as empty */ }
  if (!force && cached && now - cached.fetchedAt < FRESH_MS) {
    memo = cached
    return cached.data
  }

  for (const source of [fetchPnj, fetchVangToday]) {
    try {
      const data = await source()
      memo = { fetchedAt: now, data }
      await env.SMART_NOTE_KV.put(CACHE_KEY, JSON.stringify(memo))
      return data
    } catch (err) {
      console.error('Gold price source failed:', err)
    }
  }

  // Every source failed: last known board, flagged so the UI can say so
  if (cached) return { ...cached.data, stale: true }
  return null
}

/** Value of a holding at the shop's buy-back price (what you'd actually get if you sold today) */
export function goldValue(prices: GoldPrices | null, type: string, qtyChi: number): number | null {
  const item = prices?.items.find((i) => i.code === type)
  if (!item || !(qtyChi > 0)) return qtyChi > 0 ? null : 0
  return Math.round(item.buy * qtyChi)
}
