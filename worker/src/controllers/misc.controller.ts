import { Env, UserData, ContactFeedback } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'
import { RESEND_API_URL } from '../constants/api'

// ====== Live Debug / Logs ======

export async function handleGetLatestSmsLog(userId: string, env: Env): Promise<Response> {
  const latest = await getJSON(env.SMART_NOTE_KV, `users/${userId}/finance/latest_request`)
  return jsonResponse({ success: true, data: latest || null })
}

export async function handleGetWebhookHistory(userId: string, env: Env): Promise<Response> {
  const history = (await getJSON<any[]>(env.SMART_NOTE_KV, `users/${userId}/finance/request_history`)) || []
  return jsonResponse({ success: true, data: history })
}

// ====== Bug Report ======

interface BugReport {
  id: string
  userId: string
  userName: string
  userEmail: string
  type: 'bug' | 'feature'
  title: string
  description: string
  url: string
  userAgent: string
  image?: string       // data:image/...;base64,... (optional screenshot)
  status: 'new' | 'read' | 'resolved'
  createdAt: string
}

export async function handleReportBug(userId: string, request: Request, env: Env): Promise<Response> {
  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (!user) return errorResponse('User not found', 404)

  const body = (await request.json()) as any
  const { type, title, description, url, userAgent, image } = body

  if (!title || !description) {
    return errorResponse('Vui lòng nhập đầy đủ tiêu đề và mô tả')
  }

  const report: BugReport = {
    id: generateId(),
    userId,
    userName: user.name,
    userEmail: user.email,
    type: type === 'feature' ? 'feature' : 'bug',
    title,
    description,
    url: url || '',
    userAgent: userAgent || '',
    status: 'new',
    createdAt: new Date().toISOString()
  }

  // Store image separately if provided (to keep the list payload small)
  if (image && typeof image === 'string' && image.startsWith('data:image/')) {
    await env.SMART_NOTE_KV.put(`bug_reports/${report.id}/image`, image)
    report.image = `__has_image__`
  }

  // Append to global bug reports list
  const reports = (await getJSON<BugReport[]>(env.SMART_NOTE_KV, 'bug_reports/list')) || []
  reports.unshift(report)
  if (reports.length > 100) reports.length = 100
  await putJSON(env.SMART_NOTE_KV, 'bug_reports/list', reports)

  // Send email notification to Admin via Resend (server-side, fire-and-forget)
  if (env.RESEND_API_KEY) {
    try {
      const isFeature = report.type === 'feature'
      const typeLabel = isFeature ? '✨ Feature Request' : '🐛 Bug Report'
      const color = isFeature ? '#3b82f6' : '#ff6b6b'

      const emailHtml = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9">
  <div style="background:#ffffff;border-radius:12px;padding:32px;color:#333;box-shadow:0 4px 6px rgba(0,0,0,0.05)">
    <h2 style="color:${color};margin:0 0 20px;font-size:20px;display:flex;align-items:center;gap:8px">
      ${typeLabel}: ${title}
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
      <tr><td style="padding:8px 0;color:#666;width:100px;border-bottom:1px solid #eee">Người gửi</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:500">${user.name} (${user.email})</td></tr>
      <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">Thời gian</td><td style="padding:8px 0;border-bottom:1px solid #eee">${new Date(report.createdAt).toLocaleString('vi-VN')}</td></tr>
      ${url ? `<tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">URL</td><td style="padding:8px 0;border-bottom:1px solid #eee;word-break:break-all"><a href="${url}" style="color:#3b82f6">${url}</a></td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#666">Device</td><td style="padding:8px 0;font-size:12px;word-break:break-all;color:#555">${userAgent || 'N/A'}</td></tr>
    </table>
    <div style="margin-top:20px;padding:20px;background:#f8fafc;border-radius:8px;border-left:4px solid ${color}">
      <p style="margin:0 0 12px;color:${color};font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Mô tả chi tiết</p>
      <p style="margin:0;white-space:pre-wrap;line-height:1.6;color:#334155;font-size:15px">${description}</p>
    </div>
    ${report.image === '__has_image__' ? '<div style="margin-top:20px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;color:#d97706;font-size:13px;display:inline-block">📎 Có ảnh đính kèm — vui lòng xem trong Admin Dashboard</div>' : ''}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee;text-align:center">
      <p style="margin:0;color:#94a3b8;font-size:12px">FinNote Feedback System</p>
      <p style="margin:4px 0 0;color:#cbd5e1;font-size:11px;font-family:monospace">ID: ${report.id}</p>
    </div>
  </div>
</div>`

      await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'FinNote <onboarding@resend.dev>',
          to: ['tintphcm@gmail.com'],
          subject: `[${isFeature ? 'Feature' : 'Bug'}] ${title}`,
          html: emailHtml
        })
      })
    } catch { /* email is best-effort, don't block response */ }
  }

  return jsonResponse({ success: true, message: 'Đã gửi báo cáo lỗi thành công! Admin sẽ xem và xử lý.' })
}

// ====== Contact Feedback ======

export async function handleContactFeedback(userId: string, request: Request, env: Env): Promise<Response> {
  const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${userId}/profile`)
  if (!user) return errorResponse('User not found', 404)

  const body = (await request.json()) as any
  const { subject, message } = body

  if (!subject || !message) {
    return errorResponse('Vui lòng nhập đầy đủ tiêu đề và nội dung')
  }

  const feedback: ContactFeedback = {
    id: generateId(),
    userId,
    userName: user.name,
    userEmail: user.email,
    subject,
    message,
    createdAt: new Date().toISOString()
  }

  // Append to global feedback list
  const feedbacks = (await getJSON<ContactFeedback[]>(env.SMART_NOTE_KV, 'contact_feedbacks/list')) || []
  feedbacks.unshift(feedback)
  if (feedbacks.length > 100) feedbacks.length = 100
  await putJSON(env.SMART_NOTE_KV, 'contact_feedbacks/list', feedbacks)

  // Send email notification to Admin via Resend
  if (env.RESEND_API_KEY) {
    try {
      const emailHtml = `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9">
  <div style="background:#ffffff;border-radius:12px;padding:32px;color:#333;box-shadow:0 4px 6px rgba(0,0,0,0.05)">
    <h2 style="color:#7c6ff7;margin:0 0 20px;font-size:20px;display:flex;align-items:center;gap:8px">
      💬 Ý kiến người dùng: ${subject}
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
      <tr><td style="padding:8px 0;color:#666;width:100px;border-bottom:1px solid #eee">Người gửi</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:500">${user.name} (${user.email})</td></tr>
      <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee">Thời gian</td><td style="padding:8px 0;border-bottom:1px solid #eee">${new Date(feedback.createdAt).toLocaleString('vi-VN')}</td></tr>
    </table>
    <div style="margin-top:20px;padding:20px;background:#f8fafc;border-radius:8px;border-left:4px solid #7c6ff7">
      <p style="margin:0 0 12px;color:#7c6ff7;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Nội dung</p>
      <p style="margin:0;white-space:pre-wrap;line-height:1.6;color:#334155;font-size:15px">${message}</p>
    </div>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee;text-align:center">
      <p style="margin:0;color:#94a3b8;font-size:12px">FinNote Contact Feedback</p>
      <p style="margin:4px 0 0;color:#cbd5e1;font-size:11px;font-family:monospace">ID: ${feedback.id}</p>
    </div>
  </div>
</div>`

      await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'FinNote <onboarding@resend.dev>',
          to: ['tintphcm@gmail.com'],
          subject: `[Feedback] ${subject}`,
          html: emailHtml
        })
      })
    } catch { /* email is best-effort */ }
  }

  return jsonResponse({ success: true, message: 'Cảm ơn bạn đã gửi ý kiến! Admin sẽ xem và phản hồi sớm nhất.' })
}
