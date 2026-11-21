import { useI18n } from 'vue-i18n'
import { categoryLabel } from '@/constants/finance'
import { useFinanceStore } from '@/stores/finance'
import type { Transaction } from '@/types'

/**
 * Composable to export transactions as CSV file.
 * Pure client-side — no backend needed.
 */
export function useExportCsv() {
  const { t } = useI18n()
  const finance = useFinanceStore()

  function formatAmount(amount: number): string {
    return amount.toLocaleString('vi-VN')
  }

  function escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  function buildCsvContent(transactions: Transaction[]): string {
    const headers = [
      t('transactions.date'),
      t('transactions.type'),
      t('transactions.category'),
      t('transactions.amount'),
      t('transactions.wallet'),
      t('addTx.note'),
      t('transactions.source')
    ]

    const rows = transactions.map((tx) => {
      const walletName = finance.getWalletName(tx.walletId)
      const typeLabel = tx.type === 'income' ? t('transactions.filterIncome') : t('transactions.filterExpense')

      return [
        tx.date,
        escapeCsv(typeLabel),
        escapeCsv(categoryLabel(tx.category)),
        formatAmount(tx.amount),
        escapeCsv(walletName),
        escapeCsv(tx.note || ''),
        tx.source
      ].join(',')
    })

    // BOM for Excel UTF-8 compatibility
    return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n')
  }

  function downloadCsv(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportTransactions(transactions: Transaction[], filename?: string): void {
    if (transactions.length === 0) return

    const today = new Date().toISOString().substring(0, 10)
    const name = filename ?? `finnote_transactions_${today}.csv`
    const content = buildCsvContent(transactions)
    downloadCsv(content, name)
  }

  return { exportTransactions }
}
