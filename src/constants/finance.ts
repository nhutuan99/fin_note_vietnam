import type { CategoryConfig, Wallet } from '@/types'
import { useUiStore } from '@/stores/ui'
import i18n from '@/i18n'

// ── Default Wallets ──

export const DEFAULT_WALLETS: Omit<Wallet, 'id'>[] = [
  {
    name: 'Techcombank',
    balance: 0,
    currency: 'VND',
    icon: '🏦',
    color: '#e62e2e',
    order: 0
  },
  {
    name: 'TPBank',
    balance: 0,
    currency: 'VND',
    icon: '🏧',
    color: '#7b2d8e',
    order: 1
  },
  {
    name: 'MoMo',
    balance: 0,
    currency: 'VND',
    icon: '📱',
    color: '#d82d8b',
    order: 2
  },
  {
    name: 'ZaloPay',
    balance: 0,
    currency: 'VND',
    icon: '💙',
    color: '#0068ff',
    order: 3
  },
  {
    name: 'Visa',
    balance: 0,
    currency: 'VND',
    icon: '💳',
    color: '#1a1f71',
    order: 4
  },
  {
    name: 'Tiền mặt',
    balance: 0,
    currency: 'VND',
    icon: '💵',
    color: '#10b981',
    order: 5
  }
]

// ── Categories ──
// Premium icon set — clear, distinct, and visually appealing

export const EXPENSE_CATEGORIES: CategoryConfig[] = [
  { key: 'food', label: 'Ăn uống', icon: '🍔', color: '#f59e0b', type: 'expense' },
  { key: 'transport', label: 'Di chuyển', icon: '🚕', color: '#3b82f6', type: 'expense' },
  { key: 'shopping', label: 'Shopping', icon: '🛒', color: '#ec4899', type: 'expense' },
  { key: 'entertainment', label: 'Giải trí', icon: '🎬', color: '#8b5cf6', type: 'expense' },
  { key: 'bills', label: 'Hóa đơn', icon: '🧾', color: '#ef4444', type: 'expense' },
  { key: 'health', label: 'Sức khỏe', icon: '🩺', color: '#14b8a6', type: 'expense' },
  { key: 'education', label: 'Học tập', icon: '🎓', color: '#6366f1', type: 'expense' },
  { key: 'rent', label: 'Nhà/Thuê', icon: '🏡', color: '#78716c', type: 'expense' },
  { key: 'gift', label: 'Quà tặng', icon: '🎁', color: '#f43f5e', type: 'expense' },
  { key: 'bank_transfer', label: 'Chuyển khoản', icon: '🏦', color: '#0ea5e9', type: 'expense' },
  { key: 'bank_fee', label: 'Phí ngân hàng', icon: '💳', color: '#64748b', type: 'expense' },
  { key: 'subscription', label: 'Đăng ký dịch vụ', icon: '📋', color: '#a855f7', type: 'expense' },
  { key: 'other_expense', label: 'Khác', icon: '📌', color: '#737373', type: 'expense' },
  { key: 'saving', label: 'Tiết kiệm', icon: '🐷', color: '#10b981', type: 'expense' }
]

export const INCOME_CATEGORIES: CategoryConfig[] = [
  { key: 'salary', label: 'Lương', icon: '💰', color: '#10b981', type: 'income' },
  { key: 'freelance', label: 'Freelance', icon: '💻', color: '#06b6d4', type: 'income' },
  { key: 'investment', label: 'Đầu tư', icon: '📊', color: '#f59e0b', type: 'income' },
  { key: 'bonus', label: 'Thưởng', icon: '🏆', color: '#8b5cf6', type: 'income' },
  { key: 'refund', label: 'Hoàn tiền', icon: '↩️', color: '#3b82f6', type: 'income' },
  { key: 'bank_receive', label: 'Nhận chuyển khoản', icon: '🏦', color: '#0ea5e9', type: 'income' },
  { key: 'other_income', label: 'Thu khác', icon: '📥', color: '#737373', type: 'income' }
]

/**
 * Categories the system assigns on its own and the user never picks — kept
 * out of the pickers above, but still known so they render with a name/icon.
 * `transfer`: internal move between the user's own wallets (worker
 * finance.controller), excluded from income/expense totals.
 */
export const SYSTEM_CATEGORIES: CategoryConfig[] = [
  { key: 'transfer', label: 'Chuyển nội bộ', icon: '🔁', color: '#0ea5e9', type: 'both' }
]

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SYSTEM_CATEGORIES]

export function getCategoryConfig(key: string): CategoryConfig {
  return (
    ALL_CATEGORIES.find((c) => c.key === key) || {
      key,
      label: key,
      icon: '📌',
      color: '#737373',
      type: 'both' as const
    }
  )
}

/**
 * Display name of a category in the current locale. Use this everywhere
 * instead of a raw `t('categories.' + key)` so an unknown key never shows up as
 * a raw "categories.xxx" string.
 */
export function categoryLabel(key: string | null | undefined): string {
  if (!key) return ''
  const path = `categories.${key}`
  const { t, te } = i18n.global
  return te(path) ? t(path) : getCategoryConfig(key).label
}

// ── Format Helpers ──
// These delegate to useCurrency composable for VND/USD support.
// Old function names are preserved for backward compatibility.

import { formatMoney, formatMoneyShort } from '@/composables/useCurrency'

export function formatVND(amount: number): string {
  try {
    if (useUiStore().hideBalances) return '******'
  } catch (e) {}
  return formatMoney(amount)
}

export function formatVNDShort(amount: number): string {
  try {
    if (useUiStore().hideBalances) return '******'
  } catch (e) {}
  return formatMoneyShort(amount)
}
