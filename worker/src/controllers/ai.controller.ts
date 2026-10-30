import { Env } from '../types'
import { errorResponse, jsonResponse, corsHeaders } from '../utils/response'

// ====== Cloudflare Workers AI ======

const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct'

const AI_SYSTEM_PROMPTS: Record<string, string> = {
  summarize: 'You are a concise summarizer. Summarize the user content into bullet points (max 5). Reply in the same language as the content. Return ONLY the bullet list, no intro or explanation.',
  continue: 'You are a writing assistant. Continue the user text naturally in 2-3 sentences. Match the tone and language. Return ONLY the continuation, no explanation.',
  improve: 'You are an editor. Improve the grammar and style of the user text. Keep the original meaning and language. Return ONLY the improved text.',
  tags: 'You are a tagging assistant. Suggest 3-5 relevant tags for the content. Return ONLY a comma-separated list of lowercase tags, nothing else.',
  ask: 'You are a helpful assistant. Answer the user question based on the provided note content. Be concise and clear.',
  finance: `Bạn là chuyên gia tư vấn tài chính cá nhân thông minh cho ứng dụng FinNote.
Nhiệm vụ: Phân tích dữ liệu tài chính thực tế của người dùng và trả lời câu hỏi của họ một cách chính xác, ngắn gọn, thực tế.
Quy tắc quan trọng:
- Chỉ tư vấn dựa trên số liệu thực tế đã được cung cấp (số dư tài khoản, thu chi tháng)
- KHÔNG bịa đặt số liệu hay đưa ra con số không có trong dữ liệu
- Trả lời bằng tiếng Việt, dùng Markdown và emoji
- Ngắn gọn, tối đa 200 từ
- Nếu câu hỏi không liên quan đến tài chính, lịch sự từ chối và nhắc lại vai trò`,
  rewrite_note: `Bạn là một trợ lý thông minh. Nhiệm vụ của bạn là viết lại và trình bày nội dung ghi chú được cung cấp một cách chuyên nghiệp, sạch sẽ, súc tích và mạch lạc.
Nếu trong nội dung có các công việc cần làm (to-do, checklist), hãy sử dụng thẻ HTML để tạo danh sách công việc. Ví dụ: <ul data-type="taskList"><li data-type="taskItem"><label><input type="checkbox"><span>Nội dung việc cần làm</span></label></li></ul>.
Trả về nội dung được định dạng dưới dạng HTML hợp lệ để hiển thị trong Tiptap editor. Không bao gồm thẻ <html> hay <body>.`,
  format_json: `Bạn là một công cụ định dạng JSON chuyên nghiệp (JSON Formatter/Beautifier).
Nhiệm vụ: Lấy đoạn text đầu vào (có thể là JSON lỗi, JSON thu gọn, hoặc log chứa JSON) và định dạng nó thành một JSON object/array hoàn chỉnh, hợp lệ, lề 2 spaces.
Yêu cầu bắt buộc:
- CHỈ TRẢ VỀ JSON ĐÃ FORMAT BÊN TRONG MARKDOWN CODE BLOCK (\`\`\`json ... \`\`\`).
- KHÔNG CÓ LỜI GIẢI THÍCH, KHÔNG CÓ TEXT NÀO KHÁC BÊN NGOÀI BLOCK.
- Sửa các lỗi nháy đơn, thiếu dấu phẩy nếu có thể để JSON hợp lệ.`
}

async function extractTextFromImages(env: Env, imagesBase64?: string[]): Promise<string> {
  if (!imagesBase64 || imagesBase64.length === 0) return ''
  
  let extractedImageText = ''
  for (let i = 0; i < imagesBase64.length; i++) {
    const img = imagesBase64[i]
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
        console.warn('[AI] CF Vision failed for image', i, err.message)
      }
    }
  }
  return extractedImageText
}

export async function handleAi(request: Request, env: Env): Promise<Response> {
  if (!env.AI) return errorResponse('AI binding not configured', 503)

  const body = (await request.json()) as any
  const { action, content, question, imagesBase64 } = body

  if (!action) return errorResponse('Missing action')
  if (!content && action !== 'ask') return errorResponse('Note content is required')
  if (action === 'ask' && !question) return errorResponse('Missing question')

  const systemPrompt = AI_SYSTEM_PROMPTS[action]
  if (!systemPrompt) return errorResponse(`Unknown action: ${action}`)

  const extractedImageText = await extractTextFromImages(env, imagesBase64)
  const fullContent = extractedImageText ? `${content}\n\n[Dữ liệu từ hình ảnh đính kèm]:\n${extractedImageText}` : content

  let userMessage: string
  if (action === 'finance') {
    userMessage = fullContent
  } else if (action === 'ask') {
    userMessage = fullContent
      ? `Note content:\n${fullContent}\n\nQuestion: ${question}`
      : `Question: ${question}`
  } else if (action === 'tags') {
    userMessage = `Title: ${body.title || ''}\nContent: ${fullContent.substring(0, 600)}`
  } else if (action === 'rewrite_note') {
    userMessage = fullContent
  } else {
    userMessage = fullContent
  }

  try {
    const response = await env.AI.run(AI_MODEL as any, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 512,
      temperature: 0.7
    }) as any

    const text = response?.response || ''
    return jsonResponse({ success: true, data: text })
  } catch (err: any) {
    return errorResponse(err.message || 'AI request failed', 500)
  }
}

export async function handleAiStream(request: Request, env: Env): Promise<Response> {
  if (!env.AI) return errorResponse('AI binding not configured', 503)

  const body = (await request.json()) as any
  const { action, content, question, imagesBase64 } = body

  if (!action) return errorResponse('Missing action')
  if (!content && action !== 'ask') return errorResponse('Note content is required')
  if (action === 'ask' && !question) return errorResponse('Missing question')

  const systemPrompt = AI_SYSTEM_PROMPTS[action]
  if (!systemPrompt) return errorResponse(`Unknown action: ${action}`)

  const extractedImageText = await extractTextFromImages(env, imagesBase64)
  const fullContent = extractedImageText ? `${content}\n\n[Dữ liệu từ hình ảnh đính kèm]:\n${extractedImageText}` : content

  let userMessage: string
  if (action === 'finance') {
    // Finance advisor: content already contains the full context + embedded question
    // Do NOT wrap with "Note content:" — that confuses the model about its role
    userMessage = fullContent
  } else if (action === 'ask') {
    userMessage = fullContent
      ? `Note content:\n${fullContent}\n\nQuestion: ${question}`
      : `Question: ${question}`
  } else if (action === 'tags') {
    userMessage = `Title: ${body.title || ''}\nContent: ${fullContent.substring(0, 600)}`
  } else if (action === 'rewrite_note') {
    userMessage = fullContent
  } else {
    userMessage = fullContent
  }

  try {
    const stream = await (env.AI as any).run(AI_MODEL, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 512,
      temperature: 0.7,
      stream: true
    }) as ReadableStream

    const cors = corsHeaders(env, request.headers.get('Origin'))
    return new Response(stream, {
      headers: {
        ...cors,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      }
    })
  } catch (err: any) {
    return errorResponse(err.message || 'AI stream failed', 500)
  }
}

