import { jsonResponse, errorResponse } from '../utils/response'
import { getCached, setCached } from '../services/cache.service'
import { FREE_IP_API, OPEN_METEO_FORECAST_API, OPEN_METEO_AQI_API, EXCHANGERATE_API, ENTRADE_CHART_API, FMARKET_API_BASE } from '../constants/api'

/**
 * Handle /api/proxy/location
 * Detects the user's location based on Cloudflare's `request.cf` object.
 * If running locally without `cf`, falls back to a free IP API.
 */
export async function handleProxyLocation(request: Request): Promise<Response> {
  const cf = request.cf

  // When running on Cloudflare Workers, `cf` contains geolocation data
  if (cf && cf.latitude && cf.longitude) {
    let city = cf.city as string || 'Vị trí của bạn'
    if (city.includes('Ho Chi Minh') || city === 'Thành phố Hồ Chí Minh' || city === 'TP.HCM' || city.includes('TP. HCM')) city = 'Ho Chi Minh City'
    if (city.includes('Ha Noi') || city === 'Hanoi') city = 'Hà Nội'
    if (city.includes('Da Nang') || city === 'Danang') city = 'Đà Nẵng'

    return jsonResponse({
      success: true,
      data: {
        lat: parseFloat(cf.latitude as string),
        lon: parseFloat(cf.longitude as string),
        city,
        country: cf.country || ''
      }
    })
  }

  // Fallback for local dev (wrangler dev might not populate cf)
  try {
    const res = await fetch(FREE_IP_API)
    const data = await res.json() as any
    if (data && data.latitude && data.longitude) {
      let city = data.cityName || 'Vị trí của bạn'
      if (city.includes('Ho Chi Minh') || city === 'Thành phố Hồ Chí Minh' || city === 'TP.HCM' || city.includes('TP. HCM')) city = 'Ho Chi Minh City'
      if (city.includes('Ha Noi') || city === 'Hanoi') city = 'Hà Nội'
      if (city.includes('Da Nang') || city === 'Danang') city = 'Đà Nẵng'
      
      return jsonResponse({
        success: true,
        data: {
          lat: data.latitude,
          lon: data.longitude,
          city,
          country: data.countryName || ''
        }
      })
    }
  } catch (err) {
    // Ignore and fallback
  }

  return jsonResponse({
    success: true,
    data: {
      lat: 10.8231,
      lon: 106.6297,
      city: 'Ho Chi Minh City',
      country: 'Việt Nam'
    }
  })
}

/**
 * Handle /api/proxy/weather
 * Requires ?lat=...&lon=...
 * Proxies requests to Open-Meteo to bypass client-side adblockers
 */
export async function handleProxyWeather(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const lat = url.searchParams.get('lat')
  const lon = url.searchParams.get('lon')

  if (!lat || !lon) {
    return errorResponse('Missing lat and lon query parameters', 400)
  }

  try {
    const [weatherRes, aqiRes] = await Promise.allSettled([
      fetch(
        `${OPEN_METEO_FORECAST_API}` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,uv_index` +
        `&timezone=auto`
      ),
      fetch(
        `${OPEN_METEO_AQI_API}` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=us_aqi,pm2_5` +
        `&timezone=auto`
      )
    ])

    if (weatherRes.status === 'rejected') {
      return errorResponse(`Weather proxy failed: ${weatherRes.reason?.message || weatherRes.reason}`, 502)
    }

    if (weatherRes.status === 'fulfilled' && !weatherRes.value.ok) {
      return errorResponse(`Open-Meteo returned HTTP ${weatherRes.value.status}`, 502)
    }

    let weatherData = null
    let aqiData = null

    if (weatherRes.status === 'fulfilled') {
      weatherData = await weatherRes.value.json()
    }

    if (aqiRes.status === 'fulfilled' && aqiRes.value.ok) {
      aqiData = await aqiRes.value.json()
    }

    return jsonResponse({
      success: true,
      data: {
        weather: weatherData,
        aqi: aqiData
      }
    })
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
}

/**
 * Handle /api/proxy/exchange-rate
 * Proxies request to exchangerate-api.com for real-time USD/VND data
 */
export async function handleProxyExchangeRate(request: Request): Promise<Response> {
  try {
    const res = await fetch(EXCHANGERATE_API, {
      headers: {
        'User-Agent': 'Cloudflare-Worker'
      }
    })

    if (!res.ok) {
      return errorResponse(`Exchange rate API HTTP ${res.status}`, 502)
    }

    const data = await res.json() as any
    const vndRate = data?.rates?.VND
    
    if (!vndRate) {
      return errorResponse('Failed to parse exchange rate', 500)
    }

    // Convert from (1 USD = X VND) to (1 VND = X USD)
    const usdPerVnd = 1 / vndRate

    return jsonResponse({
      success: true,
      data: {
        vnd: { usd: usdPerVnd }
      }
    })
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
}

/**
 * Handle /api/proxy/stock-price
 * Fetch from DNSE API, cached in memory/edge (not KV) to prevent rate limits
 */
export async function handleProxyStockPrice(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')?.toUpperCase()
  const force = url.searchParams.get('force') === 'true' || url.searchParams.get('force') === '1'

  if (!symbol) {
    return errorResponse('Missing symbol query parameter', 400)
  }

  const cacheKey = `public/stocks/${symbol}`
  const now = Date.now()

  try {
    // Try cache first (valid for 5 minutes)
    if (!force) {
      const cached = await getCached<any>(cacheKey)
      if (cached) {
        if (now - cached.timestamp < 5 * 60 * 1000) {
          return jsonResponse({ success: true, data: { currentPrice: cached.price, symbol } })
        }
      }
    }

    // Fetch new price
    const to = Math.floor(now / 1000)
    const from = to - 86400 * 15 // Last 15 days to handle holidays
    const res = await fetch(`${ENTRADE_CHART_API}?from=${from}&to=${to}&symbol=${symbol}&resolution=1D`)

    if (!res.ok) {
      return errorResponse(`DNSE API HTTP ${res.status}`, 502)
    }

    const data = await res.json() as any
    if (!data || !data.c || data.c.length === 0) {
      return errorResponse('Symbol not found or no data', 404)
    }

    const currentPrice = data.c[data.c.length - 1]

    // Cache the result
    await setCached(cacheKey, { price: currentPrice, timestamp: now }, 3600)

    return jsonResponse({
      success: true,
      data: { currentPrice, symbol }
    })
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
}

/**
 * Handle /api/proxy/stock-history
 * Fetch from DNSE API, cached in memory/edge (not KV)
 */
export async function handleProxyStockHistory(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')?.toUpperCase()
  const days = parseInt(url.searchParams.get('days') || '7', 10)
  const force = url.searchParams.get('force') === 'true' || url.searchParams.get('force') === '1'

  if (!symbol) {
    return errorResponse('Missing symbol query parameter', 400)
  }

  const cacheKey = `public/stocks/history/${symbol}/${days}`
  const now = Date.now()

  try {
    // Try cache first (valid for 15 minutes)
    if (!force) {
      const cached = await getCached<any>(cacheKey)
      if (cached) {
        if (now - cached.timestamp < 15 * 60 * 1000) {
          return jsonResponse({ success: true, data: { history: cached.history, symbol } })
        }
      }
    }

    const to = Math.floor(now / 1000)
    // Add extra days to account for weekends/holidays where market is closed
    const from = to - 86400 * (days + 4) 
    const res = await fetch(`${ENTRADE_CHART_API}?from=${from}&to=${to}&symbol=${symbol}&resolution=1D`)

    if (!res.ok) {
      return errorResponse(`DNSE API HTTP ${res.status}`, 502)
    }

    const data = await res.json() as any
    if (!data || !data.c || data.c.length === 0) {
      return errorResponse('Symbol not found or no data', 404)
    }

    // Get last 'days' items
    const closes = data.c.slice(-days)
    const opens = data.o?.slice(-days) || closes
    const highs = data.h?.slice(-days) || closes
    const lows = data.l?.slice(-days) || closes
    const volumes = data.v?.slice(-days) || []
    const timestamps = data.t.slice(-days)
    const history = closes.map((price: number, i: number) => ({
      price,
      open: opens[i],
      high: highs[i],
      low: lows[i],
      volume: volumes[i],
      time: timestamps[i] * 1000
    }))

    await setCached(cacheKey, { history, timestamp: now }, 3600)

    return jsonResponse({
      success: true,
      data: { history, symbol }
    })
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
}

/**
 * Handle /api/proxy/logo
 * Proxy logo fetching to bypass frontend CORS/DNS blocks
 */
export async function handleProxyLogo(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')?.toUpperCase()

  if (!symbol) {
    return new Response('Missing symbol', { status: 400 })
  }

  const urls = [
    `https://cdn.simplize.vn/simplizevn/logo/${symbol}.jpeg`,
    `https://fiin-fundamental.ssi.com.vn/StockTicker/GetTickerImage?code=${symbol}`,
    `https://tcdn.tcbs.com.vn/avatar/a/${symbol}.png`,
    `https://image.simplize.vn/logo/${symbol.toLowerCase()}.jpeg`
  ]

  for (const fetchUrl of urls) {
    try {
      const res = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://iboard.ssi.com.vn/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      })
      if (res.ok) {
        const headers = new Headers()
        headers.set('Content-Type', res.headers.get('content-type') || 'image/png')
        headers.set('Cache-Control', 'public, max-age=864000') // 10 days cache
        headers.set('Access-Control-Allow-Origin', '*')
        return new Response(res.body, { status: 200, headers })
      }
    } catch (e) {
      // ignore
    }
  }

  return new Response('Not found', { status: 404 })
}

// ─────────────────────────────────────────────────────────────────
// Fmarket Fund Proxy (no auth required for public NAV data)
// ─────────────────────────────────────────────────────────────────

const FMARKET_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Origin': 'https://fmarket.vn',
  'Referer': 'https://fmarket.vn/',
}

/**
 * GET /api/proxy/fund-nav?symbol=SSISCA
 * Fetch current NAV for one fund symbol from Fmarket.
 * Cache: 4 hours (NAV is published daily at T+1)
 */
export async function handleProxyFundNav(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')?.toUpperCase()
  const force = url.searchParams.get('force') === 'true' || url.searchParams.get('force') === '1'

  if (!symbol) return errorResponse('Missing symbol', 400)

  const cacheKey = `public/funds/nav/${symbol}`
  const now = Date.now()

  try {
    // Cache for 4 hours — NAV updates once a day
    if (!force) {
      const parsed = await getCached<any>(cacheKey)
      if (parsed) {
        if (now - parsed.timestamp < 4 * 60 * 60 * 1000) {
          return jsonResponse({ success: true, data: { nav: parsed.nav, symbol } })
        }
      }
    }

    // POST to Fmarket filter with exact symbol search
    const res = await fetch(`${FMARKET_API_BASE}/products/filter`, {
      method: 'POST',
      headers: FMARKET_HEADERS,
      body: JSON.stringify({
        types: ['NEW_FUND', 'TRADING_FUND'],
        issuerIds: [],
        sortOrder: 'DESC',
        sortField: 'navTo6Months',
        page: 1,
        pageSize: 10,
        isIpo: false,
        fundAssetTypes: [],
        bondRemainPeriods: [],
        searchField: symbol,
        isBuyByReward: false,
        thirdAppIds: []
      })
    })

    if (!res.ok) return errorResponse(`Fmarket API HTTP ${res.status}`, 502)

    const data = await res.json() as any
    const fund = data?.data?.rows?.find((f: any) =>
      f.shortName?.toUpperCase() === symbol || f.name?.toUpperCase().includes(symbol)
    )

    if (!fund) return errorResponse('Fund not found', 404)

    const nav = fund.nav || fund.navCurrent || 0
    await setCached(cacheKey, { nav, timestamp: now }, 14400)

    return jsonResponse({ success: true, data: { nav, symbol, fundName: fund.name, productId: fund.id } })
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
}

/**
 * GET /api/proxy/fund-history?symbol=SSISCA&days=7
 * Fetch historical NAV for a fund from Fmarket.
 * Cache: 6 hours
 */
export async function handleProxyFundHistory(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')?.toUpperCase()
  const days = parseInt(url.searchParams.get('days') || '7', 10)
  const force = url.searchParams.get('force') === 'true' || url.searchParams.get('force') === '1'
  const productIdParam = url.searchParams.get('productId')

  if (!symbol) return errorResponse('Missing symbol', 400)

  const cacheKey = `public/funds/history/${symbol}/${days}`
  const now = Date.now()

  try {
    if (!force) {
      const parsed = await getCached<any>(cacheKey)
      if (parsed) {
        if (now - parsed.timestamp < 6 * 60 * 60 * 1000) {
          return jsonResponse({ success: true, data: { history: parsed.history, symbol } })
        }
      }
    }

    // Need productId — either from query param or look it up
    let productId = productIdParam ? parseInt(productIdParam, 10) : null

    if (!productId) {
      // Quick lookup via filter
      const searchRes = await fetch(`${FMARKET_API_BASE}/products/filter`, {
        method: 'POST',
        headers: FMARKET_HEADERS,
        body: JSON.stringify({
          types: ['NEW_FUND', 'TRADING_FUND'],
          issuerIds: [], sortOrder: 'DESC', sortField: 'navTo6Months',
          page: 1, pageSize: 5, isIpo: false, fundAssetTypes: [],
          bondRemainPeriods: [], searchField: symbol, isBuyByReward: false, thirdAppIds: []
        })
      })
      if (searchRes.ok) {
        const sData = await searchRes.json() as any
        const found = sData?.data?.rows?.find((f: any) => f.shortName?.toUpperCase() === symbol)
        productId = found?.id || null
      }
    }

    if (!productId) return errorResponse('Cannot find fund productId', 404)

    // Fetch NAV history
    const toDate = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const fromDate = new Date(Date.now() - days * 3 * 86400 * 1000).toISOString().split('T')[0].replace(/-/g, '') // 3x buffer

    const histRes = await fetch(`${FMARKET_API_BASE}/product/get-nav-history`, {
      method: 'POST',
      headers: FMARKET_HEADERS,
      body: JSON.stringify({ isAllData: 0, productId, fromDate, toDate })
    })

    if (!histRes.ok) return errorResponse(`Fmarket history API HTTP ${histRes.status}`, 502)

    const histData = await histRes.json() as any
    const rows = histData?.data?.navHistories || histData?.data || []

    const history = rows
      .slice(-days)
      .map((row: any) => ({
        nav: row.nav || row.navCurrent || 0,
        time: new Date(row.navDate || row.date || row.time).getTime()
      }))
      .filter((h: any) => h.nav > 0)

    await setCached(cacheKey, { history, timestamp: now }, 21600)

    return jsonResponse({ success: true, data: { history, symbol } })
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
}

/**
 * GET /api/proxy/fund-list?q=SSI
 * Search funds from Fmarket (for autocomplete). Cache: 24 hours.
 */
export async function handleProxyFundList(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const query = (url.searchParams.get('q') || '').trim()

  const cacheKey = `public/funds/list/${query.toUpperCase()}`
  const now = Date.now()

  try {
    const parsed = await getCached<any>(cacheKey)
    if (parsed) {
      if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
        return jsonResponse({ success: true, data: { funds: parsed.funds } })
      }
    }

    const res = await fetch(`${FMARKET_API_BASE}/products/filter`, {
      method: 'POST',
      headers: FMARKET_HEADERS,
      body: JSON.stringify({
        types: ['NEW_FUND', 'TRADING_FUND'],
        issuerIds: [], sortOrder: 'DESC', sortField: 'navTo6Months',
        page: 1, pageSize: 50, isIpo: false, fundAssetTypes: [],
        bondRemainPeriods: [], searchField: query, isBuyByReward: false, thirdAppIds: []
      })
    })

    if (!res.ok) return errorResponse(`Fmarket API HTTP ${res.status}`, 502)

    const data = await res.json() as any
    const funds = (data?.data?.rows || []).map((f: any) => ({
      symbol: f.shortName || '',
      name: f.name || '',
      type: f.type || '',
      productId: f.id || 0,
      nav: f.nav || f.navCurrent || 0,
      issuer: f.managementFee?.name || ''
    }))

    await setCached(cacheKey, { funds, timestamp: now }, 86400)

    return jsonResponse({ success: true, data: { funds } })
  } catch (err: any) {
    return errorResponse(err.message, 500)
  }
}
