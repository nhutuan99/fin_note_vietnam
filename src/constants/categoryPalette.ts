/**
 * Chart colors for categories.
 *
 * - Color follows the category (entity), never its rank: "Ăn uống" is always the same blue,
 *   whichever month or position it shows up in.
 * - Eight validated categorical slots (CVD-safe adjacent pairs, ≥3:1 on the dark surface;
 *   checked with the dataviz palette validator against #0a0a0a dark / #ffffff light).
 *   Light mode has three low-contrast slots, so every colored mark ships with a text label.
 * - Categories without a slot fold into a neutral "other" gray instead of a generated 9th hue.
 */

const SLOTS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
} as const

const OTHER = { light: '#a3a3a3', dark: '#525252' } as const

/** The most common categories of each kind get a slot (index into SLOTS) */
const CATEGORY_SLOT: Record<string, number> = {
  // expense
  food: 0,
  shopping: 1,
  transport: 2,
  bills: 3,
  entertainment: 4,
  health: 5,
  education: 6,
  rent: 7,
  // income (shown separately from expense, so slots can be reused)
  salary: 0,
  freelance: 1,
  investment: 2,
  bonus: 3,
  refund: 4,
  saving_withdraw: 5
}

export function categoryColor(category: string, theme: 'light' | 'dark'): string {
  const slot = CATEGORY_SLOT[category]
  return slot === undefined ? OTHER[theme] : SLOTS[theme][slot]
}

export function otherColor(theme: 'light' | 'dark'): string {
  return OTHER[theme]
}
