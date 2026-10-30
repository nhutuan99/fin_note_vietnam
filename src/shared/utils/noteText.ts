/**
 * Plain-text helpers for notes. Mirrors `htmlToPlainText` in the worker's note controller so the
 * list can be updated locally after a save without refetching the index.
 */

const EXCERPT_LENGTH = 160
const SEARCH_TEXT_LENGTH = 2000
/** Average silent reading speed used for the "x min read" hint */
const WORDS_PER_MINUTE = 220

const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
}

function decodeEntity(match: string, entity: string): string {
  const lower = entity.toLowerCase()
  if (!lower.startsWith('#')) return HTML_ENTITIES[lower] ?? match
  const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
  try {
    return String.fromCodePoint(code)
  } catch {
    return match
  }
}

export function htmlToPlainText(html: string | undefined | null): string {
  if (!html) return ''
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|pre|blockquote|table|tr|td|th|hr)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, decodeEntity)
    .replace(/\s+/g, ' ')
    .trim()
}

/** Index fields derived from note HTML (same shape the worker stores in the notes index). */
export function deriveNoteText(html: string) {
  const text = htmlToPlainText(html)
  return {
    excerpt: text.substring(0, EXCERPT_LENGTH),
    text: text.substring(0, SEARCH_TEXT_LENGTH),
    wordCount: text ? text.split(' ').length : 0,
    hasImages: /<img[\s>]/i.test(html)
  }
}

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE))
}

/** Lowercases and strips Vietnamese diacritics so "ghi chu" matches "Ghi chú". */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}
