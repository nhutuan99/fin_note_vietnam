import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Wallet,
  Transaction,
  TransactionFilter,
  CategoryStat,
  DailyStat,
  FinanceStats,
  PendingTransfer
} from '@/types'
import { getCategoryConfig } from '@/constants/finance'
import { httpClient } from '@/shared/api/httpClient'
import { AUTH_TOKEN_KEY } from '@/constants/auth'

/** Quick check without importing auth store (avoids circular deps). */
function isLoggedIn() {
  return !!localStorage.getItem(AUTH_TOKEN_KEY)
}

/** AbortError is expected when httpClient cancels requests on 401 — not a real error. */
function isAbortError(err: unknown) {
  return err instanceof Error && (err.name === 'AbortError' || err.message === 'Session expired')
}

export const useFinanceStore = defineStore('finance', () => {
  // ── State ──

  const wallets = ref<Wallet[]>([])
  const pendingTransfers = ref<PendingTransfer[]>([])
  const loading = ref(false)
  const filter = ref<TransactionFilter>({ type: 'all' })
  const selectedMonth = ref(
    (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })()
  )

  const stats = ref<FinanceStats>({
    monthIncome: 0,
    monthExpense: 0,
    monthNet: 0,
    weeklyStats: [],
    expenseByCategory: [],
    expenseByWallet: [],
    incomeByWallet: [],
    recentTransactions: []
  })

  // ── Sync state (module-level, not reactive) ──
  let _lastFetchTime = 0
  const VISIBILITY_STALE_MS = 5_000 // 5 seconds — refresh when user returns to tab

  // ── Computed: Totals ──

  const totalBalance = computed(() => wallets.value.reduce((sum, w) => sum + w.balance, 0))

  const monthIncome = computed(() => stats.value.monthIncome)
  const monthExpense = computed(() => stats.value.monthExpense)
  const monthNet = computed(() => stats.value.monthNet)

  // ── Computed: Category Stats ──

  const expenseByCategoryThisMonth = computed<CategoryStat[]>(() => {
    return stats.value.expenseByCategory.map(s => {
      const cfg = getCategoryConfig(s.category)
      return {
        ...s,
        icon: cfg.icon,
        color: cfg.color
      }
    })
  })

  // ── Computed: Daily Stats (last 7 days) ──

  const weeklyStats = computed<DailyStat[]>(() => stats.value.weeklyStats)

  // ── Computed: Recent Transactions ──

  const recentTransactions = computed(() => stats.value.recentTransactions)

  // ── Pagination State ──
  const paginatedTransactions = ref<Transaction[]>([])
  const totalTransactions = ref(0)
  const pagination = ref({ page: 1, limit: 15 })

  // ── Actions: Fetch from API ──

  async function fetchWallets() {
    if (!isLoggedIn()) return
    try {
      const data = await httpClient.get<Wallet[]>('/api/wallets')
      if (data) {
        wallets.value = data.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      } else {
        wallets.value = []
      }
    } catch (err) {
      if (!isAbortError(err)) console.error('Failed to fetch wallets:', err)
    }
  }

  async function fetchStats() {
    if (!isLoggedIn()) return
    try {
      const data = await httpClient.get<FinanceStats>(`/api/finance/stats?month=${selectedMonth.value}`)
      if (data) {
        stats.value = data
      }
    } catch (err) {
      if (!isAbortError(err)) console.error('Failed to fetch stats:', err)
    }
  }

  async function fetchPaginatedTransactions() {
    if (!isLoggedIn()) return
    loading.value = true
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(pagination.value.page))
      qs.set('limit', String(pagination.value.limit))
      if (filter.value.type && filter.value.type !== 'all') qs.set('type', filter.value.type)
      if (filter.value.walletId) qs.set('walletId', filter.value.walletId)
      if (filter.value.category) qs.set('category', filter.value.category)

      // getPaginated preserves total/page/limit alongside data[]
      const res = await httpClient.getPaginated<Transaction>(`/api/transactions?${qs.toString()}`)
      paginatedTransactions.value = res.data
      totalTransactions.value = res.total
    } catch (err) {
      if (!isAbortError(err)) console.error('Failed to fetch paginated transactions:', err)
      paginatedTransactions.value = []
      totalTransactions.value = 0
    } finally {
      loading.value = false
    }
  }

  async function getExportTransactions(): Promise<Transaction[]> {
    try {
      const qs = new URLSearchParams()
      if (filter.value.type && filter.value.type !== 'all') qs.set('type', filter.value.type)
      if (filter.value.walletId) qs.set('walletId', filter.value.walletId)
      // No page/limit → backend returns all matching transactions
      const res = await httpClient.getPaginated<Transaction>(`/api/transactions?${qs.toString()}`)
      return res.data
    } catch (err) {
      console.error('Failed to fetch export transactions:', err)
      return []
    }
  }

  async function fetchAll() {
    loading.value = true
    try {
      await Promise.all([fetchWallets(), fetchStats()])
      _lastFetchTime = Date.now()
    } finally {
      loading.value = false
    }
  }

  /**
   * Silent background refresh — no loading spinner.
   * Used by polling and visibility-change handler.
   */
  async function silentRefresh() {
    if (!isLoggedIn()) return
    try {
      await Promise.all([fetchWallets(), fetchStats()])
      _lastFetchTime = Date.now()
    } catch (err) {
      if (!isAbortError(err)) console.error('silentRefresh error:', err)
    }
  }

  // ── Visibility-based sync ──

  /**
   * Refresh data when user returns to the tab.
   * No interval polling — API is only called on mount + tab focus.
   */
  function refreshOnVisible() {
    if (document.visibilityState === 'visible') {
      const isStale = Date.now() - _lastFetchTime > VISIBILITY_STALE_MS
      if (isStale) {
        silentRefresh()
      }
    }
  }

  /**
   * Reset all cached finance data.
   * MUST be called on logout to prevent data leakage between users.
   */
  function reset() {
    wallets.value = []
    stats.value = { monthIncome: 0, monthExpense: 0, monthNet: 0, weeklyStats: [], expenseByCategory: [], expenseByWallet: [], incomeByWallet: [], recentTransactions: [] }
    filter.value = { type: 'all' }
    selectedMonth.value = new Date().toISOString().substring(0, 7)
    _lastFetchTime = 0
  }

  // ── Actions: Wallets ──

  function getWallet(id: string) {
    return wallets.value.find((w) => w.id === id)
  }

  function getWalletName(id: string) {
    return getWallet(id)?.name || 'Unknown'
  }

  async function addWallet(data: Omit<Wallet, 'id'>) {
    try {
      const wallet = await httpClient.post<Wallet>('/api/wallets', data)
      if (wallet) wallets.value.push(wallet)
      return wallet
    } catch (err) {
      console.error('Failed to add wallet:', err)
      return null
    }
  }

  async function updateWallet(id: string, updates: Partial<Wallet>) {
    try {
      const updated = await httpClient.put<Wallet>(`/api/wallets/${id}`, updates)
      if (updated) {
        const idx = wallets.value.findIndex((w) => w.id === id)
        if (idx !== -1) wallets.value[idx] = updated
      }
    } catch (err) {
      console.error('Failed to update wallet:', err)
    }
  }

  async function deleteWallet(id: string) {
    try {
      await httpClient.del(`/api/wallets/${id}`)
      wallets.value = wallets.value.filter((w) => w.id !== id)
    } catch (err) {
      console.error('Failed to delete wallet:', err)
    }
  }

  // ── Actions: Transactions ──

  async function addTransaction(data: Omit<Transaction, 'id' | 'createdAt'>) {
    try {
      const tx = await httpClient.post<Transaction>('/api/transactions', data)
      if (tx) {
        // Eagerly update local wallet balance to bypass KV eventual consistency delay
        const wIdx = wallets.value.findIndex(w => w.id === tx.walletId)
        if (wIdx !== -1) {
          wallets.value[wIdx].balance += tx.type === 'income' ? tx.amount : -tx.amount
        }
        
        // Refresh wallets and stats from server in background
        fetchWallets().then(() => {
          _lastFetchTime = Date.now()
        })
        fetchStats()
        return tx
      }
    } catch (err) {
      console.error('Failed to add transaction:', err)
      return null
    }
  }

  async function deleteTransaction(id: string) {
    try {
      // Find in recentTransactions to revert balance locally before fetch
      const txToDelete = stats.value.recentTransactions.find(t => t.id === id)
      if (txToDelete) {
        const wIdx = wallets.value.findIndex(w => w.id === txToDelete.walletId)
        if (wIdx !== -1) {
          wallets.value[wIdx].balance -= txToDelete.type === 'income' ? txToDelete.amount : -txToDelete.amount
        }
      }
      
      await httpClient.del(`/api/transactions/${id}`)
      
      // Refresh wallets and stats from server in background
      fetchWallets().then(() => {
        _lastFetchTime = Date.now()
      })
      fetchStats()
    } catch (err) {
      console.error('Failed to delete transaction:', err)
    }
  }

  /**
   * Bulk-delete transaction history in [from, to] (YYYY-MM-DD, inclusive).
   * Wallet balances are kept; stats/list are refetched. dryRun only counts matches.
   */
  async function clearTransactions(from: string, to: string, dryRun = false) {
    try {
      const res = await httpClient.post<{ count: number; deleted: number }>(
        '/api/transactions/clear',
        { from, to, dryRun },
        { silent: dryRun }
      )
      if (!dryRun) {
        pagination.value.page = 1
        await Promise.all([fetchStats(), fetchPaginatedTransactions()])
      }
      return res
    } catch (err) {
      console.error('Failed to clear transactions:', err)
      return null
    }
  }

  async function fetchPendingTransfers() {
    if (!isLoggedIn()) return
    try {
      const data = await httpClient.get<PendingTransfer[]>('/api/finance/pending-transfers')
      pendingTransfers.value = data || []
    } catch (err) {
      if (!isAbortError(err)) console.error('Failed to fetch pending transfers:', err)
    }
  }

  async function resolvePendingTransfer(
    id: string,
    isTransfer: boolean,
    targetWalletId?: string,
    amount?: number,
    disableFuture?: boolean
  ) {
    try {
      await httpClient.post(`/api/finance/pending-transfers/${id}/resolve`, {
        isTransfer,
        targetWalletId,
        amount,
        disableFuture
      })
      // Cập nhật lại danh sách cục bộ
      pendingTransfers.value = pendingTransfers.value.filter(p => p.id !== id)
      // Refresh dữ liệu ví và stats
      await fetchAll()
    } catch (err) {
      console.error('Failed to resolve pending transfer:', err)
    }
  }


  return {
    wallets,
    stats,
    loading,
    filter,
    selectedMonth,
    paginatedTransactions,
    totalTransactions,
    pagination,
    totalBalance,
    monthIncome,
    monthExpense,
    monthNet,
    expenseByCategoryThisMonth,
    weeklyStats,
    recentTransactions,
    getWallet,
    getWalletName,
    addWallet,
    updateWallet,
    deleteWallet,
    addTransaction,
    deleteTransaction,
    clearTransactions,
    fetchWallets,
    fetchStats,
    fetchPaginatedTransactions,
    getExportTransactions,
    fetchAll,
    silentRefresh,
    refreshOnVisible,
    reset,
    pendingTransfers,
    fetchPendingTransfers,
    resolvePendingTransfer
  }
})
