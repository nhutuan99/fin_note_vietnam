/**
 * FinNote OTP Auto-Forward — Google Apps Script
 * 
 * Cách sử dụng:
 * 1. Vào https://script.google.com → New project
 * 2. Dán toàn bộ code này vào
 * 3. Thay WEBHOOK_URL và WEBHOOK_SECRET bên dưới
 * 4. Chạy hàm setup() 1 lần (cho phép quyền Gmail)
 * 5. Script sẽ tự chạy mỗi 1 phút, kiểm tra email OTP mới
 * 
 * Để dừng: Vào Triggers → xóa trigger
 */

// ════════════════════════════════════════════════════════════════
// CẤU HÌNH — THAY ĐỔI CÁC GIÁ TRỊ NÀY
// ════════════════════════════════════════════════════════════════

const WEBHOOK_URL = 'https://smart-note-api.smart-note.workers.dev/api/webhook/email-otp'
const WEBHOOK_SECRET = 'YOUR_TELEGRAM_WEBHOOK_SECRET_HERE' // Cùng secret với TELEGRAM_WEBHOOK_SECRET

// Danh sách email gửi OTP cần theo dõi
const OTP_SENDERS = [
  'info@account.netflix.com',
  'noreply@youtube.com',
  'no-reply@accounts.google.com',
  'noreply@email.spotify.com',
  'noreply@discord.com',
  'noreply@github.com',
  'security@facebookmail.com',
  'noreply@steampowered.com',
  'account-security-noreply@accountprotection.microsoft.com',
  // Thêm email khác tại đây...
]

// Thời gian tối đa để check email (phút) — chỉ check email trong X phút gần nhất
const CHECK_WINDOW_MINUTES = 3

// ════════════════════════════════════════════════════════════════
// SETUP — CHẠY HÀM NÀY 1 LẦN
// ════════════════════════════════════════════════════════════════

/**
 * Chạy hàm này 1 lần để:
 * 1. Cấp quyền Gmail cho script
 * 2. Tạo trigger tự chạy mỗi 1 phút
 */
function setup() {
  // Xóa tất cả trigger cũ
  const triggers = ScriptApp.getProjectTriggers()
  triggers.forEach(t => ScriptApp.deleteTrigger(t))

  // Tạo trigger mới — chạy mỗi 1 phút
  ScriptApp.newTrigger('checkForOtpEmails')
    .timeBased()
    .everyMinutes(1)
    .create()

  Logger.log('✅ Setup complete! Trigger created to run every 1 minute.')
  Logger.log('📧 Monitoring senders: ' + OTP_SENDERS.join(', '))

  // Test run
  checkForOtpEmails()
}

// ════════════════════════════════════════════════════════════════
// MAIN — KIỂM TRA EMAIL OTP MỚI
// ════════════════════════════════════════════════════════════════

/**
 * Hàm chính — được gọi mỗi 1 phút bởi trigger.
 * Check inbox cho email OTP mới từ các sender đã cấu hình.
 */
function checkForOtpEmails() {
  const processedKey = 'PROCESSED_IDS'
  const props = PropertiesService.getScriptProperties()

  // Load danh sách email đã xử lý
  let processedIds = []
  try {
    const raw = props.getProperty(processedKey)
    processedIds = raw ? JSON.parse(raw) : []
  } catch (e) {
    processedIds = []
  }

  // Build Gmail search query
  const senderQuery = OTP_SENDERS.map(s => `from:${s}`).join(' OR ')
  const query = `(${senderQuery}) newer_than:${CHECK_WINDOW_MINUTES}m`

  let threads
  try {
    threads = GmailApp.search(query, 0, 5) // Max 5 threads
  } catch (e) {
    Logger.log('❌ Gmail search error: ' + e.message)
    return
  }

  if (threads.length === 0) {
    return // Không có email mới
  }

  let newProcessedIds = [...processedIds]

  for (const thread of threads) {
    const messages = thread.getMessages()

    for (const message of messages) {
      const messageId = message.getId()

      // Skip nếu đã xử lý
      if (processedIds.includes(messageId)) continue

      const from = message.getFrom()
      const subject = message.getSubject()
      const body = message.getPlainBody() || message.getBody()
      const date = message.getDate()

      // Chỉ xử lý email trong khoảng thời gian check
      const ageMinutes = (Date.now() - date.getTime()) / 60000
      if (ageMinutes > CHECK_WINDOW_MINUTES + 1) continue

      Logger.log(`📨 Found OTP email: "${subject}" from ${from}`)

      // Gửi tới webhook
      try {
        const response = UrlFetchApp.fetch(WEBHOOK_URL, {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'X-Webhook-Secret': WEBHOOK_SECRET
          },
          payload: JSON.stringify({
            from: from,
            subject: subject,
            body: body.substring(0, 2000), // Truncate body
            timestamp: date.toISOString()
          }),
          muteHttpExceptions: true
        })

        const status = response.getResponseCode()
        const result = JSON.parse(response.getContentText())

        if (status === 200 && result.success) {
          Logger.log(`✅ OTP forwarded: ${result.data?.code || 'N/A'} (${result.data?.service || 'unknown'})`)
        } else {
          Logger.log(`⚠️ Webhook response: ${status} — ${result.error || result.message || 'Unknown'}`)
        }
      } catch (e) {
        Logger.log(`❌ Webhook error: ${e.message}`)
      }

      // Đánh dấu đã xử lý
      newProcessedIds.push(messageId)
    }
  }

  // Giữ tối đa 100 ID gần nhất để tránh overflow
  if (newProcessedIds.length > 100) {
    newProcessedIds = newProcessedIds.slice(-100)
  }

  props.setProperty(processedKey, JSON.stringify(newProcessedIds))
}

/**
 * Hàm test — chạy thủ công để kiểm tra webhook hoạt động.
 */
function testWebhook() {
  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Webhook-Secret': WEBHOOK_SECRET
    },
    payload: JSON.stringify({
      from: 'info@account.netflix.com',
      subject: 'Netflix: Mã đăng nhập của bạn',
      body: 'Nhập mã này để đăng nhập\n\n3978\n\nMã sẽ hết hạn sau 15 phút.',
      timestamp: new Date().toISOString()
    }),
    muteHttpExceptions: true
  })

  Logger.log('Test result: ' + response.getContentText())
}

/**
 * Xóa trigger và dọn dẹp.
 */
function cleanup() {
  const triggers = ScriptApp.getProjectTriggers()
  triggers.forEach(t => ScriptApp.deleteTrigger(t))
  PropertiesService.getScriptProperties().deleteAllProperties()
  Logger.log('🧹 Cleanup done — all triggers removed.')
}
