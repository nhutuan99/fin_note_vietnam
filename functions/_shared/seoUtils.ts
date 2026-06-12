export function extractPlainText(html: string): string {
  if (!html) return ''

  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.slice(1, match.indexOf(']')))
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractExcerpt(html: string, fallback = 'FinNote', maxLength = 160): string {
  const text = extractPlainText(html)
  if (!text) return fallback
  return truncateText(text, maxLength)
}

export function extractFirstImage(html: string, fallbackUrl: string, baseUrl?: string): string {
  if (!html) return fallbackUrl
  const imgMatch = html.match(/<img[^>]+src=["']([^"'>\s]+)["']/i)
  const mdMatch = html.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/)
  const candidate = imgMatch?.[1] || mdMatch?.[1]
  if (!candidate || isInlineOrLocalOnlyImage(candidate)) return fallbackUrl

  const absoluteUrl = toAbsoluteUrl(candidate, baseUrl || fallbackUrl)
  return /^https?:\/\//i.test(absoluteUrl) ? absoluteUrl : fallbackUrl
}

export function toAbsoluteUrl(url: string, baseUrl: string): string {
  if (!url) return baseUrl
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`

  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return baseUrl
  }
}

export function truncateText(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text
  const sliced = text.slice(0, maxLength - 1)
  const lastSpace = sliced.lastIndexOf(' ')
  return `${(lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced).trim()}...`
}

export function injectMeta(html: string, meta: string, articleHtml: string | null): string {
  html = html.replace(/<title>[^<]*<\/title>/, '')
  html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, '')
  html = html.replace(/<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i, '')
  html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, '')
  html = html.replace(/<meta\s+name="author"\s+content="[^"]*"\s*\/?>/gi, '')
  html = html.replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?>/gi, '')
  html = html.replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?>/gi, '')
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i, '')

  html = html.replace(
    /<meta\s+charset="UTF-8"\s*\/?>/i,
    `<meta charset="UTF-8" />\n    ${meta.trim()}`
  )

  if (articleHtml) {
    html = html.replace(
      '<div id="app"></div>',
      `<div id="app">${articleHtml}</div>`
    )
  }

  return html
}

export function escHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function decodeHtmlEntities(str: string): string {
  const named: Record<string, string> = {
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    nbsp: ' ',
  }

  return str.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    const lower = code.toLowerCase()
    if (lower in named) return named[lower]

    if (lower.startsWith('#x')) {
      const value = Number.parseInt(lower.slice(2), 16)
      return Number.isFinite(value) ? String.fromCodePoint(value) : entity
    }

    if (lower.startsWith('#')) {
      const value = Number.parseInt(lower.slice(1), 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : entity
    }

    return entity
  })
}

function isInlineOrLocalOnlyImage(url: string): boolean {
  return /^(data:|blob:|file:|javascript:)/i.test(url.trim())
}
