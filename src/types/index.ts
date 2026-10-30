// ── User & Auth ──

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  createdAt: string
  hasCompletedOnboarding?: boolean
  disableLargeTransferConfirmation?: boolean
}

// ── Notes ──

export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  isPublic?: boolean
  sharedWith?: string[]
  createdAt: string
  updatedAt: string
}

export interface NoteListItem {
  id: string
  title: string
  /** Plain-text preview */
  excerpt: string
  /** Plain-text body prefix used for full-text search */
  text?: string
  wordCount?: number
  hasImages?: boolean
  tags: string[]
  pinned: boolean
  createdAt?: string
  updatedAt: string
}

export type NoteFilter = 'all' | 'pinned' | 'recent'
export type NoteSort = 'updated' | 'created' | 'title'
export type ViewMode = 'grid' | 'list'

// ── Finance: Wallets ──

export interface Wallet {
  id: string
  name: string
  balance: number
  currency: string
  icon: string
  color: string
  order: number
  customLogoUrl?: string
}

// ── Finance: Transactions ──

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: string
  note: string
  walletId: string
  source: 'manual' | 'telegram' | 'notification' | 'sms'
  date: string
  createdAt: string
}

export interface TransactionFilter {
  type?: TransactionType | 'all'
  walletId?: string
  category?: string
  dateFrom?: string
  dateTo?: string
}

// ── Finance: Stats ──

export interface CategoryStat {
  category: string
  total: number
  count: number
  percentage: number
  icon: string
  color: string
}

export interface DailyStat {
  date: string
  income: number
  expense: number
  net: number
}

export interface WalletStat {
  walletId: string
  total: number
  percentage: number
}

export interface FinanceStats {
  monthIncome: number
  monthExpense: number
  monthNet: number
  weeklyStats: DailyStat[]
  expenseByCategory: CategoryStat[]
  expenseByWallet: WalletStat[]
  incomeByWallet: WalletStat[]
  recentTransactions: Transaction[]
}

// ── Finance: Categories ──

export interface CategoryConfig {
  key: string
  label: string
  icon: string
  color: string
  type: TransactionType | 'both'
}

// ── API ──

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedApiResponse<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  limit: number
  error?: string
}

// ── Re-exports ──
export type { RecurringTransaction, RecurringFrequency } from './recurring'
export type { BudgetGoal, CategoryBudget } from './budget'
export type { SavingsGoal } from './savings'
export type { Debt, DebtType, DebtStatus } from './debt'
export type { FundPosition } from './fund'

export interface StockAlert {
  id: string
  symbol: string
  targetPrice: number
  direction: 'above' | 'below'
  label: string
  triggered: boolean
  notifiedAt?: string
  createdAt: string
}

export interface StockPosition {
  id: string
  symbol: string
  buyPrice: number
  quantity: number
  targetProfit?: number
  stopLoss?: number
  alerts?: StockAlert[]
  createdAt: string
  updatedAt: string
}

export interface Reminder {
  id: string
  title: string
  description: string
  url?: string
  eventDate: string
  remindAt: string[]
  offsets: string[]
  customRemindAt?: string
  repeatInterval?: string
  notifiedAt: string[]
  acknowledged: boolean
  lastChanceSent: boolean
  sourceType: 'note' | 'manual' | 'debt' | 'recurring'
  sourceId?: string
  status: 'active' | 'completed' | 'expired'
  createdAt: string
  updatedAt: string
}

export interface ReminderSuggestion {
  title: string
  eventDate: string
  description: string
  url?: string
}

export interface PendingTransfer {
  id: string
  transactionId: string
  amount: number
  walletId: string
  walletName: string
  note: string
  date: string
  createdAt: string
  status: 'pending' | 'resolved'
}

