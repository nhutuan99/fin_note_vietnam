import { Env, UserData, TransactionData, WalletData, BudgetData, QuickAddPrefs, PendingTransfer, GoldHolding, GoldPrices } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'
import { getGoldPrices, goldValue } from '../services/gold-price.service'

// ====== Finance Handlers ======

/** Validate a gold holding from a request body; null when invalid */
function parseGoldHolding(raw: any): GoldHolding | null {
  if (!raw || typeof raw.type !== 'string' || !raw.type.trim()) return null
  const qty = Number(raw.qtyChi)
  if (!isFinite(qty) || qty < 0 || qty > 1_000_000) return null
  return { type: raw.type.trim().substring(0, 20), qtyChi: Math.round(qty * 100) / 100 }
}

/**
 * Gold wallets carry a quantity, not money: their balance is quantity × today's buy-back price.
 * When no price is available the last computed balance is kept.
 */
function valueGoldWallet(w: WalletData, prices: GoldPrices | null) {
  if (w.kind !== 'gold' || !w.gold) return w
  const item = prices?.items.find((i) => i.code === w.gold!.type)
  const value = goldValue(prices, w.gold.type, w.gold.qtyChi)
  return {
    ...w,
    balance: value ?? w.balance,
    goldPrice: item
      ? { name: item.name, buy: item.buy, sell: item.sell, updatedAt: prices!.updatedAt, source: prices!.source, stale: !!prices!.stale }
      : null
  }
}

export async function handleListWallets(userId: string, env: Env): Promise<Response> {
  const wallets =
    (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []
  const prices = wallets.some((w) => w.kind === 'gold') ? await getGoldPrices(env) : null
  return jsonResponse({ success: true, data: wallets.map((w) => valueGoldWallet(w, prices)) })
}

export async function handleGetGoldPrices(request: Request, env: Env): Promise<Response> {
  const force = new URL(request.url).searchParams.get('force') === '1'
  const prices = await getGoldPrices(env, force)
  if (!prices) return errorResponse('Không lấy được giá vàng, thử lại sau', 502)
  return jsonResponse({ success: true, data: prices })
}

export async function handleCreateWallet(
  userId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const body = (await request.json()) as any
  const wallets =
    (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []

  const gold = body.kind === 'gold' ? parseGoldHolding(body.gold) : null
  if (body.kind === 'gold' && !gold) return errorResponse('Thông tin vàng không hợp lệ')
  const prices = gold ? await getGoldPrices(env) : null

  const wallet: WalletData = {
    id: generateId(),
    name: body.name,
    balance: gold ? goldValue(prices, gold.type, gold.qtyChi) ?? 0 : body.balance || 0,
    currency: body.currency || 'VND',
    icon: body.icon || '💰',
    color: body.color || '#10b981',
    order: wallets.length,
    customLogoUrl: typeof body.customLogoUrl === 'string' ? body.customLogoUrl.substring(0, 5000) : undefined,
    ...(gold ? { kind: 'gold' as const, gold } : {})
  }

  wallets.push(wallet)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)
  return jsonResponse({ success: true, data: valueGoldWallet(wallet, prices) }, 201)
}

export async function handleUpdateWallet(
  userId: string,
  walletId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const wallets =
    (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []
  const idx = wallets.findIndex((w) => w.id === walletId)
  if (idx === -1) return errorResponse('Wallet not found', 404)

  const body = (await request.json()) as any
  // Whitelist editable fields only — prevent direct balance/id manipulation
  if (body.name !== undefined) wallets[idx].name = body.name
  if (body.currency !== undefined) wallets[idx].currency = body.currency
  if (body.icon !== undefined) wallets[idx].icon = body.icon
  if (body.color !== undefined) wallets[idx].color = body.color
  if (typeof body.order === 'number') wallets[idx].order = body.order
  if (body.customLogoUrl !== undefined) wallets[idx].customLogoUrl = typeof body.customLogoUrl === 'string' ? body.customLogoUrl.substring(0, 5000) : undefined

  let prices: GoldPrices | null = null
  if (wallets[idx].kind === 'gold') {
    // Gold wallets change by quantity; the money value always comes from the price board
    if (body.gold !== undefined) {
      const gold = parseGoldHolding(body.gold)
      if (!gold) return errorResponse('Thông tin vàng không hợp lệ')
      wallets[idx].gold = gold
    }
    prices = await getGoldPrices(env)
    wallets[idx].balance = goldValue(prices, wallets[idx].gold!.type, wallets[idx].gold!.qtyChi) ?? wallets[idx].balance
  } else if (typeof body.balance === 'number') {
    wallets[idx].balance = body.balance
  }
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)
  return jsonResponse({ success: true, data: valueGoldWallet(wallets[idx], prices) })
}

export async function handleDeleteWallet(
  userId: string,
  walletId: string,
  env: Env
): Promise<Response> {
  const wallets =
    (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []
  const filtered = wallets.filter((w) => w.id !== walletId)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, filtered)
  return jsonResponse({ success: true })
}

export async function handleListTransactions(userId: string, request: Request, env: Env): Promise<Response> {
  const txs =
    (await getJSON<TransactionData[]>(
      env.SMART_NOTE_KV,
      `users/${userId}/finance/transactions`
    )) || []

  const url = new URL(request.url)
  const pageStr = url.searchParams.get('page')
  const limitStr = url.searchParams.get('limit')
  const typeFilter = url.searchParams.get('type')
  const walletIdFilter = url.searchParams.get('walletId')
  const categoryFilter = url.searchParams.get('category')

  // Filter
  let filtered = txs
  if (typeFilter && typeFilter !== 'all') {
    filtered = filtered.filter(t => t.type === typeFilter)
  }
  if (walletIdFilter) {
    filtered = filtered.filter(t => t.walletId === walletIdFilter)
  }
  if (categoryFilter) {
    filtered = filtered.filter(t => t.category === categoryFilter)
  }

  // Sort by date desc, then createdAt desc
  filtered.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date)
    if (dateDiff !== 0) return dateDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Pagination
  if (pageStr && limitStr) {
    const page = parseInt(pageStr, 10) || 1
    const limit = parseInt(limitStr, 10) || 15
    const total = filtered.length
    const start = (page - 1) * limit
    const paginated = filtered.slice(start, start + limit)
    
    return jsonResponse({
      success: true,
      data: paginated,
      total,
      page,
      limit
    })
  }

  // Fallback if no pagination requested (backward compatibility)
  return jsonResponse({ success: true, data: filtered })
}

export async function handleGetFinanceStats(userId: string, request: Request, env: Env): Promise<Response> {
  const txs = (await getJSON<TransactionData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`)) || []

  const url = new URL(request.url)
  let month = url.searchParams.get('month')
  if (!month) {
    const d = new Date()
    month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const monthTransactions = txs.filter(t => t.date.startsWith(month!))

  const monthIncome = monthTransactions.filter(t => t.type === 'income' && t.category !== 'transfer').reduce((sum, t) => sum + t.amount, 0)
  const monthExpense = monthTransactions.filter(t => t.type === 'expense' && t.category !== 'transfer').reduce((sum, t) => sum + t.amount, 0)

  // Weekly stats (last 7 days)
  const weeklyStats = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().substring(0, 10)
    const dayTx = txs.filter((t) => t.date === dateStr)
    const income = dayTx.filter((t) => t.type === 'income' && t.category !== 'transfer').reduce((s, t) => s + t.amount, 0)
    const expense = dayTx.filter((t) => t.type === 'expense' && t.category !== 'transfer').reduce((s, t) => s + t.amount, 0)
    weeklyStats.push({
      date: dateStr,
      income,
      expense,
      net: income - expense
    })
  }

  // Internal transfers move money between wallets: they are neither income nor spending
  const counted = (t: TransactionData) => t.category !== 'transfer'

  // Spending / income by category (share of the month, number of transactions)
  const categoryBreakdown = (list: TransactionData[], type: 'income' | 'expense') => {
    const totals: Record<string, { total: number; count: number }> = {}
    let sum = 0
    list.filter(t => t.type === type && counted(t)).forEach(t => {
      const entry = (totals[t.category] ||= { total: 0, count: 0 })
      entry.total += t.amount
      entry.count++
      sum += t.amount
    })
    return Object.entries(totals)
      .map(([category, { total, count }]) => ({ category, total, count, percentage: sum > 0 ? (total / sum) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)
  }

  const expenseByCategory = categoryBreakdown(monthTransactions, 'expense')
  const incomeByCategory = categoryBreakdown(monthTransactions, 'income')

  // ── Month-over-month comparison data ──
  // Transaction dates are the user's local calendar dates (YYYY-MM-DD), so the series are
  // built from date strings only — no server "today", no timezone shift.
  const [year, mon] = month.split('-').map(Number)
  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`
  const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

  const dailySeries = (prefix: string, days: number) => {
    const series = Array.from({ length: days }, (_, i) => ({
      date: `${prefix}-${String(i + 1).padStart(2, '0')}`,
      income: 0,
      expense: 0
    }))
    txs.forEach(t => {
      if (!counted(t) || !t.date.startsWith(prefix)) return
      const day = series[parseInt(t.date.substring(8, 10), 10) - 1]
      if (day) day[t.type === 'income' ? 'income' : 'expense'] += t.amount
    })
    return series
  }

  const daily = dailySeries(month, daysInMonth(year, mon))
  const [prevYear, prevMon] = prevMonth.split('-').map(Number)
  const prevDaily = dailySeries(prevMonth, daysInMonth(prevYear, prevMon))
  // While a month is in progress the client sends today's day-of-month, so categories are
  // compared with the same stretch of last month instead of the whole month.
  const compareDay = parseInt(url.searchParams.get('compareDay') || '0', 10)
  const prevMonthTransactions = txs.filter(
    t => t.date.startsWith(prevMonth) && (!(compareDay > 0) || parseInt(t.date.substring(8, 10), 10) <= compareDay)
  )
  const toTotals = (list: { category: string; total: number }[]) =>
    Object.fromEntries(list.map(c => [c.category, c.total]))
  const prevCategoryTotals = {
    expense: toTotals(categoryBreakdown(prevMonthTransactions, 'expense')),
    income: toTotals(categoryBreakdown(prevMonthTransactions, 'income'))
  }

  // Wallet Breakdown
  const expenseWalletMap: Record<string, number> = {}
  let totalWalletExpense = 0
  monthTransactions.filter(t => t.type === 'expense' && t.category !== 'transfer').forEach(t => {
    expenseWalletMap[t.walletId] = (expenseWalletMap[t.walletId] || 0) + t.amount
    totalWalletExpense += t.amount
  })
  const expenseByWallet = Object.entries(expenseWalletMap).map(([walletId, amount]) => ({
    walletId,
    total: amount,
    percentage: totalWalletExpense > 0 ? (amount / totalWalletExpense) * 100 : 0
  })).sort((a, b) => b.total - a.total)

  const incomeWalletMap: Record<string, number> = {}
  let totalWalletIncome = 0
  monthTransactions.filter(t => t.type === 'income' && t.category !== 'transfer').forEach(t => {
    incomeWalletMap[t.walletId] = (incomeWalletMap[t.walletId] || 0) + t.amount
    totalWalletIncome += t.amount
  })
  const incomeByWallet = Object.entries(incomeWalletMap).map(([walletId, amount]) => ({
    walletId,
    total: amount,
    percentage: totalWalletIncome > 0 ? (amount / totalWalletIncome) * 100 : 0
  })).sort((a, b) => b.total - a.total)


  // Recent transactions (last 10)
  const recentTransactions = [...txs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  return jsonResponse({
    success: true,
    data: {
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense,
      weeklyStats,
      expenseByCategory,
      incomeByCategory,
      expenseByWallet,
      incomeByWallet,
      recentTransactions,
      daily,
      prevDaily,
      prevMonthIncome: prevDaily.reduce((s, d) => s + d.income, 0),
      prevMonthExpense: prevDaily.reduce((s, d) => s + d.expense, 0),
      prevCategoryTotals
    }
  })
}

export async function handleCreateTransaction(
  userId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const body = (await request.json()) as any

  // Input validation
  if (!body.type || !['income', 'expense'].includes(body.type)) {
    return errorResponse('Loại giao dịch không hợp lệ (income/expense)')
  }
  if (typeof body.amount !== 'number' || body.amount <= 0 || !isFinite(body.amount)) {
    return errorResponse('Số tiền phải là số dương hợp lệ')
  }
  if (!body.walletId || typeof body.walletId !== 'string') {
    return errorResponse('Wallet ID is required')
  }

  const txs =
    (await getJSON<TransactionData[]>(
      env.SMART_NOTE_KV,
      `users/${userId}/finance/transactions`
    )) || []
  const wallets =
    (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []

  if (wallets.find((w) => w.id === body.walletId)?.kind === 'gold') {
    return errorResponse('Ví vàng không ghi giao dịch tiền — hãy sửa số lượng vàng')
  }

  const tx: TransactionData = {
    id: generateId(),
    type: body.type,
    amount: Math.abs(body.amount),
    category: body.category || (body.type === 'expense' ? 'other_expense' : 'other_income'),
    note: typeof body.note === 'string' ? body.note.substring(0, 500) : '',
    walletId: body.walletId,
    source: body.source || 'manual',
    date: body.date || new Date().toISOString().substring(0, 10),
    createdAt: new Date().toISOString()
  }

  txs.push(tx)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`, txs)

  // Update wallet balance
  const walletIdx = wallets.findIndex((w) => w.id === tx.walletId)
  if (walletIdx !== -1) {
    wallets[walletIdx].balance += tx.type === 'income' ? tx.amount : -tx.amount
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)
  }

  return jsonResponse({ success: true, data: tx }, 201)
}

export async function handleDeleteTransaction(
  userId: string,
  txId: string,
  env: Env
): Promise<Response> {
  const txs =
    (await getJSON<TransactionData[]>(
      env.SMART_NOTE_KV,
      `users/${userId}/finance/transactions`
    )) || []
  const wallets =
    (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []

  const tx = txs.find((t) => t.id === txId)
  if (tx) {
    // Revert wallet balance
    const walletIdx = wallets.findIndex((w) => w.id === tx.walletId)
    if (walletIdx !== -1) {
      wallets[walletIdx].balance += tx.type === 'income' ? -tx.amount : tx.amount
      await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)
    }
  }

  const filtered = txs.filter((t) => t.id !== txId)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`, filtered)

  return jsonResponse({ success: true })
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Bulk-delete transaction history (income + expense) within [from, to] (inclusive, YYYY-MM-DD).
 * Wallet balances are intentionally kept as-is: this clears the log, not the money.
 * With dryRun=true only returns the number of matching transactions.
 */
export async function handleClearTransactions(
  userId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const body = (await request.json()) as { from?: unknown; to?: unknown; dryRun?: unknown }
  const from = typeof body.from === 'string' ? body.from : ''
  const to = typeof body.to === 'string' ? body.to : ''
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return errorResponse('Khoảng thời gian không hợp lệ (from/to: YYYY-MM-DD)')
  }

  const txKey = `users/${userId}/finance/transactions`
  const txs = (await getJSON<TransactionData[]>(env.SMART_NOTE_KV, txKey)) || []
  const inRange = (date: string) => date >= from && date <= to
  const removedIds = new Set(txs.filter((t) => inRange(t.date)).map((t) => t.id))

  if (body.dryRun === true || removedIds.size === 0) {
    return jsonResponse({ success: true, data: { count: removedIds.size, deleted: 0 } })
  }

  await putJSON(env.SMART_NOTE_KV, txKey, txs.filter((t) => !removedIds.has(t.id)))

  // Drop pending large-transfer confirmations that point at deleted transactions
  const ptKey = `users/${userId}/finance/pending_transfers`
  const pendingTransfers = (await getJSON<PendingTransfer[]>(env.SMART_NOTE_KV, ptKey)) || []
  const keptTransfers = pendingTransfers.filter((p) => !removedIds.has(p.transactionId))
  if (keptTransfers.length !== pendingTransfers.length) {
    await putJSON(env.SMART_NOTE_KV, ptKey, keptTransfers)
  }

  return jsonResponse({ success: true, data: { count: removedIds.size, deleted: removedIds.size } })
}

// ====== Quick-add Preferences ======

const QUICK_ADD_KEY = (userId: string) => `users/${userId}/quick_add`
const DEFAULT_QUICK_ADD: QuickAddPrefs = {
  enabled: false,
  type: 'expense',
  walletId: null,
  categories: { income: 'salary', expense: 'food' },
  updatedAt: ''
}
const CATEGORY_RE = /^[a-z_]{1,32}$/

export async function handleGetQuickAddPrefs(userId: string, env: Env): Promise<Response> {
  const stored = await getJSON<Partial<QuickAddPrefs>>(env.SMART_NOTE_KV, QUICK_ADD_KEY(userId))
  return jsonResponse({ success: true, data: { ...DEFAULT_QUICK_ADD, ...stored } })
}

/** Partial update: only fields present and valid in the body are changed. */
export async function handleUpdateQuickAddPrefs(userId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>
  const current = {
    ...DEFAULT_QUICK_ADD,
    ...(await getJSON<Partial<QuickAddPrefs>>(env.SMART_NOTE_KV, QUICK_ADD_KEY(userId)))
  }

  if (typeof body.enabled === 'boolean') current.enabled = body.enabled
  if (body.type === 'income' || body.type === 'expense') current.type = body.type
  if (body.walletId === null || (typeof body.walletId === 'string' && body.walletId.length <= 64)) {
    current.walletId = body.walletId as string | null
  }
  const categories = body.categories as Record<string, unknown> | undefined
  if (categories && typeof categories === 'object') {
    current.categories = { ...current.categories }
    for (const kind of ['income', 'expense'] as const) {
      const value = categories[kind]
      if (typeof value === 'string' && CATEGORY_RE.test(value)) current.categories[kind] = value
    }
  }
  current.updatedAt = new Date().toISOString()

  await putJSON(env.SMART_NOTE_KV, QUICK_ADD_KEY(userId), current)
  return jsonResponse({ success: true, data: current })
}

// ====== Budget Handlers ======


export async function handleGetBudget(userId: string, env: Env): Promise<Response> {
  const budget = await getJSON<BudgetData>(env.SMART_NOTE_KV, `users/${userId}/finance/budget`)
  return jsonResponse({ success: true, data: budget || { amount: 0, dismissed: false, updatedAt: '' } })
}

export async function handleUpdateBudget(userId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>
  const budget: BudgetData = {
    amount: typeof body.amount === 'number' ? body.amount : 0,
    dismissed: !!body.dismissed,
    updatedAt: new Date().toISOString()
  }
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/budget`, budget)
  return jsonResponse({ success: true, data: budget })
}

// ====== Pending Transfers Handlers ======

export async function handleListPendingTransfers(userId: string, env: Env): Promise<Response> {
  const pending = (await getJSON<PendingTransfer[]>(
    env.SMART_NOTE_KV,
    `users/${userId}/finance/pending_transfers`
  )) || []
  // Trả về các giao dịch chưa xử lý (pending)
  const active = pending.filter(p => p.status === 'pending')
  return jsonResponse({ success: true, data: active })
}

export async function handleResolvePendingTransfer(
  userId: string,
  pendingId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const body = (await request.json()) as { isTransfer: boolean; targetWalletId?: string; amount?: number; disableFuture?: boolean }
  const pending = (await getJSON<PendingTransfer[]>(
    env.SMART_NOTE_KV,
    `users/${userId}/finance/pending_transfers`
  )) || []

  const idx = pending.findIndex(p => p.id === pendingId)
  if (idx === -1) {
    return errorResponse('Pending transfer not found', 404)
  }

  const record = pending[idx]
  record.status = 'resolved'
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/pending_transfers`, pending)

  const txs = (await getJSON<TransactionData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`)) || []
  const wallets = (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []

  // Tìm giao dịch chi gốc
  const txIdx = txs.findIndex(t => t.id === record.transactionId)

  if (body.isTransfer && body.targetWalletId) {
    // 1. Chuyển category của giao dịch gốc sang 'transfer' để không bị tính vào chi tiêu
    if (txIdx !== -1) {
      txs[txIdx].category = 'transfer'
      txs[txIdx].note = `[Chuyển khoản nội bộ] ${txs[txIdx].note}`
    }

    // 2. Tạo giao dịch nhận tiền (income, category 'transfer') vào ví nhận
    const transferAmount = typeof body.amount === 'number' && body.amount > 0 ? body.amount : record.amount
    const now = new Date().toISOString()

    const incomeTx: TransactionData = {
      id: generateId(),
      type: 'income',
      amount: transferAmount,
      category: 'transfer',
      note: `[Nhận chuyển khoản nội bộ từ ${record.walletName}] ${record.note}`,
      walletId: body.targetWalletId,
      source: 'manual',
      date: record.date || now.substring(0, 10),
      createdAt: now
    }
    txs.push(incomeTx)
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`, txs)

    // 3. Cộng số dư cho ví nhận
    const targetIdx = wallets.findIndex(w => w.id === body.targetWalletId)
    if (targetIdx !== -1) {
      wallets[targetIdx].balance += transferAmount
      await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)
    }
  }

  // 4. Lưu tùy chọn tắt tính năng xác nhận này nếu user chọn
  if (body.disableFuture) {
    const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
    if (user) {
      user.disableLargeTransferConfirmation = true
      await putJSON(env.SMART_NOTE_KV, `users/${userId}/profile`, user)
    }
  }

  return jsonResponse({ success: true, message: 'Resolved successfully' })
}



