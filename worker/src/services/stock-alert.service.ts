/**
 * Stock Alert Service
 * Checks all users' stock alerts against current prices and sends push notifications.
 * Called by the Cloudflare Cron Trigger during trading hours (9h-15h VN, Mon-Fri).
 */

import { Env, StockData } from '../types'
import { getJSON, putJSON } from './kv.service'
import { sendPushToUser } from '../controllers/push.controller'

const PRICE_CACHE_TTL = 60_000 // 1 minute cache for price lookups
const ALERT_USERS_KEY = 'public/stock-alert-users'

/**
 * Register a user as having stock alerts so the cron can find them.
 */
export async function registerAlertUser(userId: string, env: Env): Promise<void> {
  const users = (await getJSON<string[]>(env.SMART_NOTE_KV, ALERT_USERS_KEY)) || []
  if (!users.includes(userId)) {
    users.push(userId)
    await putJSON(env.SMART_NOTE_KV, ALERT_USERS_KEY, users)
  }
}

/**
 * Remove user from alert registry if they have no more alerts.
 */
export async function unregisterAlertUserIfEmpty(userId: string, env: Env): Promise<void> {
  const stocks = await getJSON<StockData[]>(env.SMART_NOTE_KV, `users/${userId}/stocks`) || []
  const hasAlerts = stocks.some(s => s.alerts && s.alerts.some(a => !a.triggered))
  const hasThresholds = stocks.some(s => s.targetProfit || s.stopLoss)
  if (!hasAlerts && !hasThresholds) {
    const users = (await getJSON<string[]>(env.SMART_NOTE_KV, ALERT_USERS_KEY)) || []
    const filtered = users.filter(u => u !== userId)
    await putJSON(env.SMART_NOTE_KV, ALERT_USERS_KEY, filtered)
  }
}

/**
 * Fetch current price for a symbol, with in-memory cache.
 */
const priceCache = new Map<string, { price: number; ts: number }>()

async function getCurrentPrice(symbol: string, env: Env): Promise<number | null> {
  const cached = priceCache.get(symbol)
  if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) {
    return cached.price
  }

  try {
    // Check KV cache first
    const kvKey = `public/stocks/${symbol}`
    const kvCached = await env.SMART_NOTE_KV.get(kvKey)
    if (kvCached) {
      const parsed = JSON.parse(kvCached)
      if (Date.now() - parsed.timestamp < PRICE_CACHE_TTL) {
        priceCache.set(symbol, { price: parsed.price, ts: Date.now() })
        return parsed.price
      }
    }

    // Fetch from DNSE
    const now = Math.floor(Date.now() / 1000)
    const from = now - 86400 * 5
    const res = await fetch(
      `https://services.entrade.com.vn/chart-api/v2/ohlcs/stock?from=${from}&to=${now}&symbol=${symbol}&resolution=1D`
    )
    if (!res.ok) return null

    const data = (await res.json()) as any
    if (!data?.c?.length) return null

    const price = data.c[data.c.length - 1]
    priceCache.set(symbol, { price, ts: Date.now() })

    // Update KV cache
    await env.SMART_NOTE_KV.put(kvKey, JSON.stringify({ price, timestamp: Date.now() }), { expirationTtl: 3600 })

    return price
  } catch {
    return null
  }
}

/**
 * Main cron entry point — check all users' stock alerts.
 */
export async function checkAllStockAlerts(env: Env): Promise<string> {
  const userIds = (await getJSON<string[]>(env.SMART_NOTE_KV, ALERT_USERS_KEY)) || []
  if (userIds.length === 0) return 'No users with alerts'

  let totalTriggered = 0

  for (const userId of userIds) {
    try {
      const stocks = await getJSON<StockData[]>(env.SMART_NOTE_KV, `users/${userId}/stocks`) || []
      let modified = false

      for (const stock of stocks) {
        const currentPrice = await getCurrentPrice(stock.symbol, env)
        if (currentPrice === null) continue

        // ── 1. Check manual alerts ──
        if (stock.alerts?.length) {
          // Check ALL alerts, not just pending ones. 
          // User explicitly wants repeated updates every 30 mins while the price remains in the target zone.
          const pendingAlerts = stock.alerts
          for (const alert of pendingAlerts) {
            let shouldTrigger = false
            // Trigger early when price is within ±0.5% of the target
            if (alert.direction === 'above' && currentPrice >= alert.targetPrice * 0.995) {
              shouldTrigger = true
            } else if (alert.direction === 'below' && currentPrice <= alert.targetPrice * 1.005) {
              shouldTrigger = true
            }

            if (shouldTrigger) {
              alert.triggered = true
              alert.notifiedAt = new Date().toISOString()
              modified = true
              totalTriggered++

              // Send push notification
              const isBuy = alert.direction === 'below'
              const action = isBuy ? '📉 MUA' : '📈 BÁN'
              const title = `📊 ${stock.symbol} đã vào vùng giá ${action}!`
              const body = `Giá hiện tại: ${currentPrice} (Mốc ${alert.targetPrice}) — Đã tiệm cận biên độ ±0.5% để ${alert.label || (isBuy ? 'mua vào' : 'bán ra')}`

              await sendPushToUser(userId, env, {
                title,
                body,
                tag: `stock-alert-${stock.symbol}-${alert.id}`,
                url: '/stocks',
                data: { type: 'stock_alert', symbol: stock.symbol, alertId: alert.id }
              })
            }
          }
        }

        // ── 2. Check targetProfit & stopLoss (percentage-based) ──
        if (stock.buyPrice > 0 && (stock.targetProfit || stock.stopLoss)) {
          const profitPct = ((currentPrice - stock.buyPrice) / stock.buyPrice) * 100

          // Target Profit: notify when profit% >= targetProfit%
          if (stock.targetProfit && profitPct >= stock.targetProfit) {
            totalTriggered++
            await sendPushToUser(userId, env, {
              title: `🎯 ${stock.symbol} đã đạt mục tiêu chốt lời!`,
              body: `Lãi ${profitPct.toFixed(1)}% (mục tiêu ${stock.targetProfit}%) — Giá hiện tại: ${currentPrice} / Giá mua: ${stock.buyPrice}`,
              tag: `stock-tp-${stock.symbol}`,
              url: '/stocks',
              data: { type: 'stock_tp', symbol: stock.symbol }
            })
          }

          // Stop Loss: notify when loss% <= stopLoss% (stopLoss is typically negative, e.g. -7)
          if (stock.stopLoss) {
            const stopLossThreshold = stock.stopLoss < 0 ? stock.stopLoss : -Math.abs(stock.stopLoss)
            if (profitPct <= stopLossThreshold) {
              totalTriggered++
              await sendPushToUser(userId, env, {
                title: `🚨 ${stock.symbol} đã chạm ngưỡng cắt lỗ!`,
                body: `Lỗ ${profitPct.toFixed(1)}% (ngưỡng ${stopLossThreshold}%) — Giá hiện tại: ${currentPrice} / Giá mua: ${stock.buyPrice}`,
                tag: `stock-sl-${stock.symbol}`,
                url: '/stocks',
                data: { type: 'stock_sl', symbol: stock.symbol }
              })
            }
          }
        }
      }

      if (modified) {
        await putJSON(env.SMART_NOTE_KV, `users/${userId}/stocks`, stocks)
      }
    } catch (err) {
      console.error(`[StockAlert] Error checking user ${userId}:`, err)
    }
  }

  return `Checked ${userIds.length} users, triggered ${totalTriggered} alerts`
}
