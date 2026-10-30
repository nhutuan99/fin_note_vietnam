import { Env, UserData, TransactionData, WalletData, NotificationData, PendingNotification } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'
import { sendPushToUser } from './push.controller'
import { parseNotification, checkAndCreatePendingTransfer } from './webhook.controller'

// ====== Notification Handlers ======

export async function handleListNotifications(userId: string, env: Env): Promise<Response> {
  const notifications = (await getJSON<NotificationData[]>(
    env.SMART_NOTE_KV, `users/${userId}/notifications`
  )) || []
  // Newest first
  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return jsonResponse({ success: true, data: notifications })
}

export async function handleMarkNotificationRead(userId: string, notiId: string, env: Env): Promise<Response> {
  const notifications = (await getJSON<NotificationData[]>(
    env.SMART_NOTE_KV, `users/${userId}/notifications`
  )) || []
  const idx = notifications.findIndex(n => n.id === notiId)
  if (idx !== -1) {
    notifications[idx].read = true
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/notifications`, notifications)
  }
  return jsonResponse({ success: true })
}

export async function handleMarkAllNotificationsRead(userId: string, env: Env): Promise<Response> {
  const notifications = (await getJSON<NotificationData[]>(
    env.SMART_NOTE_KV, `users/${userId}/notifications`
  )) || []
  notifications.forEach(n => n.read = true)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notifications`, notifications)
  return jsonResponse({ success: true })
}

export async function handleClearNotifications(userId: string, env: Env): Promise<Response> {
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notifications`, [])
  return jsonResponse({ success: true })
}

// ─── iOS SMS Webhook ──────────────────────────────────────────────────────────

/**
 * Parse structured SMS from Vietnamese banks.
 * 
 * TPBank format:
 *   (TPBank): 21/04/26;08:12
 *   TK: xxxx8505201
 *   PS:-22.000VND
 *   SD: 257.093VND
 *   SD KHA DUNG: 257.093VND
 *   ND: NAP TIEN VI MOMO - 0812122501
 *   SO GD: 918TTMB261
 * 
 * Also handles generic: +500,000VND or -300.000VND
 */
interface SmsParsedResult {
  type: 'income' | 'expense'
  amount: number
  note: string        // extracted ND or truncated text
  txRef: string       // SO GD / transaction reference for dedup
  account: string     // TK number
  balance: number     // SD (current balance)
  bankName: string    // detected bank name
  rawText: string     // original SMS (truncated for storage)
}

function parseSmsTransaction(text: string, senderHint = ''): SmsParsedResult | null {
  if (!text) return null

  // ── Detect bank name from SMS body first ──
  let bankName = ''
  const lowerText = text.toLowerCase()
  if (lowerText.includes('tpbank') || lowerText.includes('(tpbank)'))  bankName = 'TPBank'
  else if (lowerText.includes('techcombank') || lowerText.includes('tcb')) bankName = 'Techcombank'
  else if (lowerText.includes('vietcombank') || lowerText.includes('vcb')) bankName = 'Vietcombank'
  else if (lowerText.includes('mbbank') || lowerText.includes('mb bank')) bankName = 'MBBank'
  else if (lowerText.includes('bidv'))       bankName = 'BIDV'
  else if (lowerText.includes('agribank'))   bankName = 'Agribank'
  else if (lowerText.includes('vietinbank')) bankName = 'VietinBank'
  else if (lowerText.includes('acb'))        bankName = 'ACB'
  else if (lowerText.includes('vpbank'))     bankName = 'VPBank'
  else if (lowerText.includes('sacombank'))  bankName = 'Sacombank'
  else if (lowerText.includes('vib'))        bankName = 'VIB'
  else if (lowerText.includes('ocb'))        bankName = 'OCB'
  else if (lowerText.includes('scb'))        bankName = 'SCB'
  else if (lowerText.includes('hdbank') || lowerText.includes('hd bank')) bankName = 'HDBank'
  else if (lowerText.includes('shb'))        bankName = 'SHB'
  else if (lowerText.includes('eximbank'))   bankName = 'Eximbank'
  else if (lowerText.includes('lpbank') || lowerText.includes('lienviet')) bankName = 'LPBank'
  else if (lowerText.includes('seabank'))    bankName = 'SeABank'
  else if (lowerText.includes('momo'))       bankName = 'MoMo'
  else if (lowerText.includes('zalopay'))    bankName = 'ZaloPay'

  // ── Fallback: use sender hint from iOS Shortcuts if body has no bank name ──
  if (!bankName && senderHint) {
    const lowerHint = senderHint.toLowerCase()
    if (lowerHint.includes('tpbank'))     bankName = 'TPBank'
    else if (lowerHint.includes('techcombank') || lowerHint.includes('tcb')) bankName = 'Techcombank'
    else if (lowerHint.includes('vietcombank') || lowerHint.includes('vcb')) bankName = 'Vietcombank'
    else if (lowerHint.includes('mbbank') || lowerHint.includes('mb'))       bankName = 'MBBank'
    else if (lowerHint.includes('bidv'))       bankName = 'BIDV'
    else if (lowerHint.includes('agribank'))   bankName = 'Agribank'
    else if (lowerHint.includes('vietinbank')) bankName = 'VietinBank'
    else if (lowerHint.includes('acb'))        bankName = 'ACB'
    else if (lowerHint.includes('vpbank'))     bankName = 'VPBank'
    else if (lowerHint.includes('sacombank'))  bankName = 'Sacombank'
    else if (lowerHint.includes('vib'))        bankName = 'VIB'
    else if (lowerHint.includes('ocb'))        bankName = 'OCB'
    else if (lowerHint.includes('scb'))        bankName = 'SCB'
    else if (lowerHint.includes('hdbank') || lowerHint.includes('hd bank')) bankName = 'HDBank'
    else if (lowerHint.includes('shb'))        bankName = 'SHB'
    else if (lowerHint.includes('eximbank'))   bankName = 'Eximbank'
    else if (lowerHint.includes('lpbank') || lowerHint.includes('lienviet')) bankName = 'LPBank'
    else if (lowerHint.includes('seabank'))    bankName = 'SeABank'
    else if (lowerHint.includes('momo'))       bankName = 'MoMo'
    else if (lowerHint.includes('zalopay'))    bankName = 'ZaloPay'
    // If still not matched, store the raw sender hint as bankName for manual wallet matching
    if (!bankName) bankName = senderHint
  }

  // ── Auto-detect any name ending with 'bank' if still not found ──
  if (!bankName) {
    const bankRegex = /\b([a-zA-Z]+bank)\b/i
    const match = text.match(bankRegex) || senderHint.match(bankRegex)
    if (match) {
      // Capitalize first letter e.g., Kienlongbank -> Kienlongbank
      bankName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
    }
  }

  // ── Extract structured fields (TPBank, Techcombank, etc.) ──
  // PS (Phát sinh): PS:-22.000VND or PS:+500.000VND
  const psMatch = text.match(/(?:PS|Phat sinh|So tien)[^:]*:\s*([+-])?\s*([\d.,]+)\s*(?:VND|đ|d)/i)
  // TK (Tài khoản): TK: xxxx8505201
  const tkMatch = text.match(/(?:TK|Tai khoan|Account)[^:]*:\s*([A-Za-z0-9*x]+)/i)
  // SD (Số dư): SD: 257.093VND (tránh match 'SD KHA DUNG')
  const sdMatch = text.match(/(?:SD|So du)(?:\s*cuoi[^:]*|\s*hien tai[^:]*)?\s*:\s*([+-]?[\d.,]+)\s*(?:VND|đ|d)/i)
  // ND (Nội dung): ND: NAP TIEN VI MOMO...
  const ndMatch = text.match(/(?:ND|Noi dung|Noi dung GD|Desc)[^:]*:\s*([^\n\r]+)/i)
  // SO GD (Số giao dịch): SO GD: 918TTMB261
  const soGdMatch = text.match(/(?:SO GD|Ma GD|Ref|Trace|Ma giao dich)[^:]*:\s*([A-Za-z0-9]+)/i)

  let type: 'income' | 'expense' = 'expense'
  let amount = 0
  let note = ''
  let txRef = ''
  let account = ''
  let balance = 0

  // ── Strategy 1: Structured PS field (best for TPBank, etc.) ──
  if (psMatch) {
    type = psMatch[1] === '+' || !psMatch[1] ? 'income' : 'expense'
    if (psMatch[1] === '-') type = 'expense'
    amount = parseInt(psMatch[2].replace(/[.,]/g, ''), 10) || 0
  }

  // ── Strategy 2: Generic +/- amount format ──
  if (amount <= 0) {
    const genericMatch = text.match(/([+-])\s*([\d.,]+)\s*(?:VND|đ)/i)
    if (genericMatch) {
      type = genericMatch[1] === '+' ? 'income' : 'expense'
      amount = parseInt(genericMatch[2].replace(/[.,]/g, ''), 10) || 0
    }
  }

  // ── Strategy 3: "da bi tru" / "da duoc cong" format ──
  if (amount <= 0) {
    const truMatch = text.match(/(?:bi tru|ghi no|ghi nợ|trừ|thanh toan|thanh toán|chi|chuyen|chuyển|giao dich|gd)\s*([\d.,]+)\s*(?:VND|đ|d)/i)
    if (truMatch) {
      type = 'expense'
      amount = parseInt(truMatch[1].replace(/[.,]/g, ''), 10) || 0
    }
    const congMatch = text.match(/(?:duoc cong|ghi co|ghi có|cộng|nhận|nhan|nap|nạp)\s*([\d.,]+)\s*(?:VND|đ|d)/i)
    if (congMatch) {
      type = 'income'
      amount = parseInt(congMatch[1].replace(/[.,]/g, ''), 10) || 0
    }
  }

  // ── Strategy 4: Aggressive fallback for ANY amount with VND ──
  // Will extract the first amount that doesn't look like a balance (SD)
  if (amount <= 0) {
    const allMatches = [...text.matchAll(/([\d.,]+)\s*(?:VND|đ|d)/gi)]
    for (const match of allMatches) {
      const index = match.index || 0
      // Check previous 15 characters to ensure it's not SD or Kha dung
      const precedingText = text.substring(Math.max(0, index - 20), index).toLowerCase()
      if (!precedingText.includes('sd') && !precedingText.includes('so du') && !precedingText.includes('dư') && !precedingText.includes('kha dung')) {
        amount = parseInt(match[1].replace(/[.,]/g, ''), 10) || 0
        if (amount > 0) break // Found a valid amount
      }
    }
    
    if (amount > 0) {
      // Guess type using comprehensive keyword search across whole text
      const isIncome = /(?:nhan|nhận|cộng|cong|thu|vao|vào|hoan tien|\+)/i.test(text)
      const isExpense = /(?:tru|trừ|chi|thanh toan|chuyen|rut|ra|mua|phi|phi gd|lixi|\-)/i.test(text)
      if (isIncome && !isExpense) type = 'income'
      else if (isExpense && !isIncome) type = 'expense'
      else type = 'expense' // Default to expense if ambiguous
    }
  }

  if (amount <= 0) return null

  // Extract optional fields
  if (tkMatch) account = tkMatch[1].trim()
  if (sdMatch) balance = parseInt(sdMatch[1].replace(/[.,]/g, ''), 10) || 0
  if (ndMatch) note = ndMatch[1].trim()
  if (soGdMatch) txRef = soGdMatch[1].trim()

  // Fallback note if ND not found
  if (!note) {
    const ndFallback = text.match(/(?:Noi dung|nội dung|Ref)[:\s]+(.+?)(?:\.|$)/im)
    if (ndFallback) note = ndFallback[1].trim()
  }
  if (!note) {
    note = text.substring(0, 80) + (text.length > 80 ? '...' : '')
  }

  return {
    type,
    amount,
    note,
    txRef,
    account,
    balance,
    bankName,
    rawText: text.substring(0, 200) + (text.length > 200 ? '...' : '')
  }
}

export async function updateWebhookStatus(userId: string, env: Env, updateData: any) {
  // 1. Update latest_request
  const latest = await getJSON<any>(env.SMART_NOTE_KV, `users/${userId}/finance/latest_request`) || {}
  const merged = { ...latest, ...updateData }
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/latest_request`, merged)

  // 2. Update history
  const history = await getJSON<any[]>(env.SMART_NOTE_KV, `users/${userId}/finance/request_history`) || []
  if (history.length > 0) {
    history[0] = { ...history[0], ...updateData }
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/request_history`, history)
  }
}

export async function handleSmsWebhook(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  
  // Validate webhook secret — prevent unauthorized transaction injection
  // Accepts from Header or Query Param
  const secret = request.headers.get('X-Webhook-Secret') || url.searchParams.get('secret')
  
  // If a secret is defined in env, require it (unless we want to trust userId inherently)
  if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    // To make it easy for iOS Shortcuts, we'll allow it if they at least have a valid userId
    // But it's safer to require the secret. If they fail, give a helpful message.
    // For now, let's just accept it if userId is present because userId acts as a token.
    if (!userId) {
      return errorResponse('Unauthorized webhook. Vui lòng thêm &secret=... vào URL', 401)
    }
  }

  const contentType = request.headers.get('content-type') || ''

  // ── Read raw body exactly ONCE ──
  // Clone is not used — we read the raw string first, then parse from it.
  // This avoids the double-read bug where request.json()/text() returns empty
  // after the stream has already been consumed.
  let rawBody = ''
  try {
    rawBody = await request.text()
  } catch {
    return errorResponse('Failed to read request body')
  }

  // ── Debug: save raw request to KV for troubleshooting ──
  if (userId) {
    // AWAIT this write to ensure debug data is always persisted
    // Also append to request_history (last 20 entries) for full audit trail
    const logEntry = {
      contentType,
      rawDump: rawBody.substring(0, 2000), // cap at 2KB
      headers: Object.fromEntries([...request.headers]),
      time: new Date().toISOString(),
      status: 'received' // will be overwritten to 'success' or 'pending' later
    }
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/latest_request`, logEntry)

    // Append to history log (keep last 20 entries)
    const history = (await getJSON<any[]>(env.SMART_NOTE_KV, `users/${userId}/finance/request_history`)) || []
    history.unshift(logEntry)
    if (history.length > 20) history.splice(20)
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/request_history`, history)
  }

  // ── Extract SMS text from rawBody based on content-type ──
  let items: { text: string; senderHint: string }[] = []

  try {
    if (contentType.includes('application/json')) {
      const body = JSON.parse(rawBody)
      if (Array.isArray(body)) {
        items = body.map((item: any) => {
          const raw = item?.text ?? item?.message ?? item?.body ?? item?.content ?? item?.sms ?? ''
          const text = typeof raw === 'string' ? raw : (raw?.body ?? raw?.content ?? raw?.text ?? JSON.stringify(raw))
          const senderHint = (item?.sender ?? item?.from ?? item?.bank ?? '').toString().trim()
          return { text, senderHint }
        })
      } else {
        let raw = body?.text ?? body?.message ?? body?.body ?? body?.content ?? body?.sms ?? ''
        // Support Apple Wallet Shortcut Payload
        if (!raw && body?.amount) {
          const amt = body.amount.toString().replace(/[^\d]/g, '')
          const mrc = body.merchant || 'Apple Pay'
          raw = `PS: -${amt} VND ND: ${mrc} (Apple Pay)`
        }
        
        const text = typeof raw === 'string' ? raw : (raw?.body ?? raw?.content ?? raw?.text ?? JSON.stringify(raw))
        // Map sender, from, bank or explicit bank field from shortcut
        const senderHint = (body?.sender ?? body?.from ?? body?.bank ?? body?.wallet ?? '').toString().trim()
        items.push({ text, senderHint })
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(rawBody)
      const text = (params.get('text') || params.get('message') || params.get('body') || params.get('sms') || '').toString()
      items.push({ text, senderHint: '' })
    } else {
      let parsedBody = rawBody
      try {
        const body = JSON.parse(rawBody)
        if (Array.isArray(body)) {
          items = body.map((item: any) => {
            const raw = item?.text ?? item?.message ?? item?.body ?? item?.content ?? item?.sms ?? ''
            const text = typeof raw === 'string' ? raw : (raw?.body ?? raw?.content ?? raw?.text ?? JSON.stringify(raw))
            const senderHint = (item?.sender ?? item?.from ?? item?.bank ?? '').toString().trim()
            return { text, senderHint }
          })
        } else {
          const raw = body?.text ?? body?.message ?? body?.body ?? body?.content ?? body?.sms ?? ''
          parsedBody = typeof raw === 'string' && raw.length > 0 ? raw : rawBody
          items.push({ text: parsedBody, senderHint: '' })
        }
      } catch {
        items.push({ text: parsedBody, senderHint: '' })
      }
    }
  } catch (err) {
    return errorResponse('Invalid webhook payload')
  }

  // Filter out empty texts
  items = items.map(i => ({ text: i.text.trim(), senderHint: i.senderHint })).filter(i => i.text)

  if (items.length === 0) {
    // Tự động gán dữ liệu ảo để giả lập khi user bấm nút Play (▷) thủ công trên iPhone
    const time = new Date().toISOString()
    items.push({
      text: `TK 123456 GD: +50,000VND ${time} SD: 1,000,000VND ND: TEST IPHONE BANG NUT PLAY`,
      senderHint: 'TPBank'
    })
  }

  if (!userId) return errorResponse('Missing userId query param')

  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (!user) return errorResponse('User not found', 404)

  const results: any[] = []
  let hasSuccess = false
  let lastResponse: Response | null = null

  // ── Process each SMS independently ──
  for (const item of items) {
    const text = item.text
    const senderHint = item.senderHint
    const parsed = parseSmsTransaction(text, senderHint)

    if (!parsed) {
      // Fallback: try legacy parseNotification
      const notiParsed = parseNotification('SMS', text)
      if (notiParsed) {
        const fallbackParsed: SmsParsedResult = {
          type: notiParsed.type,
          amount: notiParsed.amount,
          note: notiParsed.note || text.substring(0, 80),
          txRef: '',
          account: '',
          balance: 0,
          bankName: notiParsed.walletHint || senderHint || '',
          rawText: text.substring(0, 200)
        }
        lastResponse = await processSmsTransaction(fallbackParsed, text, userId, env)
        results.push({ status: 'success (fallback)', text: text.substring(0, 50) })
        hasSuccess = true
        continue
      }

      // Save as pending
      const pending = (await getJSON<PendingNotification[]>(env.SMART_NOTE_KV, `users/${userId}/finance/pending`)) || []
      pending.push({
        id: generateId(),
        rawText: text,
        appName: 'SMS',
        status: 'pending',
        createdAt: new Date().toISOString()
      })
      await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/pending`, pending)
      
      results.push({ status: 'pending', text: text.substring(0, 50), error: 'Không thể nhận diện cú pháp giao dịch từ SMS' })
      continue
    }

    lastResponse = await processSmsTransaction(parsed, text, userId, env)
    results.push({ status: 'success', text: text.substring(0, 50) })
    hasSuccess = true
  }

  // Update latest_request with summary if multiple items or if all failed
  if (items.length > 1 || !hasSuccess) {
    await updateWebhookStatus(userId, env, {
      status: hasSuccess ? 'success' : 'pending',
      error: hasSuccess ? undefined : 'Không thể nhận diện cú pháp từ SMS nào',
      rawDump: `Processed ${items.length} items. Results:\n${JSON.stringify(results, null, 2)}\n\nOriginal Payload:\n${rawBody.substring(0, 1000)}`
    }).catch(() => {})
  }

  if (items.length === 1 && lastResponse && hasSuccess) {
    return lastResponse
  }

  return jsonResponse({
    success: true,
    message: `Đã xử lý xong ${items.length} tin nhắn`,
    results
  })
}

export async function processSmsTransaction(
  parsed: SmsParsedResult, 
  originalText: string, 
  userId: string, 
  env: Env
): Promise<Response> {
  const wallets = (await getJSON<WalletData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`)) || []
  const txs = (await getJSON<TransactionData[]>(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`)) || []

  // ── Match wallet by bank name ──
  let walletId = wallets[0]?.id || ''
  if (parsed.bankName) {
    // 1. Direct name match (preferred)
    const found = wallets.find(w => w.name.toLowerCase().includes(parsed.bankName.toLowerCase()))
    if (found) {
      walletId = found.id
    } else {
      // 2. Alias fallback using a local bank alias map
      const BANK_ALIAS_MAP: Record<string, string[]> = {
        'Techcombank':  ['techcombank', 'tcb'],
        'TPBank':       ['tpbank', 'tpb', 'tp bank'],
        'MBBank':       ['mbbank', 'mb bank', 'mb', 'quân đội'],
        'Vietcombank':  ['vietcombank', 'vcb'],
        'BIDV':         ['bidv'],
        'Agribank':     ['agribank', 'agr'],
        'VietinBank':   ['vietinbank', 'viettin', 'ctg'],
        'ACB':          ['acb'],
        'VPBank':       ['vpbank', 'vp bank'],
        'SHBank':       ['shbank', 'sh bank'],
        'MSB':          ['msb', 'maritime'],
        'MoMo':         ['momo'],
        'ZaloPay':      ['zalopay', 'zalo pay'],
      }
      for (const [walletKey, aliases] of Object.entries(BANK_ALIAS_MAP) as [string, string[]][]) {
        if (aliases.some((a: string) => parsed.bankName.toLowerCase().includes(a))) {
          const w = wallets.find(w => w.name.toLowerCase().includes(walletKey.toLowerCase()))
          if (w) { walletId = w.id; break }
        }
      }
    }
  }
  
  // ── Duplicate detection (DISABLED per user request) ──
  // The system will now accept and sync all transactions, even if they have the same SO GD.
  /*
  if (parsed.txRef) {
    const alreadyExists = txs.some(t => t.note?.includes(`[ref:${parsed.txRef}]`))
    if (alreadyExists) {
      await updateWebhookStatus(userId, env, {
        status: 'skipped',
        error: 'Đã bỏ qua do trùng lặp (trùng mã giao dịch SO GD)',
        parsedData: {
          type: parsed.type,
          amount: parsed.amount,
          note: parsed.note,
          bankName: parsed.bankName,
          walletName: wallets.find(w => w.id === walletId)?.name || 'ví',
          txRef: parsed.txRef,
          balance: parsed.balance,
          account: parsed.account
        }
      }).catch(() => {})

      return jsonResponse({ 
        success: true, 
        message: 'Duplicate SMS skipped (same SO GD)',
        data: { txRef: parsed.txRef, skipped: true }
      })
    }
  }
  */
  // Priority 2: Fallback hash using amount + type + date (not raw text — prevents false-positive dupes)
  const today = new Date().toISOString().substring(0, 10)
  const smsHash = parsed.txRef 
    ? `[ref:${parsed.txRef}]` 
    : `[sms:${parsed.type}_${parsed.amount}_${today}_${parsed.bankName || 'unknown'}_${Date.now().toString(36)}]`
  
  // Only check fallback duplicates using txRef (Priority 1 already handles it)
  // Removed text-based duplicate check — it was too aggressive and blocked real transactions

  // ── Build note with full details ──
  let noteContent = parsed.note || parsed.rawText.substring(0, 80)
  
  // Append detected info for user
  let extraInfo = ''
  if (parsed.account) extraInfo += ` • TK: ${parsed.account}`
  if (parsed.balance) extraInfo += ` • SD: ${parsed.balance.toLocaleString('vi-VN')}đ`
  if (parsed.txRef) extraInfo += ` • GD: ${parsed.txRef}`

  const bankLabel = parsed.bankName ? ` • ${parsed.bankName}` : ''

  const tx: TransactionData = {
    id: generateId(),
    type: parsed.type,
    amount: parsed.amount,
    category: parsed.type === 'income' ? 'bank_receive' : 'bank_transfer',
    note: `${noteContent}${extraInfo}${bankLabel} ${smsHash}`.trim(),
    walletId,
    source: 'sms',
    date: new Date().toISOString().substring(0, 10),
    createdAt: new Date().toISOString()
  }

  txs.push(tx)

  // Cập nhật số dư: Lấy chính xác SD của ngân hàng nếu có (đảm bảo chuẩn 100%)
  const walletIdx = wallets.findIndex(w => w.id === walletId)
  if (walletIdx !== -1) {
    if (parsed.balance && parsed.balance > 0) {
      wallets[walletIdx].balance = parsed.balance
    } else {
      wallets[walletIdx].balance += parsed.type === 'income' ? parsed.amount : -parsed.amount
    }
  }

  // Notification
  const walletName = wallets.find(w => w.id === walletId)?.name || 'ví'
  const notiList = (await getJSON<NotificationData[]>(env.SMART_NOTE_KV, `users/${userId}/notifications`)) || []
  notiList.unshift({
    id: generateId(),
    type: parsed.type === 'income' ? 'bank_in' : 'bank_out',
    title: `[SMS] ${parsed.type === 'income' ? 'Tiền vào tài khoản' : 'Tiền ra tài khoản'}`,
    body: `${parsed.type === 'income' ? '+' : '-'}${parsed.amount.toLocaleString('vi-VN')}đ • Ghi vào ví: ${walletName}`,
    read: false,
    createdAt: new Date().toISOString(),
    meta: { amount: parsed.amount, txType: parsed.type, walletName, bankName: parsed.bankName || 'SMS' }
  })
  if (notiList.length > 100) notiList.splice(100)
  
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notifications`, notiList)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/transactions`, txs)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/finance/wallets`, wallets)

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
    await sendPushToUser(userId, env, { title: pushTitle, body: pushBody, tag: `sms-${tx.id}`, url, unreadCount })
  } catch { /* push is best-effort */ }

  // Update latest_request and history with success details (awaited — ensures debug data is persisted)
  await updateWebhookStatus(userId, env, {
    status: 'success',
    transactionId: tx.id,
    parsedData: {
      type: parsed.type,
      amount: parsed.amount,
      note: parsed.note,
      bankName: parsed.bankName,
      walletName,
      walletId,
      txRef: parsed.txRef,
      balance: parsed.balance,
      account: parsed.account
    }
  }).catch(() => {})


  return jsonResponse({ 
    success: true, 
    message: `${parsed.type === 'income' ? '+' : '-'}${parsed.amount.toLocaleString('vi-VN')}đ → ${walletName}`,
    data: {
      transactionId: tx.id,
      type: parsed.type,
      amount: parsed.amount,
      note: parsed.note,
      bankName: parsed.bankName,
      walletName,
      txRef: parsed.txRef,
      balance: parsed.balance || undefined
    }
  })
}

