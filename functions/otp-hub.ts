// Cloudflare Pages Function: Server-side meta injection for OTP Hub page
import { injectMeta, escHtml } from './_shared/seoUtils'

type PagesFunction<Env = unknown> = (context: {
  request: Request
  next: () => Promise<Response>
  params: Record<string, string>
  env: Env
}) => Promise<Response> | Response

interface OtpCode {
  id: string
  service: string
  serviceName: string
  code: string
  expiresAt: string
  createdAt: string
}

interface Env {
  API_URL?: string
  SITE_URL?: string
  VITE_API_BASE_URL?: string
  VITE_FRONTEND_URL?: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  
  const apiUrl = context.env.API_URL || context.env.VITE_API_BASE_URL || 'https://smart-note-api.smart-note.workers.dev'
  const siteUrl = trimTrailingSlash(
    context.env.SITE_URL || context.env.VITE_FRONTEND_URL || url.origin || 'https://finnote-f4n.pages.dev'
  )

  let activeCodes: OtpCode[] = []
  try {
    const apiRes = await fetch(`${trimTrailingSlash(apiUrl)}/api/otp-hub`, {
      headers: {
        Accept: 'application/json',
      },
    })
    if (apiRes.ok) {
      const json = await apiRes.json() as { success: boolean; data: OtpCode[] }
      if (json.success && Array.isArray(json.data)) {
        activeCodes = json.data
      }
    }
  } catch {
    // API fetch failed, fall through to default metadata
  }

  // Get the original SPA response
  const response = await context.next()
  const html = await response.text()

  const meta = buildOtpHubMeta(activeCodes, siteUrl)
  const articleHtml = buildArticleHtml(activeCodes)
  const injectedHtml = injectMeta(html, meta, articleHtml)

  return new Response(injectedHtml, {
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'content-type': 'text/html;charset=UTF-8',
    },
  })
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function buildOtpHubMeta(activeCodes: OtpCode[], siteUrl: string): string {
  const title = 'OTP Hub | Nhận Mã OTP Trực Tuyến Miễn Phí - FinNote'
  const desc = 'Trang nhận mã OTP trực tuyến nhanh chóng, hoàn toàn miễn phí từ FinNote. Nhận mã OTP Netflix, Spotify, YouTube... ngay lập tức và đăng ký nhận thông báo đẩy.'
  const keywords = 'otp hub, nhận mã otp, otp netflix, otp spotify, otp youtube, otp mien phi, finnote, otp'
  const pageUrl = `${siteUrl}/otp-hub`
  const image = `${siteUrl}/images/og-cover.jpg`

  const activeServicesText = activeCodes.length > 0
    ? `Các dịch vụ đang hoạt động: ${activeCodes.map(c => c.serviceName).join(', ')}.`
    : 'Hiện chưa có mã OTP nào đang hoạt động.'

  const fullDesc = `${desc} ${activeServicesText}`

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: fullDesc,
    image: image,
    publisher: {
      '@type': 'Organization',
      name: 'FinNote',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/images/logo-512.png` }
    },
    url: pageUrl
  })

  const safeJsonLd = jsonLd.replace(/<\//g, '<\\/')

  return `
    <title>${escHtml(title)}</title>
    <meta name="description" content="${escHtml(fullDesc)}" />
    <meta name="keywords" content="${escHtml(keywords)}" />
    <meta name="author" content="FinNote" />
    <link rel="canonical" href="${escHtml(pageUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escHtml(pageUrl)}" />
    <meta property="og:title" content="${escHtml(title)}" />
    <meta property="og:description" content="${escHtml(fullDesc)}" />
    <meta property="og:image" content="${escHtml(image)}" />
    <meta property="og:image:secure_url" content="${escHtml(image)}" />
    <meta property="og:image:alt" content="FinNote OTP Hub" />
    <meta property="og:site_name" content="FinNote" />
    <meta property="og:locale" content="vi_VN" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(title)}" />
    <meta name="twitter:description" content="${escHtml(fullDesc)}" />
    <meta name="twitter:image" content="${escHtml(image)}" />
    <script type="application/ld+json">${safeJsonLd}</script>
  `
}

function buildArticleHtml(activeCodes: OtpCode[]): string {
  let listHtml = ''
  if (activeCodes.length > 0) {
    listHtml = `<ul>
      ${activeCodes.map(c => `
        <li>
          <strong>${escHtml(c.serviceName)}</strong>: Mã OTP đang hoạt động (Tạo lúc: ${escHtml(c.createdAt)})
        </li>
      `).join('')}
    </ul>`
  } else {
    listHtml = '<p>Hiện chưa có mã OTP nào đang hoạt động. Vui lòng quay lại sau hoặc đăng ký nhận thông báo đẩy.</p>'
  }

  return `
    <article>
      <header>
        <h1>OTP Hub - Nhận Mã OTP Trực Tuyến Miễn Phí</h1>
        <p>Hệ thống chia sẻ mã OTP tài khoản dùng chung (Netflix, Spotify, YouTube...) từ FinNote.</p>
      </header>
      <section>
        <h2>Danh Sách Mã OTP Đang Hoạt Động</h2>
        ${listHtml}
      </section>
    </article>
  `
}
