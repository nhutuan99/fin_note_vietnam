import { Env, UserData, NoteData, TransactionData, WalletData, NotificationData, PendingNotification, PendingTransfer } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'
import { sendPushToUser } from './push.controller'
import { upsertNoteIndexItem } from './note.controller'

// ====== Telegram Webhook (OpenClaw) ======

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get('X-Webhook-Secret')
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return errorResponse('Unauthorized webhook', 401)
  }

  const body = (await request.json()) as any
  const { userId, type, amount, category, note, wallet } = body

  if (!userId || !amount || !type) {
    return errorResponse('Missing required fields: userId, amount, type')
  }

  const wallets =
    (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []

  let walletId = wallets[0]?.id || ''
  if (wallet) {
    const found = wallets.find((w) => w.name.toLowerCase().includes(wallet.toLowerCase()))
    if (found) walletId = found.id
  }

  const txs =
    (await getJSON<TransactionData[]>(
      env.SMART_NOTE_KV,
      `users/${userId}/finance/transactions`
    )) || []

  const tx: TransactionData = {
    id: generateId(),
    type,
    amount: Math.abs(amount),
    category: category || (type === 'expense' ? 'other_expense' : 'other_income'),
    note: note || '',
    walletId,
    source: 'telegram',
    date: new Date().toISOString().substring(0, 10),
    createdAt: new Date().toISOString()
  }

  txs.push(tx)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`, txs)

  const walletIdx = wallets.findIndex((w) => w.id === walletId)
  if (walletIdx !== -1) {
    wallets[walletIdx].balance += tx.type === 'income' ? tx.amount : -tx.amount
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)
  }

  return jsonResponse({
    success: true,
    data: tx,
    message: `Đã ghi ${tx.type === 'income' ? 'thu' : 'chi'} ${tx.amount.toLocaleString('vi-VN')}đ vào ${wallets[walletIdx]?.name || 'ví'}`
  })
}

// ====== Bank Notification Parser ======

export interface ParsedTransaction {
  type: 'income' | 'expense'
  amount: number
  walletHint: string
  note: string
}

function parseAmount(text: string): number {
  // Match Vietnamese amount formats: 500,000 or 500.000 or 500000
  const match = text.match(/([\d.,]+)\s*(?:VND|đ|d|vnd)/i)
  if (!match) return 0
  // Remove separators, keep only digits
  return parseInt(match[1].replace(/[.,]/g, ''), 10) || 0
}

export function parseNotification(appName: string, text: string): ParsedTransaction | null {
  const lowerApp = appName.toLowerCase()
  const lowerText = text.toLowerCase()

  // Detect bank from app name or text content
  let walletHint = ''
  if (lowerApp.includes('vietcombank') || lowerApp.includes('vcb') || lowerText.includes('vietcombank'))
    walletHint = 'Vietcombank'
  else if (lowerApp.includes('techcombank') || lowerApp.includes('tcb') || lowerText.includes('techcombank'))
    walletHint = 'Techcombank'
  else if (lowerApp.includes('mbbank') || lowerApp.includes('mb bank') || lowerText.includes('mbbank'))
    walletHint = 'MBBank'
  else if (lowerApp.includes('tpbank') || lowerApp.includes('tpb') || lowerText.includes('tpbank'))
    walletHint = 'TPBank'
  else if (lowerApp.includes('momo') || lowerText.includes('momo'))
    walletHint = 'MoMo'
  else if (lowerApp.includes('zalopay') || lowerApp.includes('zalo pay') || lowerText.includes('zalopay'))
    walletHint = 'ZaloPay'
  else if (lowerApp.includes('bidv') || lowerText.includes('bidv'))
    walletHint = 'BIDV'
  else if (lowerApp.includes('agribank') || lowerText.includes('agribank'))
    walletHint = 'Agribank'
  else if (lowerApp.includes('vietinbank') || lowerText.includes('vietinbank'))
    walletHint = 'VietinBank'
  else if (lowerApp.includes('acb') || lowerText.includes('acb'))
    walletHint = 'ACB'

  // Extract amount
  const amount = parseAmount(text)
  if (amount <= 0) return null

  // Determine transaction type
  let type: 'income' | 'expense' = 'expense'

  // Income indicators
  const incomeKeywords = ['ghi có', 'ghi co', 'nhận', 'nhan', 'nhận được', '+', 'credited', 'received', 'cộng']
  // Expense indicators  
  const expenseKeywords = ['ghi nợ', 'ghi no', 'thanh toán', 'thanh toan', 'trừ', 'tru', '-', 'debited', 'chi', 'chuyển', 'chuyen']

  if (incomeKeywords.some(k => lowerText.includes(k))) type = 'income'
  if (expenseKeywords.some(k => lowerText.includes(k))) type = 'expense'

  // Check for +/- sign before amount
  const signMatch = text.match(/([+-])\s*[\d.,]+\s*(?:VND|đ|d)/i)
  if (signMatch) {
    type = signMatch[1] === '+' ? 'income' : 'expense'
  }

  // Extract note/description (ND:, Noi dung:, etc.)
  let note = ''
  const ndMatch = text.match(/(?:ND|Noi dung|Ref|nội dung)[:\s]+(.*?)(?:\.|$)/i)
  if (ndMatch) note = ndMatch[1].trim()

  return { type, amount, walletHint, note }
}

export async function handleNotificationWebhook(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get('X-Webhook-Secret')
  if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return errorResponse('Unauthorized webhook', 401)
  }

  const body = (await request.json()) as any
  const { userId, appName, text, title } = body

  if (!userId || !text) {
    return errorResponse('Missing required fields: userId, text')
  }

  const fullText = title ? `${title} ${text}` : text
  const parsed = parseNotification(appName || '', fullText)

  // If parsing failed, save as pending notification
  if (!parsed) {
    const pending = (await getJSON<PendingNotification[]>(
      env.SMART_NOTE_KV,
      `users/${userId}/finance/pending`
    )) || []

    pending.push({
      id: generateId(),
      rawText: fullText,
      appName: appName || 'Unknown',
      status: 'pending',
      createdAt: new Date().toISOString()
    })

    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/pending`, pending)

    return jsonResponse({
      success: false,
      error: 'Không thể detect giao dịch, đã lưu vào pending',
      data: { rawText: fullText, status: 'pending' }
    })
  }

  // Match wallet by hint
  const wallets = (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []
  let walletId = wallets[0]?.id || ''
  if (parsed.walletHint) {
    const found = wallets.find(w => w.name.toLowerCase().includes(parsed.walletHint.toLowerCase()))
    if (found) walletId = found.id
  }

  // Create transaction
  const txs = (await getJSON<TransactionData[]>(
    env.SMART_NOTE_KV,
    `users/${userId}/finance/transactions`
  )) || []

  const tx: TransactionData = {
    id: generateId(),
    type: parsed.type,
    amount: parsed.amount,
    category: parsed.type === 'expense' ? 'bank_transfer' : 'bank_receive',
    note: parsed.note || `Auto: ${appName || 'notification'}`,
    walletId,
    source: 'notification',
    date: new Date().toISOString().substring(0, 10),
    createdAt: new Date().toISOString()
  }

  txs.push(tx)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`, txs)

  const walletIdx = wallets.findIndex(w => w.id === walletId)
  if (walletIdx !== -1) {
    wallets[walletIdx].balance += tx.type === 'income' ? tx.amount : -tx.amount
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)
  }

  // Create notification (was missing — only transaction was created before)
  const walletName = wallets.find(w => w.id === walletId)?.name || 'ví'
  const notiList = (await getJSON<NotificationData[]>(
    env.SMART_NOTE_KV, `users/${userId}/notifications`
  )) || []
  notiList.unshift({
    id: generateId(),
    type: parsed.type === 'income' ? 'bank_in' : 'bank_out',
    title: `[Notification] ${parsed.type === 'income' ? 'Tiền vào tài khoản' : 'Tiền ra tài khoản'}`,
    body: `${parsed.type === 'income' ? '+' : '-'}${parsed.amount.toLocaleString('vi-VN')}đ • Ghi vào ví: ${walletName}`,
    read: false,
    createdAt: new Date().toISOString(),
    meta: { amount: parsed.amount, txType: parsed.type, walletName, bankName: parsed.walletHint || appName || '' }
  })
  if (notiList.length > 100) notiList.splice(100)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notifications`, notiList)

  // Send push notification to user's devices
  try {
    let pushTitle = parsed.type === 'income' ? '💰 Tiền vào tài khoản' : '💸 Tiền ra tài khoản'
    let pushBody = `${parsed.type === 'income' ? '+' : '-'}${parsed.amount.toLocaleString('vi-VN')}đ • ${walletName}`
    let url = '/'

    const pendingTransferId = await checkAndCreatePendingTransfer(userId, tx, walletName, env)
    if (pendingTransferId) {
      pushTitle = '⚠️ Xác nhận giao dịch lớn'
      pushBody = `Bạn vừa chuyển đi -${tx.amount.toLocaleString('vi-VN')}đ từ ${walletName}. Nhấp để xác nhận nếu đây là chuyển khoản nội bộ.`
      url = `/?confirm_transfer=${pendingTransferId}`
    }

    const unreadCount = notiList.filter(n => !n.read).length
    await sendPushToUser(userId, env, { title: pushTitle, body: pushBody, tag: `tx-${tx.id}`, url, unreadCount })
  } catch { /* push is best-effort */ }

  return jsonResponse({
    success: true,
    data: tx,
    message: `[Notification] ${tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString('vi-VN')}đ → Ghi vào ví: ${walletName}`
  })
}

// ====== Telegram Trading Signal Webhook ======

export async function handleTradingSignalWebhook(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const secret = request.headers.get('X-Webhook-Secret') || url.searchParams.get('secret')

  if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return errorResponse('Unauthorized webhook', 401)
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch (err) {
    // If not JSON, try text body
    try {
      const textBody = await request.text()
      if (textBody) {
        body = { text: textBody }
      }
    } catch {
      return errorResponse('Invalid request body', 400)
    }
  }

  const userId = url.searchParams.get('userId') || body.userId
  const text = body.text || body.message || body.content

  if (!userId || !text) {
    return errorResponse('Missing required fields: userId, text', 400)
  }

  let analyzedContent = ''
  let modelUsed = 'gemini'

  const systemPrompt = `Bạn là một chuyên gia phân tích kỹ thuật và cố vấn giao dịch tài chính chuyên nghiệp (Trading Assistant) tích hợp trong ứng dụng FinNote.
Nhiệm vụ của bạn là nhận dữ liệu cảnh báo thị trường (Market Alert/Signal) thô từ tin nhắn Telegram của người dùng, phân tích và trích xuất ra các cơ hội giao dịch (Entry, Stop Loss, Take Profit) tối ưu nhất dựa trên các quy tắc giao dịch chuyên nghiệp và Playbook được cung cấp trong tin nhắn.

## YÊU CẦU PHÂN TÍCH:
1. Đọc và hiểu kỹ dữ liệu thô: Nhận diện danh sách CRYPTO, VNSTOCK, FOREX/GOLD cùng các thông số phần trăm thay đổi, điểm số sức mạnh (ví dụ: 82/100), và trạng thái xu hướng (xu thế) của tài sản (ví dụ: Pre Bull, Pre Bear, Accum, FOMO).
2. Lọc ra các tài sản tiềm năng cao nhất:
   - Ưu tiên các tài sản có trạng thái "Pre Bull" hoặc "Pre Bear" mới chớm hình thành, có điểm sức mạnh cao (ví dụ: > 75/100 đối với Bull) hoặc yếu nhất (đối với Bear) và có biến động phần trăm rõ ràng.
   - Tránh các tài sản đang ở trạng thái cực đoan như "FOMO" hoặc "đuổi lệnh" trừ khi có setup cực đẹp.
3. Tham chiếu Playbook (AI Recommend) từ chính tin nhắn thô để đưa ra các lời khuyên quản lý vốn và quản trị rủi ro phù hợp (ví dụ: giữ size nhỏ, chờ xác nhận, tránh đoán đáy).
4. Đưa ra chi tiết kế hoạch giao dịch cho từng tài sản tiềm năng:
   - Tên tài sản (Ví dụ: ALLO, PLUME, MSB, NZDUSD)
   - Loại tài sản (Crypto / VNStock / Forex)
   - Hành động đề xuất: Mua (Long/Buy), Bán (Short/Sell), Chờ thêm tín hiệu (Wait), hoặc Bỏ qua (Avoid).
   - Vùng Entry (Vào lệnh) đề xuất.
   - Điểm cắt lỗ (Stop Loss - SL) đề xuất.
   - Điểm chốt lời (Take Profit - TP) đề xuất (tối thiểu 2 mục tiêu TP1, TP2).
   - Phân tích/Lý do đề xuất ngắn gọn dựa trên chỉ số sức mạnh.

## ĐỊNH DẠNG ĐẦU RA:
- Trả về nội dung định dạng HTML sạch, chuyên nghiệp, đẹp mắt để hiển thị trực tiếp trong editor (Tiptap) của ứng dụng.
- KHÔNG bao gồm các thẻ <html> hay <body>, chỉ dùng các thẻ tiêu đề (<h2>, <h3>), danh sách (<ul>, <li>), bảng (<table>, <tr>, <th>, <td>), chữ đậm (<strong>), khối trích dẫn (<blockquote>) và các thẻ cơ bản khác.
- Thiết kế giao diện HTML bắt mắt:
  - Dùng bảng (table) có viền nhẹ, khoảng đệm (padding) hợp lý, căn lề sạch sẽ.
  - Sử dụng mã màu phù hợp: màu xanh lá (#10b981) cho Long/Buy/Bull, màu đỏ (#ef4444) cho Short/Sell/Bear, màu cam (#f59e0b) cho Accum/Wait.
  - Tạo điểm nhấn thị giác bằng các màu nền nhẹ nhàng, hài hòa.
- Mở đầu bằng một tóm tắt ngắn gọn về trạng thái thị trường tổng quan. Kết luận bằng các lưu ý quản trị vốn theo Playbook.`

  if (env.GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: `Dữ liệu tín hiệu thô nhận từ Telegram:\n\n${text}` }] }],
            generationConfig: {
              temperature: 0.5,
            }
          })
        }
      )

      if (response.ok) {
        const data: any = await response.json()
        analyzedContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } else {
        const errObj = await response.json().catch(() => ({}))
        console.warn('[TradingSignalAI] Gemini call failed, trying Cloudflare AI:', errObj)
        modelUsed = 'cloudflare'
      }
    } catch (err) {
      console.warn('[TradingSignalAI] Gemini fetch error, trying Cloudflare AI:', err)
      modelUsed = 'cloudflare'
    }
  } else {
    modelUsed = 'cloudflare'
  }

  // Fallback to Cloudflare AI if Gemini failed or wasn't configured
  if (modelUsed === 'cloudflare') {
    if (!env.AI) {
      return errorResponse('AI service not configured on host', 503)
    }

    try {
      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Dữ liệu tín hiệu thô nhận từ Telegram:\n\n${text}` }
        ],
        max_tokens: 2048,
        temperature: 0.5
      }) as any

      analyzedContent = response?.response || ''
    } catch (err: any) {
      return errorResponse(`AI analysis failed: ${err.message || err}`, 500)
    }
  }

  if (!analyzedContent) {
    return errorResponse('Failed to generate entry analysis from signal', 500)
  }

  // Clean markdown wrapping if present
  let cleanHtml = analyzedContent
  const htmlMatch = cleanHtml.match(/```html([\s\S]*?)```/)
  if (htmlMatch) {
    cleanHtml = htmlMatch[1].trim()
  } else {
    const mdMatch = cleanHtml.match(/```([\s\S]*?)```/)
    if (mdMatch) {
      cleanHtml = mdMatch[1].trim()
    }
  }

  // 2. Create a new Note for the user
  const noteId = generateId()
  const now = new Date().toISOString()
  
  // Format Vietnam Date/Time for note title
  const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  const title = `🤖 AI Entry Finder - ${vnTime}`

  const note: NoteData = {
    id: noteId,
    title,
    content: cleanHtml,
    tags: ['ai-entry', 'trading-signal'],
    pinned: true,
    createdAt: now,
    updatedAt: now
  }

  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notes/${noteId}`, note)

  // 3. Update the note index
  await upsertNoteIndexItem(userId, note, env)

  // 4. Create in-app notification
  const notiList = (await getJSON<NotificationData[]>(env.SMART_NOTE_KV, `users/${userId}/notifications`)) || []
  notiList.unshift({
    id: generateId(),
    type: 'system',
    title: `🤖 AI Entry Finder`,
    body: `Đã phân tích tín hiệu và tìm thấy entry giao dịch mới!`,
    read: false,
    createdAt: now
  })
  if (notiList.length > 100) notiList.splice(100)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notifications`, notiList)

  // 5. Send push notification to user's devices
  try {
    const unreadCount = notiList.filter(n => !n.read).length
    await sendPushToUser(userId, env, {
      title: '🤖 AI Entry Finder',
      body: 'Đã phân tích và tìm thấy entry giao dịch mới. Nhấp để xem chi tiết!',
      tag: `trading-signal-${noteId}`,
      url: `/notes/${noteId}`,
      unreadCount
    })
  } catch (err) {
    console.warn('[TradingSignalAI] Push notification failed:', err)
  }

  return jsonResponse({
    success: true,
    message: 'Tín hiệu đã được phân tích và lưu thành ghi chú mới.',
    data: {
      noteId,
      title,
      modelUsed
    }
  })
}

// ====== Large Transfer Pending Transfer Helper ======

export async function checkAndCreatePendingTransfer(
  userId: string,
  tx: TransactionData,
  walletName: string,
  env: Env
): Promise<string | null> {
  if (tx.type !== 'expense' || tx.amount < 3000000) {
    return null
  }

  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (user?.disableLargeTransferConfirmation) {
    return null
  }

  const pendingTransfers = (await getJSON<PendingTransfer[]>(
    env.SMART_NOTE_KV,
    `users/${userId}/finance/pending_transfers`
  )) || []

  const pendingId = generateId()
  const pending: PendingTransfer = {
    id: pendingId,
    transactionId: tx.id,
    amount: tx.amount,
    walletId: tx.walletId,
    walletName,
    note: tx.note,
    date: tx.date,
    createdAt: new Date().toISOString(),
    status: 'pending'
  }

  pendingTransfers.push(pending)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/pending_transfers`, pendingTransfers)

  return pendingId
}



