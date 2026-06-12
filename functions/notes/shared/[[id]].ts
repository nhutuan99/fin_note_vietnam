// Cloudflare Pages Function: Server-side meta injection for shared notes
import { extractExcerpt, extractFirstImage, extractPlainText, injectMeta, escHtml, truncateText } from '../../_shared/seoUtils'

type PagesFunction<Env = unknown> = (context: {
  request: Request
  next: () => Promise<Response>
  params: Record<string, string>
  env: Env
}) => Promise<Response> | Response

interface NoteData {
  id: string
  title: string
  content: string
  tags: string[]
  isPublic: boolean
  createdAt: string
  updatedAt: string
}
interface Env {
  API_URL?: string
  SITE_URL?: string
  VITE_API_BASE_URL?: string
  VITE_FRONTEND_URL?: string
}
interface ApiResponse<T> {
  success?: boolean
  data?: T
  error?: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const noteId = pathParts.length >= 3 ? pathParts[2] : null

  if (!noteId) {
    return context.next()
  }

  const apiUrl = context.env.API_URL || context.env.VITE_API_BASE_URL || 'https://smart-note-api.smart-note.workers.dev'
  const siteUrl = trimTrailingSlash(
    context.env.SITE_URL || context.env.VITE_FRONTEND_URL || url.origin || 'https://finnote-f4n.pages.dev'
  )

  let note: NoteData | null = null
  try {
    const apiRes = await fetch(`${trimTrailingSlash(apiUrl)}/api/notes/shared/${encodeURIComponent(noteId)}`, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (apiRes.ok) {
      note = unwrapNoteResponse(await apiRes.json())
    }
  } catch {
    // API fetch failed, fall through to SPA
  }

  const response = await context.next()
  const html = await response.text()

  if (!note) {
    return new Response(html, {
      headers: htmlHeaders(response),
    })
  }

  const meta = buildNoteMeta(note, noteId, siteUrl)
  const articleHtml = buildArticleHtml(note)
  const injectedHtml = injectMeta(html, meta, articleHtml)

  return new Response(injectedHtml, {
    headers: htmlHeaders(response),
  })
}

function buildNoteMeta(note: NoteData, noteId: string, siteUrl: string): string {
  const title = normalizeTitle(note.title)
  const desc = extractExcerpt(note.content, `${title} - ghi chú được chia sẻ trên FinNote`)
  const keywords = (note.tags || []).concat(['smart note', 'finnote', 'ghi chú']).join(',')
  const noteUrl = `${siteUrl}/notes/shared/${noteId}`
  const image = extractFirstImage(note.content, `${siteUrl}/images/og-cover.jpg`, noteUrl)

  const articleTags = (note.tags || [])
    .map((tag) => `<meta property="article:tag" content="${escHtml(tag)}" />`)
    .join('\n    ')

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: desc,
    image: image,
    author: { '@type': 'Person', name: 'FinNote User' },
    publisher: {
      '@type': 'Organization',
      name: 'FinNote',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/images/logo-512.png` },
    },
    datePublished: note.createdAt,
    dateModified: note.updatedAt || note.createdAt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': noteUrl },
    keywords: (note.tags || []).join(', '),
  })

  const safeJsonLd = jsonLd.replace(/<\//g, '<\\/')

  return `
    <title>${escHtml(title)} | FinNote</title>
    <meta name="description" content="${escHtml(desc)}" />
    <meta name="keywords" content="${escHtml(keywords)}" />
    <meta name="author" content="FinNote User" />
    <link rel="canonical" href="${escHtml(noteUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escHtml(noteUrl)}" />
    <meta property="og:title" content="${escHtml(title)}" />
    <meta property="og:description" content="${escHtml(desc)}" />
    <meta property="og:image" content="${escHtml(image)}" />
    <meta property="og:image:secure_url" content="${escHtml(image)}" />
    <meta property="og:image:alt" content="${escHtml(title)}" />
    <meta property="og:site_name" content="FinNote" />
    <meta property="og:locale" content="vi_VN" />
    <meta property="article:published_time" content="${escHtml(note.createdAt)}" />
    ${articleTags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(title)}" />
    <meta name="twitter:description" content="${escHtml(desc)}" />
    <meta name="twitter:image" content="${escHtml(image)}" />
    <meta name="twitter:image:alt" content="${escHtml(title)}" />
    <script type="application/ld+json">${safeJsonLd}</script>
  `
}

function buildArticleHtml(note: NoteData): string {
  const title = normalizeTitle(note.title)
  const desc = extractExcerpt(note.content, `${title} - ghi chú được chia sẻ trên FinNote`)
  const articleBody = truncateText(extractPlainText(note.content), 5000)

  return `
    <article itemscope itemtype="https://schema.org/Article">
      <header>
        <h1 itemprop="headline">${escHtml(title)}</h1>
        <p itemprop="description">${escHtml(desc)}</p>
        <div>
          <span itemprop="author" itemscope itemtype="https://schema.org/Person">
            <span itemprop="name">FinNote User</span>
          </span>
          <time itemprop="datePublished" datetime="${escHtml(note.createdAt)}">${escHtml(note.createdAt.split('T')[0])}</time>
        </div>
        ${note.tags?.length ? `<div>${note.tags.map(t => `<span>${escHtml(t)}</span>`).join(' ')}</div>` : ''}
      </header>
      <div itemprop="articleBody">${escHtml(articleBody || desc)}</div>
    </article>
  `
}

function unwrapNoteResponse(payload: unknown): NoteData | null {
  if (!payload || typeof payload !== 'object') return null

  const maybeWrapped = payload as ApiResponse<NoteData>
  const note = maybeWrapped.data && typeof maybeWrapped.data === 'object'
    ? maybeWrapped.data
    : payload

  if (!note || typeof note !== 'object') return null
  const candidate = note as Partial<NoteData>
  if (!candidate.id) return null

  return {
    id: String(candidate.id),
    title: normalizeTitle(candidate.title),
    content: String(candidate.content || ''),
    tags: Array.isArray(candidate.tags) ? candidate.tags.map(String).filter(Boolean) : [],
    isPublic: Boolean(candidate.isPublic),
    createdAt: String(candidate.createdAt || new Date().toISOString()),
    updatedAt: String(candidate.updatedAt || candidate.createdAt || new Date().toISOString()),
  }
}

function normalizeTitle(title: unknown): string {
  const value = typeof title === 'string' ? title.replace(/\s+/g, ' ').trim() : ''
  return value || 'Ghi chú được chia sẻ'
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function htmlHeaders(response: Response): Headers {
  const headers = new Headers(response.headers)
  headers.set('content-type', 'text/html;charset=UTF-8')
  return headers
}
