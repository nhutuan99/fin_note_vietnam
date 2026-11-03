import { httpClient } from '@/shared/api/httpClient'
import type { StockPosition, StockAlert } from '@/types'

export const stockApi = {
  getPositions: () => httpClient.get<StockPosition[]>('/api/stocks'),
  
  createPosition: (data: Partial<StockPosition>) => 
    httpClient.post<StockPosition>('/api/stocks', data),
    
  updatePosition: (id: string, data: Partial<StockPosition>) => 
    httpClient.put<StockPosition>(`/api/stocks/${id}`, data),
    
  deletePosition: (id: string) => 
    httpClient.del(`/api/stocks/${id}`),

  // Silent mode: background fetches that shouldn't show error toasts
  getCurrentPrice: (symbol: string, force = false) =>
    httpClient.get<{ currentPrice: number, symbol: string }>(`/api/proxy/stock-price?symbol=${symbol}${force ? '&force=true' : ''}`, { silent: true }),

  getStockHistory: (symbol: string, days: number = 7, force = false) =>
    httpClient.get<{ history: { price: number, open: number, high: number, low: number, volume: number, time: number }[], symbol: string }>(`/api/proxy/stock-history?symbol=${symbol}&days=${days}${force ? '&force=true' : ''}`, { silent: true }),

  // ── Alert CRUD ──
  addAlert: (stockId: string, data: { targetPrice: number; direction: 'above' | 'below'; label?: string }) =>
    httpClient.post<StockAlert>(`/api/stocks/${stockId}/alerts`, data),

  deleteAlert: (stockId: string, alertId: string) =>
    httpClient.del(`/api/stocks/${stockId}/alerts/${alertId}`)
}
