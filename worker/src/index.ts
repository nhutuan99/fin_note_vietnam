import { Env } from './types'
import { corsHeaders, errorResponse } from './utils/response'
import { verifyJWT } from './utils/jwt'

import {
  handleRegister,
  handleLogin,
  handleGoogleOAuthUrl,
  handleGoogleVerify,
  handleResetPassword,
  handleGoogleSignIn,
  handleUpdateProfile,
  handleDeleteAccount,
  handleForgotPin,
  handleResetPin,
  handleRefreshToken,
} from './controllers/auth.controller'

import {
  handleTelegramWebhook,
  handleNotificationWebhook,
  handleTradingSignalWebhook,
} from './controllers/webhook.controller'

import {
  handleSmsWebhook,
  handleListNotifications,
  handleMarkAllNotificationsRead,
  handleClearNotifications,
  handleMarkNotificationRead,
} from './controllers/notification.controller'

import {
  handleListNotes,
  handleCreateNote,
  handleGetNote,
  handleUpdateNote,
  handleDeleteNote,
  handleUpdateNoteShare,
  handleGetSharedNote,
} from './controllers/note.controller'

import {
  handleListWallets,
  handleCreateWallet,
  handleUpdateWallet,
  handleDeleteWallet,
  handleListTransactions,
  handleCreateTransaction,
  handleDeleteTransaction,
  handleGetFinanceStats,
  handleGetBudget,
  handleUpdateBudget,
  handleGetTradingConfig,
  handleUpdateTradingConfig,
  handleListTradingCheckins,
  handleCreateTradingCheckin,
  handleUpdateTradingCheckin,
  handleListPendingTransfers,
  handleResolvePendingTransfer,
} from './controllers/finance.controller'

import {
  handleListSavings,
  handleCreateSaving,
  handleUpdateSaving,
  handleDeleteSaving,
  handleDepositSaving,
  handleWithdrawSaving
} from './controllers/savings.controller'

import {
  handleCheckPin,
  handleSetPin,
  handleVerifyPin,
  handleListPending,
  handleResolvePending,
} from './controllers/pin.controller'

import {
  handlePushSubscribe,
  handlePushUnsubscribe,
  handlePushTest,
} from './controllers/push.controller'

import {
  handleAiStream,
  handleAi,
  handleAiImage
} from './controllers/ai.controller'

import {
  handleReportBug,
  handleContactFeedback,
  handleGetLatestSmsLog,
  handleGetWebhookHistory,
} from './controllers/misc.controller'

import {
  handleListBlogs,
  handleGetBlog,
  handleBlogView,
  handleCreateBlog,
  handleUpdateBlog,
  handleDeleteBlog,
  handleGenerateBlogContent,
  handleRefineBlogContent,
  handleGenerateBlogImage,
  handleGetImage,
  handleUploadImage,
} from './controllers/blog.controller'

import { handleProxyLocation, handleProxyWeather, handleProxyExchangeRate, handleProxyStockPrice, handleProxyStockHistory, handleProxyLogo, handleProxyFundNav, handleProxyFundHistory, handleProxyFundList } from './controllers/proxy.controller'

import {
  handleListStocks,
  handleCreateStock,
  handleUpdateStock,
  handleDeleteStock,
  handleAddStockAlert,
  handleDeleteStockAlert,
  handleResetStockAlert
} from './controllers/stock.controller'

import {
  handleListFunds,
  handleCreateFund,
  handleUpdateFund,
  handleDeleteFund,
} from './controllers/fund.controller'

import {
  handleListReminders,
  handleCreateReminder,
  handleUpdateReminder,
  handleDeleteReminder,
  handleClearReminders,
  handleCompleteReminder,
  handleAcknowledgeReminder,
  handleAiDetectReminders,
} from './controllers/reminder.controller'

import {
  handleListTodos,
  handleCreateTodo,
  handleUpdateTodo,
  handleDeleteTodo,
  handleClearTodos,
  handleAiGenerateTodos,
} from './controllers/todo.controller'

import {
  handleListOtpCodes,
  handleCreateOtpCode,
  handleDeleteOtpCode,
  handleGetOtpSettings,
  handleUpdateOtpSettings,
  handleGetOtpSubscriberCount,
  handleOtpSubscribe,
  handleOtpUnsubscribe,
  handleEmailOtpWebhook,
} from './controllers/otp-hub.controller'

import { checkAllStockAlerts } from './services/stock-alert.service'
import { checkAllReminders } from './services/reminder.service'
import { checkTradingReminders } from './services/trading-reminder.service'
import { checkSavingsReminders } from './services/savings-reminder.service'


async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  try {
    // ── Public Proxy Routes ──
    if (path === '/api/proxy/location' && request.method === 'GET') {
      return handleProxyLocation(request)
    }
    if (path === '/api/proxy/weather' && request.method === 'GET') {
      return handleProxyWeather(request)
    }
    if (path === '/api/proxy/exchange-rate' && request.method === 'GET') {
      return handleProxyExchangeRate(request)
    }
    if (path === '/api/proxy/stock-price' && request.method === 'GET') {
      return handleProxyStockPrice(request, env)
    }

    if (path === '/api/proxy/stock-history' && request.method === 'GET') {
      return handleProxyStockHistory(request, env)
    }

    if (path === '/api/proxy/logo' && request.method === 'GET') {
      return handleProxyLogo(request)
    }

    // Fmarket Fund Proxy (public, no auth)
    if (path === '/api/proxy/fund-nav' && request.method === 'GET') {
      return handleProxyFundNav(request, env)
    }
    if (path === '/api/proxy/fund-history' && request.method === 'GET') {
      return handleProxyFundHistory(request, env)
    }
    if (path === '/api/proxy/fund-list' && request.method === 'GET') {
      return handleProxyFundList(request, env)
    }

      if (path === '/api/auth/register' && request.method === 'POST') {
        return handleRegister(request, env)
      }
      if (path === '/api/auth/login' && request.method === 'POST') {
        return handleLogin(request, env)
      }
      if (path === '/api/auth/google-oauth-url' && request.method === 'POST') {
        return handleGoogleOAuthUrl(request, env)
      }
      if (path === '/api/auth/google-verify' && request.method === 'POST') {
        return handleGoogleVerify(request, env)
      }
      if (path === '/api/auth/reset-password' && request.method === 'POST') {
        return handleResetPassword(request, env)
      }
      if (path === '/api/auth/google-signin' && request.method === 'POST') {
        return handleGoogleSignIn(request, env)
      }
      if (path === '/api/auth/refresh' && request.method === 'POST') {
        return handleRefreshToken(request, env)
      }

      // Webhooks
      if (path === '/api/webhook/telegram' && request.method === 'POST') {
        return handleTelegramWebhook(request, env)
      }
      if (path === '/api/webhook/trading-signal' && request.method === 'POST') {
        return handleTradingSignalWebhook(request, env)
      }
      if (path === '/api/webhook/notification' && request.method === 'POST') {
        return handleNotificationWebhook(request, env)
      }
      if (path === '/api/webhook/sms' && request.method === 'POST') {
        return handleSmsWebhook(request, env)
      }
      if (path === '/api/webhook/email-otp' && request.method === 'POST') {
        return handleEmailOtpWebhook(request, env)
      }

      // Public Blog Routes
      if (path === '/api/blogs' && request.method === 'GET') {
        return handleListBlogs(request, env)
      }
      const publicBlogMatch = path.match(/^\/api\/blogs\/([^\/]+)$/)
      if (publicBlogMatch && request.method === 'GET') {
        return handleGetBlog(publicBlogMatch[1], env)
      }
      // Blog view tracking (public, no auth needed)
      const blogViewMatch = path.match(/^\/api\/blogs\/([^\/]+)\/view$/)
      if (blogViewMatch && request.method === 'POST') {
        return handleBlogView(blogViewMatch[1], request, env)
      }
      const imageMatch = path.match(/^\/api\/images\/([^\/]+)$/)
      if (imageMatch && request.method === 'GET') {
        return handleGetImage(imageMatch[1], env)
      }

      // Dynamic Sitemap for SEO
      if (path === '/api/sitemap.xml' && request.method === 'GET') {
        const blogsIndex = await env.SMART_NOTE_KV.get('public/blogs/_index', 'json') as { blogs: any[] } | null
        const blogs = (blogsIndex?.blogs || []).filter((b: any) => b.published !== false)
        const siteUrl = env.FRONTEND_URL || 'https://finnote-f4n.pages.dev'

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <priority>1.0</priority>
    <changefreq>daily</changefreq>
  </url>
  <url>
    <loc>${siteUrl}/blog</loc>
    <priority>0.9</priority>
    <changefreq>daily</changefreq>
  </url>`

        for (const blog of blogs) {
          const lastmod = blog.updatedAt || blog.createdAt || new Date().toISOString()
          xml += `
  <url>
    <loc>${siteUrl}/blog/${blog.slug}</loc>
    <lastmod>${lastmod.split('T')[0]}</lastmod>
    <priority>0.8</priority>
    <changefreq>weekly</changefreq>
  </url>`
        }

        xml += '\n</urlset>'

        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders(env, request.headers.get('Origin')),
          },
        })
      }

      // Public Shared Note Route
      const sharedNoteMatch = path.match(/^\/api\/notes\/shared\/(.+)$/)
      if (sharedNoteMatch && request.method === 'GET') {
        return handleGetSharedNote(sharedNoteMatch[1], request, env)
      }

      // ── OTP Hub (Public Routes) ──
      if (path === '/api/otp-hub' && request.method === 'GET') {
        return handleListOtpCodes(env)
      }
      if (path === '/api/otp-hub/subscribe' && request.method === 'POST') {
        return handleOtpSubscribe(request, env)
      }
      if (path === '/api/otp-hub/unsubscribe' && request.method === 'POST') {
        return handleOtpUnsubscribe(request, env)
      }

      // Protected routes - verify JWT
      const authHeader = request.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return errorResponse('Unauthorized', 401)
      }

      const token = authHeader.substring(7)
      const payload = await verifyJWT(token, env.JWT_SECRET)
      if (!payload) return errorResponse('Invalid token', 401)

      const userId = payload.userId

      // User Profile & Account
      if (path === '/api/auth/profile' && request.method === 'PUT') {
        return handleUpdateProfile(userId, request, env)
      }
      if (path === '/api/auth/delete-account' && request.method === 'POST') {
        return handleDeleteAccount(userId, request, env)
      }

      // Admin Blog Routes
      if (path === '/api/blogs' && request.method === 'POST') {
        return handleCreateBlog(userId, request, env)
      }
      if (path === '/api/blogs/generate-content' && request.method === 'POST') {
        return handleGenerateBlogContent(userId, request, env)
      }
      if (path === '/api/blogs/refine-content' && request.method === 'POST') {
        return handleRefineBlogContent(userId, request, env)
      }
      if (path === '/api/blogs/generate-image' && request.method === 'POST') {
        return handleGenerateBlogImage(userId, request, env)
      }
      if (path === '/api/images' && request.method === 'POST') {
        return handleUploadImage(userId, request, env)
      }
      const adminBlogMatch = path.match(/^\/api\/blogs\/([^\/]+)$/)
      if (adminBlogMatch && request.method === 'PUT') {
        return handleUpdateBlog(userId, adminBlogMatch[1], request, env)
      }
      if (adminBlogMatch && request.method === 'DELETE') {
        return handleDeleteBlog(userId, adminBlogMatch[1], env)
      }

      // ── OTP Hub (Admin Routes) ──
      if (path === '/api/otp-hub' && request.method === 'POST') {
        return handleCreateOtpCode(userId, request, env)
      }
      const otpDeleteMatch = path.match(/^\/api\/otp-hub\/([^\/]+)$/)
      if (otpDeleteMatch && request.method === 'DELETE') {
        return handleDeleteOtpCode(userId, otpDeleteMatch[1], env)
      }
      if (path === '/api/otp-hub/settings' && request.method === 'GET') {
        return handleGetOtpSettings(userId, env)
      }
      if (path === '/api/otp-hub/settings' && request.method === 'PUT') {
        return handleUpdateOtpSettings(userId, request, env)
      }
      if (path === '/api/otp-hub/subscribers/count' && request.method === 'GET') {
        return handleGetOtpSubscriberCount(userId, env)
      }

      // Bug Report
      if (path === '/api/report-bug' && request.method === 'POST') {
        return handleReportBug(userId, request, env)
      }

      // Contact Feedback
      if (path === '/api/contact-feedback' && request.method === 'POST') {
        return handleContactFeedback(userId, request, env)
      }

      // Notes CRUD
      if (path === '/api/notes' && request.method === 'GET') {
        return handleListNotes(userId, env)
      }
      if (path === '/api/notes' && request.method === 'POST') {
        return handleCreateNote(userId, request, env)
      }
      const noteMatch = path.match(/^\/api\/notes\/(.+)$/)
      if (noteMatch) {
        const noteId = noteMatch[1]
        if (request.method === 'GET') return handleGetNote(userId, noteId, env)
        if (request.method === 'PUT') return handleUpdateNote(userId, noteId, request, env)
        if (request.method === 'DELETE') return handleDeleteNote(userId, noteId, env)
      }
      
      const shareNoteMatch = path.match(/^\/api\/notes\/(.+)\/share$/)
      if (shareNoteMatch && request.method === 'POST') {
        return handleUpdateNoteShare(userId, shareNoteMatch[1], request, env)
      }

      // Live Webhook Logs
      if (path === '/api/webhook/sms/latest' && request.method === 'GET') {
        return handleGetLatestSmsLog(userId, env)
      }
      if (path === '/api/webhook/sms/history' && request.method === 'GET') {
        return handleGetWebhookHistory(userId, env)
      }

      // Finance: Wallets
      if (path === '/api/wallets' && request.method === 'GET') {
        return handleListWallets(userId, env)
      }
      if (path === '/api/wallets' && request.method === 'POST') {
        return handleCreateWallet(userId, request, env)
      }
      const walletMatch = path.match(/^\/api\/wallets\/(.+)$/)
      if (walletMatch) {
        const walletId = walletMatch[1]
        if (request.method === 'PUT') return handleUpdateWallet(userId, walletId, request, env)
        if (request.method === 'DELETE') return handleDeleteWallet(userId, walletId, env)
      }

      // Finance: Transactions
      if (path === '/api/transactions' && request.method === 'GET') {
        return handleListTransactions(userId, request, env)
      }
      if (path === '/api/finance/stats' && request.method === 'GET') {
        return handleGetFinanceStats(userId, request, env)
      }
      if (path === '/api/transactions' && request.method === 'POST') {
        return handleCreateTransaction(userId, request, env)
      }
      const txMatch = path.match(/^\/api\/transactions\/(.+)$/)
      if (txMatch && request.method === 'DELETE') {
        return handleDeleteTransaction(userId, txMatch[1], env)
      }

      // Finance: Pending Transfers
      if (path === '/api/finance/pending-transfers' && request.method === 'GET') {
        return handleListPendingTransfers(userId, env)
      }
      const resolvePendingTransferMatch = path.match(/^\/api\/finance\/pending-transfers\/(.+)\/resolve$/)
      if (resolvePendingTransferMatch && request.method === 'POST') {
        return handleResolvePendingTransfer(userId, resolvePendingTransferMatch[1], request, env)
      }

      // Finance: Budget
      if (path === '/api/finance/budget' && request.method === 'GET') {
        return handleGetBudget(userId, env)
      }
      if (path === '/api/finance/budget' && request.method === 'PUT') {
        return handleUpdateBudget(userId, request, env)
      }

      // Finance: Savings
      if (path === '/api/savings' && request.method === 'GET') {
        return handleListSavings(userId, env)
      }
      if (path === '/api/savings' && request.method === 'POST') {
        return handleCreateSaving(userId, request, env)
      }
      const savingMatch = path.match(/^\/api\/savings\/(.+)$/)
      if (savingMatch) {
        const savingId = savingMatch[1]
        // Note: Check for sub-paths before the base ID match if needed, but since we matched strict id, deposit and withdraw must be checked first
      }

      const savingDepositMatch = path.match(/^\/api\/savings\/(.+)\/deposit$/)
      if (savingDepositMatch && request.method === 'POST') {
        return handleDepositSaving(userId, savingDepositMatch[1], request, env)
      }

      const savingWithdrawMatch = path.match(/^\/api\/savings\/(.+)\/withdraw$/)
      if (savingWithdrawMatch && request.method === 'POST') {
        return handleWithdrawSaving(userId, savingWithdrawMatch[1], request, env)
      }

      const savingIdMatch = path.match(/^\/api\/savings\/([^\/]+)$/)
      if (savingIdMatch) {
        if (request.method === 'PUT') return handleUpdateSaving(userId, savingIdMatch[1], request, env)
        if (request.method === 'DELETE') return handleDeleteSaving(userId, savingIdMatch[1], env)
      }

      // Trading Journal
      if (path === '/api/trading/config' && request.method === 'GET') {
        return handleGetTradingConfig(userId, env)
      }
      if (path === '/api/trading/config' && request.method === 'PUT') {
        return handleUpdateTradingConfig(userId, request, env)
      }
      if (path === '/api/trading/checkins' && request.method === 'GET') {
        return handleListTradingCheckins(userId, env)
      }
      if (path === '/api/trading/checkins' && request.method === 'POST') {
        return handleCreateTradingCheckin(userId, request, env)
      }
      const tradingCheckinMatch = path.match(/^\/api\/trading\/checkins\/([\d-]+)$/)
      if (tradingCheckinMatch && request.method === 'PUT') {
        return handleUpdateTradingCheckin(userId, tradingCheckinMatch[1], request, env)
      }

      // PIN
      if (path === '/api/pin' && request.method === 'GET') {
        return handleCheckPin(userId, env)
      }
      if (path === '/api/pin' && request.method === 'POST') {
        return handleSetPin(userId, request, env)
      }
      if (path === '/api/pin/verify' && request.method === 'POST') {
        return handleVerifyPin(userId, request, env)
      }
      if (path === '/api/pin/forgot' && request.method === 'POST') {
        return handleForgotPin(userId, request, env)
      }
      if (path === '/api/pin/reset' && request.method === 'POST') {
        return handleResetPin(userId, request, env)
      }

      // Notifications
      if (path === '/api/notifications' && request.method === 'GET') {
        return handleListNotifications(userId, env)
      }
      if (path === '/api/notifications/read-all' && request.method === 'POST') {
        return handleMarkAllNotificationsRead(userId, env)
      }
      if (path === '/api/notifications' && request.method === 'DELETE') {
        return handleClearNotifications(userId, env)
      }
      const notiReadMatch = path.match(/^\/api\/notifications\/(.+)\/read$/)
      if (notiReadMatch && request.method === 'POST') {
        return handleMarkNotificationRead(userId, notiReadMatch[1], env)
      }

      // Pending notifications
      if (path === '/api/pending' && request.method === 'GET') {
        return handleListPending(userId, env)
      }
      const pendingMatch = path.match(/^\/api\/pending\/(.+)\/resolve$/)
      if (pendingMatch && request.method === 'POST') {
        return handleResolvePending(userId, pendingMatch[1], env)
      }

      // Stocks
      if (path === '/api/stocks' && request.method === 'GET') {
        return handleListStocks(userId, env)
      }
      if (path === '/api/stocks' && request.method === 'POST') {
        return handleCreateStock(userId, request, env)
      }

      // Stock Alerts
      const alertMatch = path.match(/^\/api\/stocks\/([^\/]+)\/alerts$/)
      if (alertMatch && request.method === 'POST') {
        return handleAddStockAlert(userId, alertMatch[1], request, env)
      }
      const alertDeleteMatch = path.match(/^\/api\/stocks\/([^\/]+)\/alerts\/([^\/]+)$/)
      if (alertDeleteMatch && request.method === 'DELETE') {
        return handleDeleteStockAlert(userId, alertDeleteMatch[1], alertDeleteMatch[2], env)
      }
      const alertResetMatch = path.match(/^\/api\/stocks\/([^\/]+)\/alerts\/([^\/]+)\/reset$/)
      if (alertResetMatch && request.method === 'POST') {
        return handleResetStockAlert(userId, alertResetMatch[1], alertResetMatch[2], env)
      }

      const stockMatch = path.match(/^\/api\/stocks\/([^\/]+)$/)
      if (stockMatch) {
        const stockId = stockMatch[1]
        if (request.method === 'PUT') return handleUpdateStock(userId, stockId, request, env)
        if (request.method === 'DELETE') return handleDeleteStock(userId, stockId, env)
      }

      // Fund Positions (Chứng chỉ quỹ)
      if (path === '/api/funds' && request.method === 'GET') {
        return handleListFunds(userId, env)
      }
      if (path === '/api/funds' && request.method === 'POST') {
        return handleCreateFund(userId, request, env)
      }
      const fundMatch = path.match(/^\/api\/funds\/([^\/]+)$/)
      if (fundMatch) {
        const fundId = fundMatch[1]
        if (request.method === 'PUT') return handleUpdateFund(userId, fundId, request, env)
        if (request.method === 'DELETE') return handleDeleteFund(userId, fundId, env)
      }

      // Push Notifications

      if (path === '/api/push/subscribe' && request.method === 'POST') {
        return handlePushSubscribe(userId, request, env)
      }
      if (path === '/api/push/unsubscribe' && request.method === 'POST') {
        return handlePushUnsubscribe(userId, request, env)
      }
      if (path === '/api/push/test' && request.method === 'POST') {
        return handlePushTest(userId, request, env)
      }

      // Reminders
      if (path === '/api/reminders' && request.method === 'GET') {
        return handleListReminders(userId, env)
      }
      if (path === '/api/reminders' && request.method === 'POST') {
        return handleCreateReminder(userId, request, env)
      }
      if (path === '/api/reminders' && request.method === 'DELETE') {
        return handleClearReminders(userId, request, env)
      }
      if (path === '/api/reminders/ai-detect' && request.method === 'POST') {
        return handleAiDetectReminders(userId, request, env)
      }
      const reminderMatch = path.match(/^\/api\/reminders\/([^\/]+)$/)
      if (reminderMatch) {
        const reminderId = reminderMatch[1]
        if (request.method === 'PUT') return handleUpdateReminder(userId, reminderId, request, env)
        if (request.method === 'DELETE') return handleDeleteReminder(userId, reminderId, env)
      }
      const reminderCompleteMatch = path.match(/^\/api\/reminders\/([^\/]+)\/complete$/)
      if (reminderCompleteMatch && request.method === 'POST') {
        return handleCompleteReminder(userId, reminderCompleteMatch[1], env)
      }
      const reminderAckMatch = path.match(/^\/api\/reminders\/([^\/]+)\/acknowledge$/)
      if (reminderAckMatch && request.method === 'POST') {
        return handleAcknowledgeReminder(userId, reminderAckMatch[1], env)
      }

      // Todos
      if (path === '/api/todos' && request.method === 'GET') {
        return handleListTodos(userId, env)
      }
      if (path === '/api/todos' && request.method === 'POST') {
        return handleCreateTodo(userId, request, env)
      }
      if (path === '/api/todos' && request.method === 'DELETE') {
        return handleClearTodos(userId, request, env)
      }
      if (path === '/api/todos/ai-generate' && request.method === 'POST') {
        return handleAiGenerateTodos(userId, request, env)
      }
      const todoMatch = path.match(/^\/api\/todos\/([^\/]+)$/)
      if (todoMatch) {
        const todoId = todoMatch[1]
        if (request.method === 'PUT') return handleUpdateTodo(userId, todoId, request, env)
        if (request.method === 'DELETE') return handleDeleteTodo(userId, todoId, env)
      }

      // AI
      if (path === '/api/ai/stream' && request.method === 'POST') {
        return handleAiStream(request, env)
      }
      if (path === '/api/ai' && request.method === 'POST') {
        return handleAi(request, env)
      }
      if (path === '/api/ai/image' && request.method === 'POST') {
        return handleAiImage(request, env)
      }

      // 404 Fallback
      return errorResponse(`Not found: ${request.method} ${path}`, 404)
    } catch (err: any) {
    console.error('[Worker Error]', err)
    return errorResponse(err.message || 'Internal server error', 500)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestOrigin = request.headers.get('Origin')

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env, requestOrigin) })
    }

    const response = await handleRequest(request, env)

    // ── Global CORS Wrapper ──
    // Ensures every response from the worker gets the correct dynamic CORS header
    // rather than the default ALLOWED_ORIGINS[0] that jsonResponse provides.
    const finalHeaders = new Headers(response.headers)
    const cors = corsHeaders(env, requestOrigin)
    for (const [key, value] of Object.entries(cors)) {
      finalHeaders.set(key, value as string)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders
    })
  },

  // ── Cloudflare Cron Trigger ──
  // Cron 1: */30 2-8 * * 1-5 = Stock alerts every 30 min during trading hours (9-15h VN, Mon-Fri)
  // Cron 2: */15 * * * * = Reminders + Trading reminders every 15 minutes
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Always check stock alerts during trading hours
    const cronTime = new Date(event.scheduledTime)
    const day = cronTime.getUTCDay()
    const hour = cronTime.getUTCHours()
    
    // Only check stock alerts Mon-Fri (1-5) and between 2-8 UTC (9h-15h VN)
    if (day >= 1 && day <= 5 && hour >= 2 && hour <= 8) {
      ctx.waitUntil(
        checkAllStockAlerts(env)
          .then(result => console.log(`[Cron] StockAlerts: ${result}`))
          .catch(err => console.error('[Cron] StockAlerts failed:', err))
      )
    }

    // Reminders: check every 15 minutes (all cron triggers hit this handler)
    ctx.waitUntil(
      checkAllReminders(env)
        .then(result => console.log(`[Cron] Reminders: ${result}`))
        .catch(err => console.error('[Cron] Reminders failed:', err))
    )

    // Trading daily check-in reminders
    ctx.waitUntil(
      checkTradingReminders(env)
        .then(result => console.log(result))
        .catch(err => console.error('[Cron] TradingReminder failed:', err))
    )

    // Savings reminders
    ctx.waitUntil(
      checkSavingsReminders(env)
        .then(result => console.log(result))
        .catch(err => console.error('[Cron] SavingsReminder failed:', err))
    )
  }
}
