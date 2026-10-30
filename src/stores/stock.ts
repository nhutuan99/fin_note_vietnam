import { defineStore } from 'pinia'
import { ref } from 'vue'
import { stockApi } from '@/services/api/stock.api'
import type { StockPosition } from '@/types'

export const useStockStore = defineStore('stock', () => {
  const positions = ref<StockPosition[]>([])
  const loading = ref(false)
  const prices = ref<Record<string, number>>({})
  const histories = ref<Record<string, { price: number, open: number, high: number, low: number, volume: number, time: number }[]>>({})

  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function fetchPositions(force = false) {
    loading.value = true
    try {
      const data = await stockApi.getPositions()
      positions.value = data || []
      
      // Fetch current prices in background
      data?.forEach(p => {
        fetchPrice(p.symbol, force)
        fetchHistory(p.symbol, force)
      })
    } catch (error) {
      console.error('Failed to fetch stocks:', error)
    } finally {
      loading.value = false
    }
  }

  async function fetchPrice(symbol: string, force = false) {
    try {
      const data = await stockApi.getCurrentPrice(symbol, force)
      if (data?.currentPrice) {
        prices.value[symbol] = data.currentPrice
      }
    } catch (error) {
      // Background fetch error ignored
    }
  }

  async function fetchAllPrices(force = false) {
    const symbols = [...new Set(positions.value.map(p => p.symbol))]
    await Promise.allSettled(symbols.map(s => fetchPrice(s, force)))
  }

  async function fetchHistory(symbol: string, force = false) {
    try {
      const data = await stockApi.getStockHistory(symbol, 7, force)
      if (data?.history) {
        histories.value[symbol] = data.history
      }
    } catch (e) {
      // Ignore
    }
  }

  async function addPosition(data: Partial<StockPosition>) {
    try {
      const newPos = await stockApi.createPosition(data)
      if (newPos) {
        positions.value.push(newPos)
        fetchPrice(newPos.symbol)
        fetchHistory(newPos.symbol)
      }
    } catch (e) {
      throw e
    }
  }

  async function updatePosition(id: string, data: Partial<StockPosition>) {
    try {
      const updated = await stockApi.updatePosition(id, data)
      if (updated) {
        const index = positions.value.findIndex(p => p.id === id)
        if (index !== -1) positions.value[index] = updated
        fetchPrice(updated.symbol)
        fetchHistory(updated.symbol)
      }
    } catch (e) {
      throw e
    }
  }

  async function deletePosition(id: string) {
    try {
      await stockApi.deletePosition(id)
      positions.value = positions.value.filter(p => p.id !== id)
    } catch (e) {
      throw e
    }
  }

  // ── Alert Actions ──────────────────────────────────────────

  async function addAlert(stockId: string, data: { targetPrice: number; direction: 'above' | 'below'; label?: string }) {
    const alert = await stockApi.addAlert(stockId, data)
    if (alert) {
      const pos = positions.value.find(p => p.id === stockId)
      if (pos) {
        if (!pos.alerts) pos.alerts = []
        pos.alerts.push(alert)
      }
    }
    return alert
  }

  async function deleteAlert(stockId: string, alertId: string) {
    await stockApi.deleteAlert(stockId, alertId)
    const pos = positions.value.find(p => p.id === stockId)
    if (pos?.alerts) {
      pos.alerts = pos.alerts.filter(a => a.id !== alertId)
    }
  }

  async function resetAlert(stockId: string, alertId: string) {
    const alert = await stockApi.resetAlert(stockId, alertId)
    if (alert) {
      const pos = positions.value.find(p => p.id === stockId)
      const existing = pos?.alerts?.find(a => a.id === alertId)
      if (existing) {
        existing.triggered = false
        existing.notifiedAt = undefined
      }
    }
  }

  // ── Client-side Polling ─────────────────────────────────────
  // Poll prices every 60s when user is on the Stocks page

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(() => {
      fetchAllPrices()
    }, 60_000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    positions,
    loading,
    prices,
    histories,
    fetchPositions,
    fetchPrice,
    fetchAllPrices,
    fetchHistory,
    addPosition,
    updatePosition,
    deletePosition,
    addAlert,
    deleteAlert,
    resetAlert,
    startPolling,
    stopPolling
  }
})
