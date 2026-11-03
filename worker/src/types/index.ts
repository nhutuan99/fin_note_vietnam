export interface Env {
  SMART_NOTE_KV: any // KVNamespace
  JWT_SECRET: string
  TELEGRAM_WEBHOOK_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  RESEND_API_KEY: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  AI: any // Cloudflare AI binding
  GEMINI_API_KEY?: string
  FRONTEND_URL: string
  API_URL: string
}

export interface UserData {
  id: string
  email: string
  name: string
  avatarUrl?: string
  passwordHash: string
  createdAt: string
  pinHash?: string
  hasCompletedOnboarding?: boolean
  disableLargeTransferConfirmation?: boolean
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


export interface NoteData {
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

/** Lightweight note entry stored in `users/{userId}/notes/_index` and returned by the list endpoint. */
export interface NoteIndexItem {
  id: string
  title: string
  /** Plain-text preview (first ~160 chars) */
  excerpt: string
  /** Plain-text body (first ~2000 chars) for client-side full-text search */
  text: string
  wordCount: number
  hasImages: boolean
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
  /** Index item schema version */
  v: number
}

export interface TransactionData {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  note: string
  walletId: string
  source: 'manual' | 'telegram' | 'notification' | 'sms' | 'routine' | 'bank'
  date: string
  createdAt: string
}

export interface PendingNotification {
  id: string
  rawText: string
  appName: string
  status: 'pending' | 'resolved'
  createdAt: string
}

export interface WalletData {
  id: string
  name: string
  balance: number
  currency: string
  icon: string
  color: string
  order: number
  customLogoUrl?: string
  /** 'gold' wallets hold a quantity of gold; balance is derived from the live price */
  kind?: 'cash' | 'gold'
  gold?: GoldHolding
}

export interface GoldHolding {
  /** Price-board product code (PNJ masp: 'SJC', 'N24K', '24K', '75' = 18K, ...) */
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
  /** Served from the last good fetch because every source failed */
  stale?: boolean
}

export interface NotificationData {
  id: string
  type: 'bank_in' | 'bank_out' | 'system'
  title: string
  body: string
  read: boolean
  createdAt: string
  meta?: {
    amount?: number
    txType?: 'income' | 'expense'
    walletName?: string
    bankName?: string
    savingId?: string
  }
}

export interface PushSubscriptionRecord {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  createdAt: string
}

/** Quick-add popup settings, synced across the user's devices (`users/{userId}/quick_add`). */
export interface QuickAddPrefs {
  /** Open the popup automatically when the user comes back to the app */
  enabled: boolean
  /** Last chosen tab: money in (income) or out (expense) */
  type: 'income' | 'expense'
  /** Last chosen wallet (money source) */
  walletId: string | null
  /** Last chosen category per tab */
  categories: { income: string; expense: string }
  updatedAt: string
}

export interface BudgetData {
  amount: number
  dismissed: boolean
  updatedAt: string
}

export interface SavingsGoalData {
  id: string
  name: string
  icon: string
  color: string
  targetAmount: number
  currentAmount: number
  deadline?: string
  autoSaveEnabled?: boolean
  autoSaveAmount?: number
  autoSaveWalletId?: string
  createdAt: string
  updatedAt: string
}

export interface StockAlert {
  id: string
  symbol: string
  targetPrice: number
  direction: 'above' | 'below' // above = sell target, below = buy target
  label: string
  triggered: boolean
  notifiedAt?: string
  createdAt: string
}

export interface StockData {
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

export interface ContactFeedback {
  id: string
  userId: string
  userName: string
  userEmail: string
  subject: string
  message: string
  createdAt: string
}

export interface ReminderData {
  id: string
  title: string
  description: string
  /** An optional URL relevant to the reminder (e.g. Jira link) */
  url?: string
  /** The target event datetime (ISO string) */
  eventDate: string
  /** Pre-calculated reminder fire times (ISO strings) */
  remindAt: string[]
  /** User-selected offsets: '15m','30m','1h','2h','3h','1d','2d','3d','1w' */
  offsets: string[]
  /** User-defined custom reminder datetime (ISO string, optional) */
  customRemindAt?: string
  /** Repeat interval: 'none','daily','weekly','monthly', or custom minutes number */
  repeatInterval?: string
  /** Which remindAt entries have been notified (ISO strings) */
  notifiedAt: string[]
  /** Whether user has acknowledged/seen the reminder */
  acknowledged: boolean
  /** Whether the auto last-chance noti (1h before deadline) has been sent */
  lastChanceSent: boolean
  /** Source feature that created this reminder */
  sourceType: 'note' | 'manual' | 'debt' | 'recurring'
  sourceId?: string
  status: 'active' | 'completed' | 'expired'
  createdAt: string
  updatedAt: string
}

// ── OTP Hub ──

export interface OtpCodeData {
  id: string
  /** Service identifier: 'netflix', 'spotify', 'youtube', 'custom' */
  service: string
  /** Display name for the service */
  serviceName: string
  /** The OTP code string */
  code: string
  /** When this OTP expires (ISO string) */
  expiresAt: string
  createdAt: string
}

export interface OtpHubSettings {
  /** Default expiry time in minutes */
  defaultExpiryMinutes: number
  passwordEnabled?: boolean
  password?: string
  updatedAt: string
}

export interface OtpHubSubscriber {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  createdAt: string
}


// ── Routines: recurring money in/out, reminded by push and recorded automatically if ignored ──

export type RoutineRepeat =
  | { kind: 'daily' }
  /** 0 = Sunday … 6 = Saturday (Mon–Fri = [1,2,3,4,5]) */
  | { kind: 'weekdays'; days: number[] }
  /** Day of month; clamped to the month's last day (31 → 30/28) */
  | { kind: 'monthly'; day: number }

export interface RoutineData {
  id: string
  name: string
  type: 'income' | 'expense'
  amount: number
  category: string
  walletId: string
  note: string
  repeat: RoutineRepeat
  /** Local reminder time "HH:MM", 15-minute steps */
  time: string
  /** Minutes east of UTC when the routine was saved (Vietnam = 420) */
  tzOffset: number
  /** What happens when the user doesn't respond by the end of the day */
  onMissed: 'record' | 'skip'
  enabled: boolean
  /** No occurrences before this local date (YYYY-MM-DD) */
  pausedUntil?: string
  /** Created / last re-enabled: nothing is due before this moment (no back-filling) */
  activeFrom: string
  createdAt: string
  updatedAt: string
}

export type RoutineOccurrenceStatus = 'pending' | 'confirmed' | 'skipped' | 'auto' | 'missed'

export interface RoutineOccurrence {
  /** `${routineId}:${date}` — deterministic, so a repeated cron run can't create duplicates */
  id: string
  routineId: string
  /** Local date the occurrence belongs to (YYYY-MM-DD); also the transaction date */
  date: string
  status: RoutineOccurrenceStatus
  /** Planned amount (the routine's at the time); the recorded one once confirmed */
  amount: number
  /** Transaction recorded for it (confirmed / auto) */
  txId?: string
  /** End of the local day: after this an unanswered occurrence is settled */
  deadline: string
  createdAt: string
  resolvedAt?: string
  /** Auto-recorded and already shown to the user */
  acknowledged?: boolean
}

export interface RoutineOccurrenceDoc {
  /** Last local date materialised per routine */
  cursor: Record<string, string>
  items: RoutineOccurrence[]
}
