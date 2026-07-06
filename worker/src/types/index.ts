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
  lastWeeklyEvent?: number
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

export interface TransactionData {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  note: string
  walletId: string
  source: 'manual' | 'telegram' | 'notification' | 'sms'
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

export interface BlogData {
  id: string
  slug: string
  title: string
  content: string
  excerpt: string
  tags: string[]
  imageUrl?: string
  author: {
    name: string
    email: string
  }
  seoMeta: {
    title: string
    description: string
    keywords: string
  }
  published: boolean
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

export interface TodoData {
  id: string
  title: string
  description: string
  /** The target datetime for this task (ISO string) */
  time: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'done'
  category?: string
  /** Linked reminder ID when pushed to reminders */
  reminderId?: string
  createdAt: string
  updatedAt: string
}

// ── Trading Journal ──

/** User config: which wallets to track in the daily check-in */
export interface TradingConfigData {
  /** Wallet IDs selected by the user for trading journal tracking */
  selectedWalletIds: string[]
  /**
   * Daily reminder time in "HH:MM" format (Vietnam timezone UTC+7).
   * When set, the cron job will push a reminder at this time if no check-in exists.
   * Absent or null means reminders are disabled.
   */
  reminderTime?: string | null
  /**
   * The last date (YYYY-MM-DD VN) a reminder was pushed for this user.
   * Guards against sending multiple push notifications in the same day.
   */
  reminderNotifiedDate?: string | null
  createdAt: string
  updatedAt: string
}

/** P&L entry for a single wallet inside a daily check-in */
export interface TradingCheckinEntry {
  walletId: string
  walletName: string
  /** Whether the user entered profit/loss as percent or absolute amount */
  inputMode: 'percent' | 'amount'
  /** Raw user input: percentage value (e.g. 2.5) or VND amount (e.g. 250000) */
  inputValue: number
  /** Always-calculated VND P&L (positive = profit, negative = loss) */
  pnlAmount: number
  /** Optional additional capital deposited into the wallet this session */
  depositAmount: number
  /** Wallet balance snapshot at the moment of check-in */
  balanceBefore: number
  /** balanceBefore + pnlAmount + depositAmount */
  balanceAfter: number
}

/** One daily trading journal record */
export interface TradingCheckinData {
  id: string
  /** ISO date string YYYY-MM-DD (one record per day) */
  date: string
  entries: TradingCheckinEntry[]
  /** Optional free-text note for the session */
  note: string
  /** Sum of all entry pnlAmount values */
  totalPnl: number
  /** Sum of all entry depositAmount values */
  totalDeposit: number
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

