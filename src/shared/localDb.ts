import type { Wallet, Transaction, Reminder, Note, StockPosition, FundPosition, FinanceStats } from '@/types'
import { deriveNoteText } from '@/shared/utils/noteText'

const LOCAL_STORAGE_KEY = 'smart_note_guest_data'

interface LocalSchema {
  wallets: Wallet[]
  transactions: Transaction[]
  reminders: Reminder[]
  notes: Note[]
  stocks: StockPosition[]
  funds: FundPosition[]
  /** Quick-add popup preferences (same shape as the worker's QuickAddPrefs) */
  quickAdd?: Record<string, unknown>
}

function getDb(): LocalSchema {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!raw) {
    const defaultData: LocalSchema = {
      wallets: [],
      transactions: [],
      reminders: [],
      notes: [],
      stocks: [],
      funds: []
    }
    saveDb(defaultData)
    return defaultData
  }
  return JSON.parse(raw)
}

function saveDb(data: LocalSchema) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
}

function generateId() {
  return 'local_' + Math.random().toString(36).substr(2, 9)
}

/** Same shape and rules as the worker's /api/finance/stats (internal transfers excluded) */
function calculateFinanceStats(db: LocalSchema, month: string, compareDay = 0): FinanceStats {
  const txs = db.transactions
  const counted = (tx: Transaction) => tx.category !== 'transfer'
  let monthIncome = 0
  let monthExpense = 0
  const recentTransactions = [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15)

  const expenseByWalletMap = new Map<string, number>()
  const incomeByWalletMap = new Map<string, number>()

  txs.forEach(tx => {
    if (tx.date.startsWith(month) && counted(tx)) {
      if (tx.type === 'income') {
        monthIncome += tx.amount
        incomeByWalletMap.set(tx.walletId, (incomeByWalletMap.get(tx.walletId) || 0) + tx.amount)
      } else {
        monthExpense += tx.amount
        expenseByWalletMap.set(tx.walletId, (expenseByWalletMap.get(tx.walletId) || 0) + tx.amount)
      }
    }
  })

  const categoryBreakdown = (prefix: string, type: 'income' | 'expense', maxDay = 0) => {
    const totals = new Map<string, { total: number; count: number }>()
    let sum = 0
    txs.forEach(tx => {
      if (!tx.date.startsWith(prefix) || tx.type !== type || !counted(tx)) return
      if (maxDay > 0 && parseInt(tx.date.substring(8, 10), 10) > maxDay) return
      const entry = totals.get(tx.category) || { total: 0, count: 0 }
      entry.total += tx.amount
      entry.count++
      totals.set(tx.category, entry)
      sum += tx.amount
    })
    return Array.from(totals.entries())
      .map(([category, { total, count }]) => ({ category, total, count, percentage: sum > 0 ? (total / sum) * 100 : 0, icon: '', color: '' }))
      .sort((a, b) => b.total - a.total)
  }

  const [year, mon] = month.split('-').map(Number)
  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`
  const dailySeries = (prefix: string) => {
    const [y, m] = prefix.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const series = Array.from({ length: days }, (_, i) => ({ date: `${prefix}-${String(i + 1).padStart(2, '0')}`, income: 0, expense: 0 }))
    txs.forEach(tx => {
      if (!counted(tx) || !tx.date.startsWith(prefix)) return
      const day = series[parseInt(tx.date.substring(8, 10), 10) - 1]
      if (day) day[tx.type === 'income' ? 'income' : 'expense'] += tx.amount
    })
    return series
  }
  const prevDaily = dailySeries(prevMonth)
  const toTotals = (list: { category: string; total: number }[]) => Object.fromEntries(list.map(c => [c.category, c.total]))

  // Mock weekly stats (last 7 days)
  const weeklyStats = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    let dayInc = 0
    let dayExp = 0
    txs.forEach(tx => {
      if (tx.date.startsWith(dateStr)) {
        if (tx.type === 'income') dayInc += tx.amount
        else dayExp += tx.amount
      }
    })
    return { date: dateStr, income: dayInc, expense: dayExp, net: dayInc - dayExp }
  })

  return {
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
    weeklyStats,
    expenseByCategory: categoryBreakdown(month, 'expense'),
    incomeByCategory: categoryBreakdown(month, 'income'),
    expenseByWallet: Array.from(expenseByWalletMap.entries()).map(([walletId, amount]) => ({ walletId, amount, total: amount, percentage: amount / monthExpense * 100 || 0 })),
    incomeByWallet: Array.from(incomeByWalletMap.entries()).map(([walletId, amount]) => ({ walletId, amount, total: amount, percentage: amount / monthIncome * 100 || 0 })),
    recentTransactions,
    daily: dailySeries(month),
    prevDaily,
    prevMonthIncome: prevDaily.reduce((s, d) => s + d.income, 0),
    prevMonthExpense: prevDaily.reduce((s, d) => s + d.expense, 0),
    prevCategoryTotals: {
      expense: toTotals(categoryBreakdown(prevMonth, 'expense', compareDay)),
      income: toTotals(categoryBreakdown(prevMonth, 'income', compareDay))
    }
  }
}

export const localDbMock = async (method: string, url: string, body?: any) => {
  const db = getDb()
  const parsedUrl = new URL(url, window.location.origin)
  const path = parsedUrl.pathname

  const sendResponse = (data: any) => ({ success: true, data })

  // ── WALLETS ──
  if (path === '/api/wallets') {
    if (method === 'GET') {
      return sendResponse(db.wallets)
    }
    if (method === 'POST') {
      const w = { ...body, id: generateId(), createdAt: new Date().toISOString() }
      db.wallets.push(w)
      saveDb(db)
      return sendResponse(w)
    }
  }
  if (path.startsWith('/api/wallets/') && method === 'PUT') {
    const id = path.split('/').pop()
    const idx = db.wallets.findIndex(w => w.id === id)
    if (idx !== -1) {
      db.wallets[idx] = { ...db.wallets[idx], ...body }
      saveDb(db)
      return sendResponse(db.wallets[idx])
    }
  }
  if (path.startsWith('/api/wallets/') && method === 'DELETE') {
    const id = path.split('/').pop()
    db.wallets = db.wallets.filter(w => w.id !== id)
    saveDb(db)
    return sendResponse({ success: true })
  }

  // ── TRANSACTIONS ──
  if (path === '/api/transactions') {
    if (method === 'GET') {
      const page = parseInt(parsedUrl.searchParams.get('page') || '1')
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '15')
      const type = parsedUrl.searchParams.get('type')
      const walletId = parsedUrl.searchParams.get('walletId')

      let filtered = [...db.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      if (type && type !== 'all') filtered = filtered.filter(t => t.type === type)
      if (walletId) filtered = filtered.filter(t => t.walletId === walletId)
      const category = parsedUrl.searchParams.get('category')
      if (category) filtered = filtered.filter(t => t.category === category)

      return {
        success: true,
        data: filtered.slice((page - 1) * limit, page * limit),
        total: filtered.length,
        page,
        limit
      }
    }
    if (method === 'POST') {
      const t = { ...body, id: generateId(), createdAt: new Date().toISOString() }
      db.transactions.push(t)
      // Update wallet balance
      const wIdx = db.wallets.findIndex(w => w.id === t.walletId)
      if (wIdx !== -1) {
        db.wallets[wIdx].balance += t.type === 'income' ? t.amount : -t.amount
      }
      saveDb(db)
      return sendResponse(t)
    }
  }
  if (path === '/api/transactions/clear' && method === 'POST') {
    // Same contract as the worker: delete history in [from, to], keep wallet balances
    const { from, to, dryRun } = body || {}
    const inRange = (t: Transaction) => t.date >= from && t.date <= to
    const count = db.transactions.filter(inRange).length
    if (!dryRun && count > 0) {
      db.transactions = db.transactions.filter(t => !inRange(t))
      saveDb(db)
    }
    return sendResponse({ count, deleted: dryRun ? 0 : count })
  }
  if (path.startsWith('/api/transactions/') && method === 'DELETE') {
    const id = path.split('/').pop()
    const tIdx = db.transactions.findIndex(t => t.id === id)
    if (tIdx !== -1) {
      const t = db.transactions[tIdx]
      // Revert wallet balance
      const wIdx = db.wallets.findIndex(w => w.id === t.walletId)
      if (wIdx !== -1) {
        db.wallets[wIdx].balance -= t.type === 'income' ? t.amount : -t.amount
      }
      db.transactions.splice(tIdx, 1)
      saveDb(db)
    }
    return sendResponse({ success: true })
  }

  // ── QUICK-ADD PREFS ──
  if (path === '/api/quick-add/prefs') {
    const defaults = {
      enabled: false,
      type: 'expense',
      walletId: null,
      categories: { income: 'salary', expense: 'food' },
      updatedAt: ''
    }
    if (method === 'GET') return sendResponse({ ...defaults, ...db.quickAdd })
    if (method === 'PUT') {
      db.quickAdd = { ...defaults, ...db.quickAdd, ...body, updatedAt: new Date().toISOString() }
      saveDb(db)
      return sendResponse(db.quickAdd)
    }
  }

  // ── FINANCE STATS ──
  if (path === '/api/finance/stats' && method === 'GET') {
    const month = parsedUrl.searchParams.get('month') || new Date().toISOString().substring(0, 7)
    const compareDay = parseInt(parsedUrl.searchParams.get('compareDay') || '0', 10)
    return sendResponse(calculateFinanceStats(db, month, compareDay))
  }

  // ── REMINDERS ──
  if (path === '/api/reminders') {
    if (method === 'GET') return sendResponse(db.reminders)
    if (method === 'POST') {
      const r = { ...body, id: generateId(), createdAt: new Date().toISOString() }
      db.reminders.push(r)
      saveDb(db)
      return sendResponse(r)
    }
  }
  if (path.startsWith('/api/reminders/') && method === 'PUT') {
    const id = path.split('/').pop()
    const idx = db.reminders.findIndex(r => r.id === id)
    if (idx !== -1) {
      db.reminders[idx] = { ...db.reminders[idx], ...body }
      saveDb(db)
      return sendResponse(db.reminders[idx])
    }
  }
  if (path.startsWith('/api/reminders/') && method === 'DELETE') {
    const id = path.split('/').pop()
    db.reminders = db.reminders.filter(r => r.id !== id)
    saveDb(db)
    return sendResponse({ success: true })
  }

  // ── NOTES ──
  if (path === '/api/notes') {
    // Same list shape as the worker's notes index (plain-text excerpt, no full content)
    if (method === 'GET') {
      return sendResponse(db.notes.map(({ content, isPublic: _p, sharedWith: _s, ...rest }) => ({ ...rest, ...deriveNoteText(content) })))
    }
    if (method === 'POST') {
      const n = { title: '', content: '', tags: [], pinned: false, ...body, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      db.notes.push(n)
      saveDb(db)
      return sendResponse(n)
    }
  }
  if (path === '/api/notes/tags/delete' && method === 'POST') {
    const removeAll = body?.all === true
    const doomed = new Set<string>(Array.isArray(body?.tags) ? body.tags : [])
    const shouldRemove = (tag: string) => removeAll || doomed.has(tag)
    let updated = 0
    db.notes.forEach(n => {
      if (n.tags.some(shouldRemove)) {
        n.tags = n.tags.filter(tag => !shouldRemove(tag))
        updated++
      }
    })
    saveDb(db)
    return sendResponse({ updated })
  }
  if (path.startsWith('/api/notes/') && method === 'GET') {
    const id = path.split('/').pop()
    const n = db.notes.find(x => x.id === id)
    return sendResponse(n)
  }
  if (path.startsWith('/api/notes/') && method === 'PUT') {
    const id = path.split('/').pop()
    const idx = db.notes.findIndex(r => r.id === id)
    if (idx !== -1) {
      const { baseUpdatedAt: _base, force: _force, ...updates } = body || {}
      db.notes[idx] = { ...db.notes[idx], ...updates, updatedAt: new Date().toISOString() }
      saveDb(db)
      return sendResponse(db.notes[idx])
    }
  }
  if (path.startsWith('/api/notes/') && method === 'DELETE') {
    const id = path.split('/').pop()
    db.notes = db.notes.filter(r => r.id !== id)
    saveDb(db)
    return sendResponse({ success: true })
  }

  // ── STOCKS ──
  if (path === '/api/stocks') {
    if (method === 'GET') return sendResponse(db.stocks)
    if (method === 'POST') {
      const s = { ...body, id: generateId() }
      db.stocks.push(s)
      saveDb(db)
      return sendResponse(s)
    }
  }
  if (path.startsWith('/api/stocks/') && method === 'PUT') {
    const id = path.split('/').pop()
    const idx = db.stocks.findIndex(r => r.id === id)
    if (idx !== -1) {
      db.stocks[idx] = { ...db.stocks[idx], ...body }
      saveDb(db)
      return sendResponse(db.stocks[idx])
    }
  }
  if (path.startsWith('/api/stocks/') && method === 'DELETE') {
    const id = path.split('/').pop()
    db.stocks = db.stocks.filter(r => r.id !== id)
    saveDb(db)
    return sendResponse({ success: true })
  }

  // ── FUNDS ──
  if (path === '/api/funds') {
    if (method === 'GET') return sendResponse(db.funds)
    if (method === 'POST') {
      const f = { ...body, id: generateId() }
      db.funds.push(f)
      saveDb(db)
      return sendResponse(f)
    }
  }
  if (path.startsWith('/api/funds/') && method === 'PUT') {
    const id = path.split('/').pop()
    const idx = db.funds.findIndex(r => r.id === id)
    if (idx !== -1) {
      db.funds[idx] = { ...db.funds[idx], ...body }
      saveDb(db)
      return sendResponse(db.funds[idx])
    }
  }
  if (path.startsWith('/api/funds/') && method === 'DELETE') {
    const id = path.split('/').pop()
    db.funds = db.funds.filter(r => r.id !== id)
    saveDb(db)
    return sendResponse({ success: true })
  }

  // Fallback for missing mocks
  console.warn(`[LocalDB Mock] Unhandled route: ${method} ${path}`)
  return sendResponse(null)
}
