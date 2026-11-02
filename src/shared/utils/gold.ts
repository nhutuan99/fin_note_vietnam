import type { GoldPriceItem } from '@/types'

/**
 * Vietnamese gold units: 1 cây (lượng) = 10 chỉ = 100 phân; 1 chỉ = 3.75 g.
 * Quantities are stored in chỉ.
 */
export const GRAMS_PER_CHI = 3.75

export interface GoldParts {
  cay: number
  chi: number
  phan: number
}

export function splitChi(qtyChi: number): GoldParts {
  // Work in phân (integer-ish) to avoid 0.1 float drift; keep up to 1 decimal of phân
  const phanTotal = Math.round(qtyChi * 100) / 10
  const cay = Math.floor(phanTotal / 100)
  const chi = Math.floor((phanTotal - cay * 100) / 10)
  const phan = Math.round((phanTotal - cay * 100 - chi * 10) * 10) / 10
  return { cay, chi, phan }
}

export function joinChi({ cay, chi, phan }: GoldParts): number {
  return Math.round(((cay || 0) * 10 + (chi || 0) + (phan || 0) / 10) * 100) / 100
}

/** "1 cây 2 chỉ 5 phân" — zero parts are dropped */
export function formatGoldQty(qtyChi: number, labels: { cay: string; chi: string; phan: string }): string {
  const { cay, chi, phan } = splitChi(qtyChi)
  const parts: string[] = []
  if (cay) parts.push(`${cay} ${labels.cay}`)
  if (chi) parts.push(`${chi} ${labels.chi}`)
  if (phan) parts.push(`${String(phan).replace('.', ',')} ${labels.phan}`)
  return parts.join(' ') || `0 ${labels.chi}`
}

export function formatGrams(qtyChi: number): string {
  const g = qtyChi * GRAMS_PER_CHI
  return `${g.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} g`
}

/** Most-held kinds first; the rest of the board keeps its own order. Raw-material buy-only rows are hidden. */
const POPULAR = ['SJC', 'N24K', '24K', '999', '99', '22K', '75', '58.5', '41']

export function pickableGoldTypes(items: GoldPriceItem[]): GoldPriceItem[] {
  const usable = items.filter((i) => !i.code.startsWith('RAW_'))
  const rank = (c: string) => {
    const i = POPULAR.indexOf(c)
    return i === -1 ? POPULAR.length : i
  }
  return usable
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.code) - rank(b.item.code) || a.index - b.index)
    .map(({ item }) => item)
}

/** Short purity tag shown next to the product name ("24K", "18K", "SJC"...) */
export function goldTag(item: GoldPriceItem): string {
  const k = item.name.match(/\((\d+(?:\.\d+)?K)\)/)
  if (k) return k[1]
  if (item.code === 'SJC') return 'SJC'
  if (/999\.9/.test(item.name)) return '9999'
  if (/\b999\b/.test(item.name)) return '999'
  if (/\b99\b/.test(item.name)) return '99'
  return item.code
}
