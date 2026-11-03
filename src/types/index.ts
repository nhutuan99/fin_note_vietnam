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
  /** 'gold' wallets hold a quantity of gold; the server derives balance from the live price */
  kind?: 'cash' | 'gold'
  gold?: GoldHolding
  /** Price used for the current balance (response only, gold wallets) */
  goldPrice?: (GoldPriceItem & { updatedAt: string; source: string; stale: boolean }) | null
}

// ── Finance: Gold ──

export interface GoldHolding {
  /** Price-board product code ('SJC', 'N24K', '24K', '75' = 18K, ...) */
  type: string
  /** Quantity in chỉ (1 cây = 10 chỉ, 1 chỉ = 10 phân) */
  qtyChi: number
}

export interface GoldPriceItem {
  code: string
  name: string
  /** VND per chỉ the shop pays you */
  buy: number
  /** VND per chỉ the shop sells at (0 when not quoted) */
  sell: number
}

export interface GoldPrices {
  source: string
  updatedAt: string
  items: GoldPriceItem[]
  stale?: boolean
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
  source: 'manual' | 'telegram' | 'notification' | 'sms' | 'routine'
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

/** One calendar day of a month (transfers excluded) */
export interface DayTotals {
  date: string
  income: number
  expense: number
}

export interface FinanceStats {
  monthIncome: number
  monthExpense: number
  monthNet: number
  weeklyStats: DailyStat[]
  expenseByCategory: CategoryStat[]
  incomeByCategory?: CategoryStat[]
  expenseByWallet: WalletStat[]
  incomeByWallet: WalletStat[]
  recentTransactions: Transaction[]
  /** Every day of the selected month */
  daily?: DayTotals[]
  /** Every day of the month before, for month-over-month comparison */
  prevDaily?: DayTotals[]
  prevMonthIncome?: number
  prevMonthExpense?: number
  /** Previous month's total per category */
  prevCategoryTotals?: { expense: Record<string, number>; income: Record<string, number> }
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


// ── Finance: Routines (push reminder at a set time, auto-recorded if unanswered) ──

export type RoutineRepeat =
  | { kind: 'daily' }
  /** 0 = Sunday … 6 = Saturday */
  | { kind: 'weekdays'; days: number[] }
  | { kind: 'monthly'; day: number }

export interface Routine {
  id: string
  name: string
  type: TransactionType
  amount: number
  category: string
  walletId: string
  note: string
  repeat: RoutineRepeat
  /** Local "HH:MM", 15-minute steps */
  time: string
  tzOffset: number
  onMissed: 'record' | 'skip'
  enabled: boolean
  pausedUntil?: string
  activeFrom: string
  createdAt: string
  updatedAt: string
  /** Next reminder (ISO), from the server; null when off */
  nextDueAt?: string | null
}

export type RoutineInput = Pick<Routine, 'name' | 'type' | 'amount' | 'category' | 'walletId' | 'note' | 'repeat' | 'time' | 'onMissed'>

export interface RoutineOccurrence {
  id: string
  routineId: string
  date: string
  status: 'pending' | 'confirmed' | 'skipped' | 'auto' | 'missed'
  amount: number
  txId?: string
  deadline: string
  createdAt: string
  resolvedAt?: string
  acknowledged?: boolean
}

export interface RoutineInbox {
  pending: RoutineOccurrence[]
  autoRecorded: RoutineOccurrence[]
  routines: Routine[]
}
