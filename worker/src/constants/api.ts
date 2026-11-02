// Backend Constants for external APIs

// Google OAuth
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_OAUTH_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
export const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

// Email API
export const RESEND_API_URL = 'https://api.resend.com/emails'

// Google AI (Gemini)
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Third-party Data APIs
export const FREE_IP_API = 'https://freeipapi.com/api/json'
export const OPEN_METEO_FORECAST_API = 'https://api.open-meteo.com/v1/forecast'
export const OPEN_METEO_AQI_API = 'https://air-quality-api.open-meteo.com/v1/air-quality'
export const EXCHANGERATE_API = 'https://api.exchangerate-api.com/v4/latest/USD'
export const ENTRADE_CHART_API = 'https://services.entrade.com.vn/chart-api/v2/ohlcs/stock'
export const FMARKET_API_BASE = 'https://api.fmarket.vn/res'

// VNExpress RSS
export const VNEXPRESS_RSS = {
  BUSINESS: 'https://vnexpress.net/rss/kinh-doanh.rss',
  STARTUP: 'https://vnexpress.net/rss/startup.rss',
  TECH: 'https://vnexpress.net/rss/so-hoa.rss',
  WORLD: 'https://vnexpress.net/rss/the-gioi.rss'
}

// Youtube API
export const YOUTUBE_OEMBED_API = 'https://www.youtube.com/oembed'
export const YOUTUBE_SEARCH_URL = 'https://www.youtube.com/results'

// Vietnamese gold prices (VND per chỉ on PNJ; per lượng on vang.today)
export const PNJ_GOLD_PRICE_API = 'https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price?zone=00'
export const VANG_TODAY_API = 'https://www.vang.today/api/prices'
