import { Env, BlogData, UserData } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'

const ADMIN_EMAIL = 'tintphcm@gmail.com'

// Helper to check admin
async function isAdmin(userId: string, env: Env): Promise<boolean> {
  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

// Generates a URL-friendly slug
function createSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

// ====== Public Blog Endpoints ======

export async function handleListBlogs(request: Request, env: Env): Promise<Response> {
  const index = await getJSON<{ blogs: any[] }>(env.SMART_NOTE_KV, `public/blogs/_index`)
  
  // Return only published ones
  const published = (index?.blogs || []).filter(b => b.published !== false)
  // Sort by date desc
  published.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Fetch view counts for all blogs in parallel
  const withViews = await Promise.all(
    published.map(async (blog) => {
      const count = await env.SMART_NOTE_KV.get(`public/blogs/${blog.slug}/views`)
      return { ...blog, viewCount: parseInt(count || '0') }
    })
  )

  return jsonResponse({ success: true, data: withViews })
}

export async function handleGetBlog(slug: string, env: Env): Promise<Response> {
  const blog = await getJSON<BlogData>(env.SMART_NOTE_KV, `public/blogs/${slug}`)
  if (!blog) return errorResponse('Blog not found', 404)
  return jsonResponse({ success: true, data: blog })
}

export async function handleBlogView(slug: string, request: Request, env: Env): Promise<Response> {
  // Verify blog exists
  const blog = await getJSON<BlogData>(env.SMART_NOTE_KV, `public/blogs/${slug}`)
  if (!blog) return errorResponse('Blog not found', 404)

  // Hash IP for privacy-safe rate limiting
  const ip = request.headers.get('cf-connecting-ip') || 'unknown'
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(ip + slug))
  const ipHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)

  const viewerKey = `public/blogs/${slug}/viewers/${ipHash}`
  const countKey = `public/blogs/${slug}/views`

  // Check if already viewed (24h window)
  const alreadyViewed = await env.SMART_NOTE_KV.get(viewerKey)

  if (!alreadyViewed) {
    // Increment view count
    const current = parseInt(await env.SMART_NOTE_KV.get(countKey) || '0')
    await env.SMART_NOTE_KV.put(countKey, String(current + 1))
    // Mark as viewed (TTL 24 hours)
    await env.SMART_NOTE_KV.put(viewerKey, '1', { expirationTtl: 86400 })
  }

  // Return current count
  const count = await env.SMART_NOTE_KV.get(countKey)
  return jsonResponse({ success: true, data: { views: parseInt(count || '0') } })
}

export async function handleGetImage(id: string, env: Env): Promise<Response> {
  const result = (await env.SMART_NOTE_KV.getWithMetadata(
    `public/images/${id}`,
    'arrayBuffer'
  )) as { value: ArrayBuffer | null, metadata: { contentType?: string } | null }
  const file = result?.value
  const metadata = result?.metadata

  if (!file) return new Response('Image not found', {
    status: 404,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  })

  // Validate that we actually have binary data (not "[object Object]" string)
  const byteArray = new Uint8Array(file as ArrayBuffer)
  if (byteArray.length < 8) {
    return new Response('Invalid image data', {
      status: 404,
      headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }

  // Use metadata content-type if available, otherwise detect from magic bytes
  let contentType = metadata?.contentType || 'image/jpeg'
  if (!metadata?.contentType) {
    if (byteArray[0] === 0x89 && byteArray[1] === 0x50 && byteArray[2] === 0x4E && byteArray[3] === 0x47) {
      contentType = 'image/png'
    } else if (byteArray[0] === 0x52 && byteArray[1] === 0x49 && byteArray[2] === 0x46 && byteArray[3] === 0x46) {
      contentType = 'image/webp'
    } else if (byteArray[0] === 0x47 && byteArray[1] === 0x49 && byteArray[2] === 0x46) {
      contentType = 'image/gif'
    }
  }

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': byteArray.length.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    }
  })
}

// ====== Admin Blog Endpoints ======


export async function handleCreateBlog(userId: string, request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) return errorResponse('Forbidden', 403)

  const body = (await request.json()) as any
  const id = generateId()
  const slug = body.slug || createSlug(body.title || 'untitled')
  const now = new Date().toISOString()
  
  const blog: BlogData = {
    id,
    slug,
    title: body.title || 'Untitled',
    content: body.content || '',
    excerpt: body.excerpt || '',
    tags: body.tags || [],
    imageUrl: body.imageUrl || '',
    author: {
      name: 'Admin',
      email: ADMIN_EMAIL
    },
    seoMeta: body.seoMeta || { title: body.title, description: body.excerpt, keywords: '' },
    published: body.published ?? false,
    createdAt: now,
    updatedAt: now
  }

  // Ensure slug is unique
  const existing = await getJSON<BlogData>(env.SMART_NOTE_KV, `public/blogs/${slug}`)
  if (existing) {
    return errorResponse('Slug already exists', 400)
  }

  await putJSON(env.SMART_NOTE_KV, `public/blogs/${slug}`, blog)

  // Update index
  const index = (await getJSON<{ blogs: any[] }>(env.SMART_NOTE_KV, `public/blogs/_index`)) || { blogs: [] }
  index.blogs.push({
    id: blog.id,
    slug: blog.slug,
    title: blog.title,
    excerpt: blog.excerpt,
    tags: blog.tags,
    imageUrl: blog.imageUrl,
    published: blog.published,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt
  })
  await putJSON(env.SMART_NOTE_KV, `public/blogs/_index`, index)

  return jsonResponse({ success: true, data: blog }, 201)
}

export async function handleUpdateBlog(userId: string, slug: string, request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) return errorResponse('Forbidden', 403)

  const existing = await getJSON<BlogData>(env.SMART_NOTE_KV, `public/blogs/${slug}`)
  if (!existing) return errorResponse('Blog not found', 404)

  const body = (await request.json()) as any
  // Whitelist editable fields only — prevent id/author/createdAt overwrite
  const updated: BlogData = {
    ...existing,
    title: body.title !== undefined ? body.title : existing.title,
    content: body.content !== undefined ? body.content : existing.content,
    excerpt: body.excerpt !== undefined ? body.excerpt : existing.excerpt,
    tags: Array.isArray(body.tags) ? body.tags : existing.tags,
    imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
    seoMeta: body.seoMeta !== undefined ? body.seoMeta : existing.seoMeta,
    published: typeof body.published === 'boolean' ? body.published : existing.published,
    slug, // don't allow slug change
    updatedAt: new Date().toISOString()
  }

  await putJSON(env.SMART_NOTE_KV, `public/blogs/${slug}`, updated)

  // Update index
  const index = (await getJSON<{ blogs: any[] }>(env.SMART_NOTE_KV, `public/blogs/_index`)) || { blogs: [] }
  const idx = index.blogs.findIndex((b: any) => b.slug === slug)
  if (idx !== -1) {
    index.blogs[idx] = {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      excerpt: updated.excerpt,
      tags: updated.tags,
      imageUrl: updated.imageUrl,
      published: updated.published,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    }
    await putJSON(env.SMART_NOTE_KV, `public/blogs/_index`, index)
  }

  return jsonResponse({ success: true, data: updated })
}

export async function handleDeleteBlog(userId: string, slug: string, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) return errorResponse('Forbidden', 403)

  await env.SMART_NOTE_KV.delete(`public/blogs/${slug}`)

  const index = (await getJSON<{ blogs: any[] }>(env.SMART_NOTE_KV, `public/blogs/_index`)) || { blogs: [] }
  index.blogs = index.blogs.filter((b: any) => b.slug !== slug)
  await putJSON(env.SMART_NOTE_KV, `public/blogs/_index`, index)

  return jsonResponse({ success: true })
}

// ====== AI Generators ======

export async function handleGenerateBlogContent(userId: string, request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) return errorResponse('Forbidden', 403)

  // ?model=cf to skip Gemini and force Cloudflare AI
  const url = new URL(request.url)
  const forceCloudflare = url.searchParams.get('model') === 'cf'

  const { topic, imageBase64, imagesBase64 } = (await request.json()) as { topic: string; imageBase64?: string; imagesBase64?: string[] }
  const images = imagesBase64 || (imageBase64 ? [imageBase64] : [])
  if (!topic && images.length === 0) return errorResponse('Missing topic or images', 400)

  function stripLeadingH1(md: string): string {
    return md.replace(/^\s*#\s+[^\n]+\n*/m, '').trim()
  }

  try {
    let useGemini = !!env.GEMINI_API_KEY && !forceCloudflare
    let geminiError: string | undefined

    // ═══════════════════════════════════════════════════
    // PHASE 1: Research with Gemini Grounding (Google Search)
    // Rate-limited: max 400 queries/day to stay within free tier
    // ═══════════════════════════════════════════════════
    let researchContext = ''
    let groundingSources: { title: string; url: string }[] = []
    const GROUNDING_DAILY_LIMIT = 400
    const today = new Date().toISOString().substring(0, 10) // YYYY-MM-DD
    const groundingKey = `system/grounding_usage/${today}`

    if (useGemini) {
      // Check daily grounding quota
      let groundingCount = 0
      try {
        const stored = await env.SMART_NOTE_KV.get(groundingKey)
        groundingCount = stored ? parseInt(stored, 10) : 0
      } catch { groundingCount = 0 }

      const quotaRemaining = GROUNDING_DAILY_LIMIT - groundingCount
      const canUseGrounding = quotaRemaining > 0

      console.log(`[BlogGen] Grounding quota: ${groundingCount}/${GROUNDING_DAILY_LIMIT} used today (${quotaRemaining} remaining)`)

      if (canUseGrounding) {
        try {
          console.log('[BlogGen] Phase 1: Researching with Gemini Grounding...')
          const researchPrompt = `Tìm kiếm và tổng hợp thông tin từ internet về chủ đề: "${topic}".
Hãy đọc các bài viết liên quan và tóm tắt:
1. Các điểm chính mà các bài viết hiện có đang đề cập
2. Số liệu thống kê hoặc dữ liệu thực tế nếu có
3. Các tips/mẹo phổ biến nhất
4. Những góc nhìn hoặc quan điểm đáng chú ý

Trả về bản tóm tắt nghiên cứu chi tiết bằng tiếng Việt.`

          const researchResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: researchPrompt }] }],
                tools: [{ google_search: {} }],
                generationConfig: { temperature: 0.3 }
              })
            }
          )

          if (researchResponse.ok) {
            // Increment counter AFTER successful call (TTL 2 days = 172800s)
            await env.SMART_NOTE_KV.put(groundingKey, String(groundingCount + 1), {
              expirationTtl: 172800
            })

            const researchData: any = await researchResponse.json()
            researchContext = researchData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

            // Extract grounding sources from metadata
            const groundingMeta = researchData?.candidates?.[0]?.groundingMetadata
            if (groundingMeta?.groundingChunks) {
              for (const chunk of groundingMeta.groundingChunks) {
                if (chunk?.web?.uri && chunk?.web?.title) {
                  groundingSources.push({
                    title: chunk.web.title,
                    url: chunk.web.uri
                  })
                }
              }
            }
            // Deduplicate sources
            const seen = new Set<string>()
            groundingSources = groundingSources.filter(s => {
              if (seen.has(s.url)) return false
              seen.add(s.url)
              return true
            }).slice(0, 5)

            console.log(`[BlogGen] Research done: ${researchContext.length} chars, ${groundingSources.length} sources (quota: ${groundingCount + 1}/${GROUNDING_DAILY_LIMIT})`)
          } else {
            console.warn('[BlogGen] Grounding research failed, proceeding without research')
          }
        } catch (err: any) {
          console.warn('[BlogGen] Grounding error:', err.message)
        }
      } else {
        console.warn(`[BlogGen] ⚠️ Grounding daily limit reached (${groundingCount}/${GROUNDING_DAILY_LIMIT}). Skipping web research to avoid charges.`)
      }
    }

    // ═══════════════════════════════════════════════════
    // PHASE 2: Generate blog content using research context
    // AI creates original content enriched with research data
    // ═══════════════════════════════════════════════════
    const systemPrompt = `Bạn là một chuyên gia viết blog (Content Creator) cấp cao về đa chủ đề (Công nghệ, Tài chính, Đời sống GenZ).

${researchContext ? `## DỮ LIỆU NGHIÊN CỨU TỪ INTERNET
Dưới đây là thông tin đã được tổng hợp từ các bài viết thực tế trên internet. Sử dụng dữ liệu này để làm giàu bài viết, nhưng PHẢI viết lại bằng giọng văn riêng (KHÔNG copy nguyên văn):

${researchContext}

---` : ''}

## NHIỆM VỤ
Viết một bài blog CHẤT LƯỢNG CAO, chuẩn SEO về chủ đề được yêu cầu.

## YÊU CẦU CHẤT LƯỢNG
1. **Human-like**: Viết tự nhiên, có cảm xúc, như một blogger chuyên nghiệp thực thụ
2. **Data-driven**: Sử dụng số liệu thực tế từ nghiên cứu (nếu có)
3. **Actionable**: Mỗi mục phải có lời khuyên cụ thể, có thể áp dụng ngay
4. **SEO**: Đan xen keyword tự nhiên, heading structure rõ ràng (H2/H3)
5. **FinNote**: Giới thiệu khéo léo app FinNote như một giải pháp trong bài
6. **Dài tối thiểu 1500 từ**: Bài viết phải đủ sâu và chi tiết

Trả về ĐÚNG định dạng JSON sau, không kèm bất kỳ text giải thích nào khác ngoài JSON:
{
  "title": "Tiêu đề hấp dẫn (dưới 60 ký tự)",
  "excerpt": "Đoạn mô tả ngắn (dưới 160 ký tự) cho SEO meta description",
  "tags": ["tag1", "tag2", "tag3"],
  "seoKeywords": "keyword1, keyword2, keyword3",
  "youtubeQuery": "từ khóa tìm video YouTube liên quan (tiếng Việt, 3-5 từ)",
  "content": "Nội dung chi tiết bằng Markdown. KHÔNG bao gồm H1. Bắt đầu với đoạn mở bài hấp dẫn, thân bài chia H2/H3 rõ ràng, bullet points, bold text, blockquotes cho số liệu nổi bật, kết bài CTA giới thiệu FinNote.",
  "imagePrompts": ["Mô tả ngắn cho ảnh minh họa section 1", "Mô tả cho ảnh section 2"]
}

QUY TẮC TAGS (BẮT BUỘC):
- Tối đa 3 tags, viết thường, bằng tiếng Việt
- Phù hợp với nội dung bài viết (Ví dụ: "công nghệ", "genz", "tài chính", "xu hướng", "đầu tư")
- KHÔNG dùng tên thương hiệu (Google, Anthropic, Warren Buffett, v.v.)
- KHÔNG trùng lặp

${images.length > 0 ? `QUAN TRỌNG: Người dùng đã cung cấp ${images.length} hình ảnh đính kèm. Bạn CÓ THỂ chèn chúng vào vị trí thích hợp trong bài viết Markdown bằng cú pháp: [IMAGE_0], [IMAGE_1], v.v.` : ''}`

    let text = ''

    if (useGemini) {
      try {
        const promptParts: any[] = []
        if (topic) promptParts.push({ text: `Yêu cầu / Chủ đề: ${topic}` })
        
        images.forEach((img, idx) => {
          const match = img.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/)
          if (match) {
            promptParts.push({ inline_data: { mime_type: match[1], data: match[2] } })
          } else {
            promptParts.push({ inline_data: { mime_type: "image/jpeg", data: img } })
          }
          promptParts.push({ text: `Đây là hình ảnh [IMAGE_${idx}].` })
        })

        if (promptParts.length === 0) promptParts.push({ text: "Hãy viết 1 bài blog thú vị dành cho GenZ." })

        console.log('[BlogGen] Phase 2: Generating content with Gemini...')
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: promptParts }],
              generationConfig: {
                temperature: 0.7,
                response_mime_type: "application/json"
              }
            })
          }
        )

        if (!response.ok) {
          const errObj: any = await response.json().catch(() => ({}))
          geminiError = errObj?.error?.message || `HTTP ${response.status}`
          console.warn('[BlogGen] Gemini gen failed, falling back to CF AI:', geminiError)
          useGemini = false
        } else {
          const data: any = await response.json()
          text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          // BUG FIX: empty Gemini response (safety filter / empty candidates)
          // → fall through to CF AI instead of trying to parse empty string
          if (!text) {
            geminiError = 'Gemini returned empty response (possible safety filter)'
            console.warn('[BlogGen] Gemini returned empty text, falling back to CF AI')
            useGemini = false
          }
        }
      } catch (geminiErr: any) {
        geminiError = geminiErr.message || 'Gemini request failed'
        console.warn('[BlogGen] Gemini error, falling back to CF AI:', geminiError)
        useGemini = false
      }
    }

    // Fallback: Cloudflare Workers AI
    if (!useGemini || !text) {
      if (!env.AI) return errorResponse('AI binding not configured', 503)

      let extractedImageText = ''
      if (images.length > 0) {
        console.log(`[BlogGen] Extracting text from ${images.length} images using CF Vision...`)
        for (let i = 0; i < images.length; i++) {
          const img = images[i]
          const match = img.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/)
          if (match) {
            try {
              const base64Data = match[2]
              const binaryString = atob(base64Data)
              const bytes = new Uint8Array(binaryString.length)
              for (let j = 0; j < binaryString.length; j++) {
                  bytes[j] = binaryString.charCodeAt(j)
              }
              const visionRes = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct' as any, {
                image: [...bytes],
                prompt: "Trích xuất toàn bộ văn bản và mô tả nội dung trong hình ảnh này. Chỉ trả về văn bản hữu ích."
              }) as any
              if (visionRes && visionRes.response) {
                extractedImageText += `\n--- Chi tiết hình ảnh [IMAGE_${i}] ---\n${visionRes.response}\n`
              }
            } catch (err: any) {
              console.warn('[BlogGen] CF Vision failed for image', i, err.message)
            }
          }
        }
      }

      const finalTopic = extractedImageText ? `Chủ đề gốc: ${topic}\n\nDữ liệu từ hình ảnh đính kèm:\n${extractedImageText}` : topic

      const metaPrompt = `Bạn là chuyên gia SEO blog đa chủ đề. Trả về ĐÚNG JSON (không có text thêm):
{"title":"Tiêu đề hấp dẫn dưới 60 ký tự","excerpt":"Mô tả SEO dưới 160 ký tự","tags":["tag1","tag2","tag3"],"seoKeywords":"keyword1, keyword2","imagePrompts":["mô tả ảnh 1","mô tả ảnh 2"]}`
      const metaResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
        messages: [
          { role: 'system', content: metaPrompt },
          { role: 'user', content: `Chủ đề: ${finalTopic}` }
        ],
        max_tokens: 512,
        temperature: 0.7
      }) as any

      let metaText = metaResponse?.response || ''
      const metaMatch = metaText.match(/\{[\s\S]*\}/)
      if (metaMatch) metaText = metaMatch[0]

      let meta: any = {}
      try { meta = JSON.parse(metaText) } catch { meta = { title: finalTopic, excerpt: '', tags: [], seoKeywords: '', imagePrompts: [] } }

      const contentPrompt = `Bạn là chuyên gia viết blog đa chủ đề. Viết bài blog hấp dẫn bằng Markdown cho chủ đề dưới đây.
${researchContext ? `Thông tin nghiên cứu: ${researchContext.substring(0, 1500)}` : ''}
Yêu cầu: KHÔNG bao gồm tiêu đề H1. Bắt đầu trực tiếp với đoạn mở bài, thân bài chia H2/H3, bullet points, bold text, kết bài CTA giới thiệu FinNote.
${images.length > 0 ? `QUAN TRỌNG: Hãy chèn các hình ảnh gốc vào bài viết tại các vị trí phù hợp bằng cú pháp: [IMAGE_0], [IMAGE_1], v.v.` : ''}
Viết tối thiểu 1500 từ, chi tiết và chuyên sâu.
Chỉ trả về nội dung Markdown, không bọc trong JSON hay code block.`
      const contentResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
        messages: [
          { role: 'system', content: contentPrompt },
          { role: 'user', content: `Tiêu đề: ${meta.title || finalTopic}\nChủ đề: ${finalTopic}` }
        ],
        max_tokens: 4096,
        temperature: 0.7
      }) as any

      const blogContent = stripLeadingH1(contentResponse?.response || '')

      return jsonResponse({
        success: true,
        data: {
          title: meta.title || topic,
          excerpt: meta.excerpt || '',
          tags: meta.tags || [],
          seoKeywords: meta.seoKeywords || '',
          content: blogContent,
          imagePrompts: meta.imagePrompts || [],
          groundingSources,
          modelUsed: 'cloudflare',
          geminiError
        }
      })
    }

    // Parse Gemini response — only reached when useGemini=true AND text is non-empty
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) text = jsonMatch[0]

    if (!text) {
      return errorResponse('AI returned empty response. Please try again.', 500)
    }

    let result
    try {
      result = JSON.parse(text)
    } catch {
      // Last resort: try to extract any valid JSON object
      console.error('[BlogGen] JSON parse failed, text snippet:', text.substring(0, 200))
      return errorResponse('Failed to parse AI response. Please try again or switch to Cloudflare AI model.', 500)
    }

    if (result.content) {
      result.content = stripLeadingH1(result.content)
    }

    // Attach grounding sources + model info
    result.groundingSources = groundingSources
    result.modelUsed = 'gemini'

    console.log(`[BlogGen] Done: "${result.title}", ${result.content?.length || 0} chars, ${groundingSources.length} sources, ${result.imagePrompts?.length || 0} image prompts`)

    return jsonResponse({ success: true, data: result })
  } catch (err: any) {
    return errorResponse(err.message || 'AI request failed', 500)
  }
}

export async function handleRefineBlogContent(userId: string, request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) return errorResponse('Forbidden', 403)

  // ?model=cf to skip Gemini and force Cloudflare AI
  const url = new URL(request.url)
  const forceCloudflare = url.searchParams.get('model') === 'cf'

  const draftData = (await request.json()) as any
  if (!draftData || !draftData.content) return errorResponse('Missing draft content', 400)

  const systemPrompt = `Bạn là một Tổng biên tập Blog đa chủ đề cấp cao (Senior Content Editor).
Nhiệm vụ của bạn là đọc và tinh chỉnh (refine) bài blog nháp được cung cấp. Bạn PHẢI:
1. Viết lại bài viết sao cho tự nhiên, giống con người nhất (human-like style).
2. Sửa toàn bộ các lỗi pha trộn ngôn ngữ ngớ ngẩn (ví dụ: "tài chínhallenging", "quản lý cost", v.v.).
3. Bổ sung các ví dụ thực tế (real-world examples) để người đọc dễ hình dung.
4. Bổ sung một checklist hành động cụ thể hoặc giải pháp rõ ràng (actionable advice) cho người dùng.
5. Giữ nguyên hoặc tối ưu lại title, excerpt, tags, seoKeywords cho chuẩn SEO.
Trả về ĐÚNG định dạng JSON sau, không kèm bất kỳ text giải thích nào khác ngoài JSON:
{
  "title": "Tiêu đề hấp dẫn (dưới 60 ký tự)",
  "excerpt": "Đoạn mô tả ngắn (dưới 160 ký tự) cho SEO meta description",
  "tags": ["tag1", "tag2", "tag3"],
  "seoKeywords": "keyword1, keyword2",
  "content": "Nội dung bài viết chi tiết được format bằng Markdown (không chứa H1 đầu bài). Đảm bảo nội dung sắc sảo, tự nhiên, có checklist và ví dụ thực tế."
}

QUY TẮC TAGS: Tối đa 3 tags, viết thường, tiếng Việt, phù hợp nội dung. KHÔNG tên thương hiệu. KHÔNG trùng lặp.`

  try {
    let text = ''
    let useGemini = !!env.GEMINI_API_KEY && !forceCloudflare
    let geminiError: string | undefined
    if (useGemini) {
      try {
        const promptParts = [
          { text: `Đây là bản nháp cần tinh chỉnh:\n\nTitle: ${draftData.title}\nExcerpt: ${draftData.excerpt}\nContent:\n${draftData.content}` }
        ]

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: systemPrompt }]
              },
              contents: [{
                parts: promptParts
              }],
              generationConfig: {
                temperature: 0.5, // lower temp for editor consistency
                response_mime_type: "application/json"
              }
            })
          }
        )

        if (!response.ok) {
          const errData: any = await response.json().catch(() => ({}))
          geminiError = errData?.error?.message || `HTTP ${response.status}`
          console.warn('[BlogRefine] Gemini failed, falling back to CF AI:', geminiError)
          useGemini = false
        } else {
          const data: any = await response.json()
          text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          // BUG FIX: empty Gemini refine response → fall through to CF AI
          if (!text) {
            geminiError = 'Gemini refine returned empty response (possible safety filter)'
            console.warn('[BlogRefine] Gemini returned empty text, falling back to CF AI')
            useGemini = false
          }
        }
      } catch (e: any) {
        geminiError = e.message || 'Gemini request failed'
        console.warn('[BlogRefine] Gemini error, falling back:', geminiError)
        useGemini = false
      }
    }

    if (!useGemini || !text) {
      if (!env.AI) return errorResponse('AI binding not configured', 503)

      // ── CF AI Lightweight Refine ──────────────────────────────
      // BUG FIX: Do NOT send full content in one call (Llama 3.1 8B
      // can't output 1500-word JSON within 2048 tokens → truncation → parse fail)
      // Instead: (1) refine meta only, (2) improve content separately

      // Step 1: Refine meta fields only (compact — fits in 512 tokens)
      const metaOnlyPrompt = `Bạn là SEO editor. Tối ưu các trường sau cho chuẩn SEO, trả về JSON thuần (không text khác):
{"title":"Tiêu đề tối ưu dưới 60 ký tự","excerpt":"Mô tả SEO dưới 160 ký tự","tags":["tag1","tag2","tag3"],"seoKeywords":"keyword1, keyword2, keyword3"}`
      
      let refinedMeta: any = {
        title: draftData.title || '',
        excerpt: draftData.excerpt || '',
        tags: draftData.tags || [],
        seoKeywords: draftData.seoKeywords || ''
      }

      try {
        const metaRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
          messages: [
            { role: 'system', content: metaOnlyPrompt },
            { role: 'user', content: `Title: ${draftData.title}\nExcerpt: ${draftData.excerpt}\nTags: ${(draftData.tags || []).join(', ')}\nKeywords: ${draftData.seoKeywords || ''}` }
          ],
          max_tokens: 400,
          temperature: 0.3
        }) as any

        const metaRaw = metaRes?.response || ''
        const metaMatch = metaRaw.match(/\{[\s\S]*\}/)
        if (metaMatch) {
          try { refinedMeta = { ...refinedMeta, ...JSON.parse(metaMatch[0]) } } catch { /* keep original */ }
        }
      } catch { /* keep original meta on error */ }

      // Step 2: Light content polish (plain text in, plain text out — no JSON wrapping)
      const contentPolishPrompt = `Bạn là editor viết blog chuyên nghiệp. Hãy cải thiện bài viết sau:
- Sửa lỗi pha trộn ngôn ngữ (vd: "tài chínhallenging" → "tài chính thách thức")
- Thêm 1-2 ví dụ thực tế nếu thiếu
- KHÔNG thay đổi cấu trúc heading/markdown
- KHÔNG bọc trong JSON hay code block
- Trả về nội dung Markdown trực tiếp`

      let refinedContent = draftData.content || ''

      // Only polish if content is reasonable length (avoid timeout on very long content)
      if (refinedContent.length < 8000) {
        try {
          const contentTruncated = refinedContent.substring(0, 4000) // limit input
          const contentRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
            messages: [
              { role: 'system', content: contentPolishPrompt },
              { role: 'user', content: contentTruncated }
            ],
            max_tokens: 4096,
            temperature: 0.4
          }) as any
          const polished = contentRes?.response || ''
          if (polished.length > 200) {
            // Verify it's actually content (not an error message or empty)
            refinedContent = polished
          }
        } catch { /* keep original content on error */ }
      }

      // Assemble result without JSON parse — guaranteed safe
      const cfResult: any = {
        title: refinedMeta.title || draftData.title,
        excerpt: refinedMeta.excerpt || draftData.excerpt,
        tags: Array.isArray(refinedMeta.tags) ? refinedMeta.tags : (draftData.tags || []),
        seoKeywords: refinedMeta.seoKeywords || draftData.seoKeywords || '',
        content: refinedContent,
        modelUsed: 'cloudflare',
        geminiError
      }

      function stripH1(md: string) { return md.replace(/^\s*#\s+[^\n]+\n*/m, '').trim() }
      if (cfResult.content) cfResult.content = stripH1(cfResult.content)

      console.log(`[BlogRefine] CF AI done: "${cfResult.title}", ${cfResult.content.length} chars`)
      return jsonResponse({ success: true, data: cfResult })
    }

    // BUG FIX: Gemini refine returned empty text → fall through to CF AI
    if (!text) {
      if (!geminiError) geminiError = 'Gemini refine returned empty response'
      console.warn('[BlogRefine] Gemini empty text, using draft as-is')
      return jsonResponse({
        success: true,
        data: { ...draftData, modelUsed: 'cloudflare', geminiError }
      })
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) text = jsonMatch[0]
    
    let result
    try {
      result = JSON.parse(text)
    } catch {
      // Parse failed: return original draft instead of hard error
      console.error('[BlogRefine] Gemini JSON parse failed, returning original draft')
      return jsonResponse({
        success: true,
        data: {
          ...draftData,
          modelUsed: 'cloudflare',
          geminiError: 'Gemini response parse failed, using original draft'
        }
      })
    }

    function stripLeadingH1(md: string): string {
      return md.replace(/^\s*#\s+[^\n]+\n*/m, '').trim()
    }
    if (result.content) {
      result.content = stripLeadingH1(result.content)
    }

    result.modelUsed = !forceCloudflare && env.GEMINI_API_KEY && !geminiError ? 'gemini' : 'cloudflare'
    if (geminiError) result.geminiError = geminiError

    return jsonResponse({ success: true, data: result })
  } catch (err: any) {
    return errorResponse(err.message || 'AI request failed', 500)
  }
}


export async function handleGenerateBlogImage(userId: string, request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) return errorResponse('Forbidden', 403)
  if (!env.AI) return errorResponse('AI binding not configured', 503)

  const { prompt } = (await request.json()) as { prompt: string }
  if (!prompt) return errorResponse('Missing prompt', 400)

  const optimizedPrompt = `A premium, modern illustration for a blog: ${prompt}. Style: clean gradient background, minimal flat design, professional theme, vivid accent colors, editorial quality.`

  try {
    const response: any = await env.AI.run('@cf/black-forest-labs/flux-1-schnell' as any, {
      prompt: optimizedPrompt,
      num_steps: 4
    })

    // Diagnostic: log what the AI actually returned
    const responseType = typeof response
    const isStream = response instanceof ReadableStream
    const isBuffer = response instanceof ArrayBuffer
    const hasImage = response?.image !== undefined
    const imageType = hasImage ? typeof response.image : 'N/A'
    console.log(`[BlogImage] AI response — type: ${responseType}, isStream: ${isStream}, isBuffer: ${isBuffer}, hasImage: ${hasImage}, imageType: ${imageType}`)

    let imageBytes: Uint8Array

    // Official Cloudflare docs pattern: response.image is a base64 string (JPEG)
    // Reference: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
    if (hasImage && typeof response.image === 'string' && response.image.length > 100) {
      const binaryString = atob(response.image)
      imageBytes = Uint8Array.from(binaryString, (m) => m.codePointAt(0)!)
      console.log(`[BlogImage] Decoded base64 image: ${imageBytes.length} bytes`)
    } else if (isStream) {
      // Fallback: some SDK versions may return ReadableStream
      const arrayBuffer = await new Response(response).arrayBuffer()
      imageBytes = new Uint8Array(arrayBuffer)
      console.log(`[BlogImage] Read stream image: ${imageBytes.length} bytes`)
    } else if (isBuffer) {
      imageBytes = new Uint8Array(response)
      console.log(`[BlogImage] ArrayBuffer image: ${imageBytes.length} bytes`)
    } else {
      // Last resort: try to get any data
      const debugStr = JSON.stringify(response)?.substring(0, 300) || String(response)
      console.error(`[BlogImage] UNEXPECTED response format: ${debugStr}`)
      return errorResponse(`Unexpected AI response format (type: ${responseType})`, 500)
    }

    // Validate: must have substantial binary data
    if (imageBytes.length < 1000) {
      console.error(`[BlogImage] Image too small: ${imageBytes.length} bytes`)
      return errorResponse('AI generated invalid image (too small)', 500)
    }

    // Validate: first bytes should be valid image magic bytes
    const magicOk = (
      (imageBytes[0] === 0xFF && imageBytes[1] === 0xD8) || // JPEG
      (imageBytes[0] === 0x89 && imageBytes[1] === 0x50) || // PNG
      (imageBytes[0] === 0x52 && imageBytes[1] === 0x49) || // RIFF (WebP)
      (imageBytes[0] === 0x47 && imageBytes[1] === 0x49)    // GIF
    )
    if (!magicOk) {
      console.error(`[BlogImage] Invalid magic bytes: [${imageBytes[0]}, ${imageBytes[1]}, ${imageBytes[2]}, ${imageBytes[3]}]`)
      // Still store it — flux-1-schnell produces JPEG but bytes may vary
    }

    // Detect content type (flux-1-schnell defaults to JPEG)
    let contentType = 'image/jpeg'
    if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50) contentType = 'image/png'
    else if (imageBytes[0] === 0x52 && imageBytes[1] === 0x49) contentType = 'image/webp'

    // Store in KV as proper binary with metadata
    const imageId = generateId()
    await env.SMART_NOTE_KV.put(`public/images/${imageId}`, imageBytes, {
      metadata: { contentType }
    })
    
    console.log(`[BlogImage] Stored image ${imageId}: ${imageBytes.length} bytes, ${contentType}`)

    const host = new URL(request.url).origin
    const imageUrl = `${host}/api/images/${imageId}`

    return jsonResponse({ success: true, data: { imageUrl } })
  } catch (err: any) {
    console.error(`[BlogImage] Generation error:`, err.message, err.stack)
    return errorResponse(err.message || 'Image generation failed', 500)
  }
}

// Upload image from base64 (manual upload fallback)
export async function handleUploadImage(userId: string, request: Request, env: Env): Promise<Response> {
  if (!(await isAdmin(userId, env))) return errorResponse('Forbidden', 403)

  const { image } = (await request.json()) as { image: string }
  if (!image) return errorResponse('Missing image data', 400)

  try {
    // Strip data URL prefix if present
    let base64Data = image
    let contentType = 'image/jpeg'
    const dataUrlMatch = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
    if (dataUrlMatch) {
      contentType = dataUrlMatch[1]
      base64Data = dataUrlMatch[2]
    }

    // Decode base64 to binary
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    if (bytes.length < 100) {
      return errorResponse('Image data too small', 400)
    }

    // Save to KV with metadata
    const imageId = generateId()
    await env.SMART_NOTE_KV.put(`public/images/${imageId}`, bytes, {
      metadata: { contentType }
    })

    const host = new URL(request.url).origin
    const imageUrl = `${host}/api/images/${imageId}`

    return jsonResponse({ success: true, data: { imageUrl } })
  } catch (err: any) {
    return errorResponse(err.message || 'Image upload failed', 500)
  }
}

