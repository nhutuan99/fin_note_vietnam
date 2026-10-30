/**
 * useWeather — Fetches real-time weather & air quality data.
 *
 * APIs used (all completely free, no key required):
 *  - Open-Meteo:       https://open-meteo.com
 *  - Open-Meteo AQI:   https://air-quality-api.open-meteo.com
 *  - ip-api.com:       https://ip-api.com  (IP-based location fallback)
 *  - Browser Geolocation API (primary location source)
 */

import { ref, onMounted } from 'vue'
import { useEventListener } from '@/composables/useEventListener'
import { httpClient } from '@/shared/api/httpClient'


// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeatherData {
  temperature: number       // °C
  feelsLike: number         // °C
  humidity: number          // %
  windSpeed: number         // km/h
  weatherCode: number       // WMO code
  uvIndex: number
  city: string
  country: string
  lat: number
  lon: number
}

export interface AirQualityData {
  aqi: number               // US AQI
  pm25: number              // μg/m³
}

export interface TrafficLevel {
  level: 'low' | 'medium' | 'high'
  label: string
  emoji: string
}

// ── WMO Weather Code Map ──────────────────────────────────────────────────────

export const WMO_MAP: Record<number, { vi: string; en: string; emoji: string }> = {
  0:  { vi: 'Trời quang',        en: 'Clear sky', emoji: '☀️' },
  1:  { vi: 'Ít mây',            en: 'Mainly clear', emoji: '🌤️' },
  2:  { vi: 'Có mây',            en: 'Partly cloudy', emoji: '⛅' },
  3:  { vi: 'Nhiều mây',         en: 'Overcast', emoji: '☁️' },
  45: { vi: 'Sương mù',          en: 'Fog', emoji: '🌫️' },
  48: { vi: 'Sương mù đặc',      en: 'Depositing rime fog', emoji: '🌫️' },
  51: { vi: 'Mưa phùn nhẹ',      en: 'Light drizzle', emoji: '🌦️' },
  53: { vi: 'Mưa phùn',          en: 'Moderate drizzle', emoji: '🌦️' },
  55: { vi: 'Mưa phùn dày',      en: 'Dense drizzle', emoji: '🌧️' },
  61: { vi: 'Mưa nhẹ',           en: 'Slight rain', emoji: '🌧️' },
  63: { vi: 'Mưa vừa',           en: 'Moderate rain', emoji: '🌧️' },
  65: { vi: 'Mưa to',            en: 'Heavy rain', emoji: '🌧️' },
  71: { vi: 'Tuyết nhẹ',         en: 'Slight snow fall', emoji: '🌨️' },
  73: { vi: 'Tuyết vừa',         en: 'Moderate snow fall', emoji: '🌨️' },
  75: { vi: 'Tuyết dày',         en: 'Heavy snow fall', emoji: '❄️' },
  80: { vi: 'Mưa rào nhẹ',       en: 'Slight rain showers', emoji: '🌦️' },
  81: { vi: 'Mưa rào vừa',       en: 'Moderate rain showers', emoji: '🌦️' },
  82: { vi: 'Mưa rào to',        en: 'Violent rain showers', emoji: '⛈️' },
  95: { vi: 'Dông',              en: 'Thunderstorm', emoji: '⛈️' },
  99: { vi: 'Dông + mưa đá',     en: 'Thunderstorm with hail', emoji: '⛈️' },
}

export function getWeatherInfo(code: number, locale: string = 'vi') {
  let match = WMO_MAP[code]
  if (!match) {
    if (code <= 3)  match = WMO_MAP[code] ?? WMO_MAP[0]
    else if (code <= 49) match = WMO_MAP[45]
    else if (code <= 67) match = WMO_MAP[61]
    else if (code <= 77) match = WMO_MAP[71]
    else if (code <= 82) match = WMO_MAP[80]
    else match = WMO_MAP[95]
  }
  return { label: locale === 'en' ? match.en : match.vi, emoji: match.emoji }
}

// ── AQI Helpers ───────────────────────────────────────────────────────────────

export function getAqiInfo(aqi: number, locale: string = 'vi'): { label: string; color: string; emoji: string } {
  const isEn = locale === 'en'
  if (aqi <= 50)  return { label: isEn ? 'Good' : 'Tốt', color: '#10b981', emoji: '😊' }
  if (aqi <= 100) return { label: isEn ? 'Moderate' : 'Trung bình', color: '#f59e0b', emoji: '😐' }
  if (aqi <= 150) return { label: isEn ? 'Unhealthy (Sens)' : 'Không tốt', color: '#f97316', emoji: '😷' }
  if (aqi <= 200) return { label: isEn ? 'Unhealthy' : 'Xấu', color: '#ef4444', emoji: '🤧' }
  if (aqi <= 300) return { label: isEn ? 'Very Unhealthy' : 'Rất xấu', color: '#7c3aed', emoji: '☠️' }
  return { label: isEn ? 'Hazardous' : 'Nguy hiểm', color: '#7f1d1d', emoji: '☠️' }
}

// ── Traffic Estimate (time-based, Vietnam patterns) ───────────────────────────

export function getTrafficLevel(locale: string = 'vi'): TrafficLevel {
  const isEn  = locale === 'en'
  const now   = new Date()
  const hour  = now.getHours()
  const min   = now.getMinutes()
  const day   = now.getDay() // 0=Sun, 6=Sat
  const t     = hour + min / 60

  // Weekend → generally light
  if (day === 0 || day === 6) {
    if (t >= 10 && t < 12) return { level: 'medium', label: isEn ? 'Moderate' : 'Hơi đông', emoji: '🟡' }
    return { level: 'low', label: isEn ? 'Clear' : 'Thông thoáng', emoji: '🟢' }
  }

  // Weekday peak: morning rush 7–9, evening rush 17–19:30
  if ((t >= 7 && t < 9.5) || (t >= 17 && t < 19.5)) {
    return { level: 'high', label: isEn ? 'Heavy' : 'Đông đúc', emoji: '🔴' }
  }
  // Semi-peak: lunch 11:30–13, post-evening 19:30–20:30
  if ((t >= 11.5 && t < 13.5) || (t >= 9.5 && t < 11) || (t >= 19.5 && t < 20.5)) {
    return { level: 'medium', label: isEn ? 'Moderate' : 'Hơi đông', emoji: '🟡' }
  }
  return { level: 'low', label: isEn ? 'Clear' : 'Thông thoáng', emoji: '🟢' }
}

// ── UV Index Helpers ──────────────────────────────────────────────────────────

export function getUvInfo(uv: number, locale: string = 'vi'): { label: string; color: string } {
  const isEn = locale === 'en'
  if (uv <= 2)  return { label: isEn ? 'Low' : 'Thấp', color: '#10b981' }
  if (uv <= 5)  return { label: isEn ? 'Moderate' : 'Trung bình', color: '#f59e0b' }
  if (uv <= 7)  return { label: isEn ? 'High' : 'Cao', color: '#f97316' }
  if (uv <= 10) return { label: isEn ? 'Very High' : 'Rất cao', color: '#ef4444' }
  return { label: isEn ? 'Extreme' : 'Cực cao', color: '#7c3aed' }
}

// ── Greeting ──────────────────────────────────────────────────────────────────

export function getGreeting(name?: string, locale: string = 'vi'): string {
  const isEn = locale === 'en'
  const h = new Date().getHours()
  const who = name ? (isEn ? ` ${name.split(' ').pop()}` : `, ${name.split(' ').pop()}`) : ''
  
  if (h >= 5  && h < 12) return isEn ? `Good morning${who} ☀️` : `Chào buổi sáng${who} ☀️`
  if (h >= 12 && h < 14) return isEn ? `Good noon${who} 🌤️` : `Chào buổi trưa${who} 🌤️`
  if (h >= 14 && h < 18) return isEn ? `Good afternoon${who} ⛅` : `Chào buổi chiều${who} ⛅`
  if (h >= 18 && h < 22) return isEn ? `Good evening${who} 🌆` : `Chào buổi tối${who} 🌆`
  return isEn ? `Up late${who}? 🌙` : `Còn thức muộn thế${who}? 🌙`
}

// ── Main Composable ───────────────────────────────────────────────────────────

export function useWeather() {
  const weather    = ref<WeatherData | null>(null)
  const airQuality = ref<AirQualityData | null>(null)
  const loading    = ref(false)
  const error      = ref('')

  // ── Location detection ────────────────────────────────────────────────────

  const GEO_DENIED_KEY = 'finnote_geo_denied'

  async function detectLocation(): Promise<{ lat: number; lon: number; city: string; country: string }> {
    // 1. Browser Geolocation (most accurate)
    // Skip entirely if user previously denied — respects their choice.
    // Only a fresh install (cleared localStorage) will re-trigger the prompt.
    const wasDenied = localStorage.getItem(GEO_DENIED_KEY)
    
    if (!wasDenied && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        // Prevent [Violation] Permissions policy violation in console
        if (typeof document !== 'undefined') {
          const policy = (document as any).permissionsPolicy || (document as any).featurePolicy;
          if (policy && typeof policy.allowsFeature === 'function') {
            if (!policy.allowsFeature('geolocation')) {
              throw new Error('Geolocation blocked by permissions policy');
            }
          }
        }

        // Also check permissions directly to prevent prompting if denied
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const perm = await navigator.permissions.query({ name: 'geolocation' })
            if (perm.state === 'denied') {
              // Remember denial permanently until app reinstall
              localStorage.setItem(GEO_DENIED_KEY, '1')
              throw new Error('Geolocation denied')
            }
          } catch (permErr: any) {
            if (permErr?.message === 'Geolocation denied') throw permErr
            // ignore other permission query errors
          }
        }

        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 6000,
            maximumAge: 10 * 60 * 1000 // 10 min cache
          })
        })
        const { latitude: lat, longitude: lon } = pos.coords

        // Reverse geocode via Nominatim (free, no key)
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi`,
            { headers: { 'Accept-Language': 'vi' } }
          )
          const data = await res.json() as any
          const addr = data.address || {}
          let city =
            addr.city || addr.town || addr.village || addr.county ||
            addr.state_district || addr.state || 'Vị trí của bạn'
          if (city.includes('Ho Chi Minh') || city === 'Thành phố Hồ Chí Minh' || city === 'TP.HCM' || city.includes('TP. HCM') || city === 'Hồ Chí Minh') city = 'Ho Chi Minh City'
          return { lat, lon, city, country: addr.country || '' }
        } catch {
          return { lat, lon, city: 'Vị trí của bạn', country: '' }
        }
      } catch (geoErr: any) {
        // User denied or timeout → remember if it was a denial
        if (geoErr?.code === 1 || geoErr?.message?.includes('denied')) {
          localStorage.setItem(GEO_DENIED_KEY, '1')
        }
        // Fall through to IP fallback
      }
    }

    // 2. IP-based fallback (using our own proxy to avoid adblockers)
    try {
      const data = await httpClient.get<any>('/api/proxy/location', { silent: true })
      if (data && data.lat) {
        return {
          lat: data.lat,
          lon: data.lon,
          city: data.city,
          country: data.country || ''
        }
      }
    } catch { /* ignore */ }

    // 3. Default to Ho Chi Minh City
    return { lat: 10.8231, lon: 106.6297, city: 'Ho Chi Minh City', country: 'Việt Nam' }
  }

  // ── Fetch weather + AQI ───────────────────────────────────────────────────

  async function fetchWeather() {
    loading.value = true
    error.value   = ''

    try {
      const loc = await detectLocation()

      const proxyData = await httpClient.get<any>(`/api/proxy/weather?lat=${loc.lat}&lon=${loc.lon}`, { silent: true })

      const wData = proxyData.weather
      const aqiData = proxyData.aqi

      if (wData && wData.current) {
        const cur = wData.current
        weather.value = {
          temperature: Math.round(cur.temperature_2m),
          feelsLike:   Math.round(cur.apparent_temperature),
          humidity:    Math.round(cur.relative_humidity_2m),
          windSpeed:   Math.round(cur.wind_speed_10m),
          weatherCode: cur.weather_code,
          uvIndex:     Math.round(cur.uv_index ?? 0),
          city:        loc.city,
          country:     loc.country,
          lat:         loc.lat,
          lon:         loc.lon,
        }
      } else {
        throw new Error('No weather data received')
      }

      if (aqiData && aqiData.current) {
        const cur = aqiData.current
        airQuality.value = {
          aqi:  Math.round(cur.us_aqi ?? 0),
          pm25: Math.round(cur.pm2_5  ?? 0),
        }
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Không thể tải dữ liệu thời tiết'
    } finally {
      loading.value = false
    }
  }

  // ── Visibility-based refresh ─────────────────────────────────────────────
  // Fetch on mount (once), then again whenever the tab becomes visible.
  
  function _onVisibilityChange() {
    if (document.visibilityState !== 'visible') return
    fetchWeather()
  }

  onMounted(() => fetchWeather())

  // ✅ useEventListener — auto-cleanup on unmount, no manual removeEventListener
  useEventListener(document, 'visibilitychange', _onVisibilityChange)

  return { weather, airQuality, loading, error, fetchWeather }
}
