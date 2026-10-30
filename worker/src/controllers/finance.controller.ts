import { Env, UserData, NoteData, TransactionData, WalletData, NotificationData, PendingNotification, BudgetData, PendingTransfer } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId, hashPassword } from '../utils/crypto'
import { createJWT } from '../utils/jwt'
import { getJSON, putJSON } from '../services/kv.service'

// ====== Finance Handlers ======

export async function handleListWallets(userId: string, env: Env): Promise<Response> {
  const wallets =
    (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []
  return jsonResponse({ success: true, data: wallets })
}

export async function handleCreateWallet(
  userId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const body = (await request.json()) as any
  const wallets =
    (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []

  const wallet: WalletData = {
    id: generateId(),
    name: body.name,
    balance: body.balance || 0,
    currency: body.currency || 'VND',
    icon: body.icon || '💰',
    color: body.color || '#10b981',
    order: wallets.length,
    customLogoUrl: typeof body.customLogoUrl === 'string' ? body.customLogoUrl.substring(0, 5000) : undefined
  }

  wallets.push(wallet)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)
  return jsonResponse({ success: true, data: wallet }, 201)
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
  if (typeof body.balance === 'number') wallets[idx].balance = body.balance
  if (body.customLogoUrl !== undefined) wallets[idx].customLogoUrl = typeof body.customLogoUrl === 'string' ? body.customLogoUrl.substring(0, 5000) : undefined
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)
  return jsonResponse({ success: true, data: wallets[idx] })
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

  // Filter
  let filtered = txs
  if (typeFilter && typeFilter !== 'all') {
    filtered = filtered.filter(t => t.type === typeFilter)
  }
  if (walletIdFilter) {
    filtered = filtered.filter(t => t.walletId === walletIdFilter)
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
  const wallets = (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []

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

  // Expense by category
  const expenseMap: Record<string, number> = {}
  let totalExpense = 0
  monthTransactions.filter(t => t.type === 'expense' && t.category !== 'transfer').forEach(t => {
    expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount
    totalExpense += t.amount
  })
  
  const expenseByCategory = Object.entries(expenseMap).map(([category, amount]) => {
    return {
      category,
      total: amount,
      count: monthTransactions.filter(t => t.type === 'expense' && t.category === category).length,
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
    }
  }).sort((a, b) => b.total - a.total)

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
      expenseByWallet,
      incomeByWallet,
      recentTransactions
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
    const targetWalletName = wallets.find(w => w.id === body.targetWalletId)?.name || 'Ví nhận'

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



