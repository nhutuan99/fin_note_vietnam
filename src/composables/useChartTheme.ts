import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

/*
 * Canvas charts can't use CSS variables, so the theme tokens they need are mirrored here
 * (values from assets/styles/variables.css). A static map — rather than reading computed
 * styles — avoids picking up the previous theme while the data-theme attribute is updating.
 */
const PALETTES = {
  dark: {
    income: '#34d399',
    expense: '#fb7185',
    accent: '#8e7dfa',
    text: '#737373',
    muted: '#525252',
    grid: 'rgba(255, 255, 255, 0.05)',
    crosshair: 'rgba(255, 255, 255, 0.18)'
  },
  light: {
    income: '#10b981',
    expense: '#f43f5e',
    accent: '#8e7dfa',
    text: '#64748b',
    muted: '#94a3b8',
    grid: 'rgba(15, 23, 42, 0.06)',
    crosshair: 'rgba(15, 23, 42, 0.2)'
  }
} as const

export function useChartTheme() {
  const ui = useUiStore()
  return computed(() => PALETTES[ui.theme === 'light' ? 'light' : 'dark'])
}

/** "#rrggbb" + alpha → rgba() (Chart.js needs explicit colors for fills) */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
