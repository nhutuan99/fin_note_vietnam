<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, LineChart, TrendingUp, TrendingDown, Bell, BellRing, RotateCcw, X, Landmark, Pencil } from 'lucide-vue-next'
import { useStockStore } from '@/stores/stock'
import { useFundStore } from '@/stores/fund'
import { useUiStore } from '@/stores/ui'
import { formatVNDShort } from '@/constants/finance'
import type { StockPosition, StockAlert, FundPosition } from '@/types'
import stocksList from '@/constants/stocks.json'
import fundsList from '@/constants/funds.json'
import LogoLoader from '@/components/ui/LogoLoader.vue'

// Chart.js
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const { t } = useI18n()
const stockStore = useStockStore()
const fundStore = useFundStore()
const ui = useUiStore()

// ── Tab State ──
const activeTab = ref<'stocks' | 'funds'>('stocks')

const getLogoUrls = (symbol: string) => [
  `${import.meta.env.VITE_API_BASE_URL}/api/proxy/logo?symbol=${symbol.toUpperCase()}`,
  `https://ui-avatars.com/api/?name=${symbol}&background=1e293b&color=cbd5e1&bold=true&font-size=0.4`
]

function handleImageError(e: Event, symbol: string) {
  const img = e.target as HTMLImageElement
  const urls = getLogoUrls(symbol)
  let currentIndex = parseInt(img.dataset.fallbackIndex || '0')
  
  if (currentIndex < urls.length - 1) {
    currentIndex++
    img.dataset.fallbackIndex = currentIndex.toString()
    img.src = urls[currentIndex]
  } else {
    img.style.display = 'none'
  }
}

const showAddModal = ref(false)
const isEditingStock = ref(false)
const editingStockId = ref<string | null>(null)

const newPosition = ref({ symbol: '', buyPrice: '', quantity: '', targetProfit: '', stopLoss: '' })
const addModalRef = ref<HTMLElement | null>(null)
const alertModalRef = ref<HTMLElement | null>(null)

// Alert modal state (declared here so watch() can reference it)
const showAlertModal = ref(false)
const alertTargetStock = ref<StockPosition | null>(null)
const alertForm = ref({ targetPriceBelow: '', targetPriceAbove: '', direction: 'below' as 'above' | 'below', label: '' })

// Lock body scroll & focus modal into viewport when any modal opens
function lockScroll() {
  document.body.style.overflow = 'hidden'
  document.body.style.position = 'fixed'
  document.body.style.width = '100%'
  document.body.style.top = `-${window.scrollY}px`
}
function unlockScroll() {
  const scrollY = document.body.style.top
  document.body.style.overflow = ''
  document.body.style.position = ''
  document.body.style.width = ''
  document.body.style.top = ''
  window.scrollTo(0, parseInt(scrollY || '0') * -1)
}

watch(showAddModal, (open) => {
  if (open) {
    lockScroll()
    nextTick(() => addModalRef.value?.scrollIntoView({ block: 'center', behavior: 'instant' }))
  } else {
    unlockScroll()
  }
})
watch(showAlertModal, (open) => {
  if (open) {
    lockScroll()
    nextTick(() => alertModalRef.value?.scrollIntoView({ block: 'center', behavior: 'instant' }))
  } else {
    unlockScroll()
  }
})
const isSymbolFocused = ref(false)

const searchResults = computed(() => {
  const query = newPosition.value.symbol.trim().toUpperCase()
  if (!query) return []
  return stocksList
    .filter(s => s.symbol.includes(query) || s.name.toUpperCase().includes(query))
    .slice(0, 5)
})



onMounted(() => {
  stockStore.fetchPositions(true)
  stockStore.startPolling()
  fundStore.fetchPositions(true)
})

onUnmounted(() => {
  stockStore.stopPolling()
})

const totalValue = computed(() => {
  return stockStore.positions.reduce((acc, pos) => {
    const currentPrice = stockStore.prices[pos.symbol] || pos.buyPrice
    return acc + (currentPrice * pos.quantity * 1000)
  }, 0)
})

const totalProfit = computed(() => {
  return stockStore.positions.reduce((acc, pos) => {
    const currentPrice = stockStore.prices[pos.symbol] || pos.buyPrice
    return acc + ((currentPrice - pos.buyPrice) * pos.quantity * 1000)
  }, 0)
})

// ── Fund Computed ──
const fundTotalValue = computed(() => {
  return fundStore.positions.reduce((acc, pos) => {
    const nav = fundStore.navs[pos.symbol] || pos.buyPrice
    return acc + (nav * pos.quantity)
  }, 0)
})

const fundTotalProfit = computed(() => {
  return fundStore.positions.reduce((acc, pos) => {
    const nav = fundStore.navs[pos.symbol] || pos.buyPrice
    return acc + ((nav - pos.buyPrice) * pos.quantity)
  }, 0)
})

// ── Fund Add Modal ──
const showFundAddModal = ref(false)
const isEditingFund = ref(false)
const editingFundId = ref<string | null>(null)

const newFund = ref({ symbol: '', buyPrice: '', quantity: '', fundName: '', productId: 0 })
const isFundSymbolFocused = ref(false)
const fundAddModalRef = ref<HTMLElement | null>(null)

watch(showFundAddModal, (open) => {
  if (open) {
    lockScroll()
    nextTick(() => fundAddModalRef.value?.scrollIntoView({ block: 'center', behavior: 'instant' }))
  } else {
    unlockScroll()
  }
})

const fundSearchResults = computed(() => {
  const query = newFund.value.symbol.trim().toUpperCase()
  if (!query) return []
  return fundsList
    .filter(f => f.symbol.includes(query) || f.name.toUpperCase().includes(query))
    .slice(0, 6)
})

function handleFundSymbolBlur() {
  setTimeout(() => isFundSymbolFocused.value = false, 200)
}

function selectFund(fund: typeof fundsList[0]) {
  newFund.value.symbol = fund.symbol
  newFund.value.fundName = fund.name
  newFund.value.productId = fund.productId
  isFundSymbolFocused.value = false
}

async function handleFundAdd() {
  if (!newFund.value.symbol || !newFund.value.buyPrice || !newFund.value.quantity) {
    ui.showToast('error', t('common.fillRequiredFields'))
    return
  }
  
  const data = {
    symbol: newFund.value.symbol.toUpperCase(),
    buyPrice: Number(newFund.value.buyPrice),
    quantity: Number(newFund.value.quantity),
    fundName: newFund.value.fundName || undefined,
    productId: newFund.value.productId || undefined,
  }

  if (isEditingFund.value && editingFundId.value) {
    await fundStore.updatePosition(editingFundId.value, data)
    ui.showToast('success', t('funds.fundUpdated', { symbol: data.symbol }))
  } else {
    await fundStore.addPosition(data)
    ui.showToast('success', t('funds.fundAdded', { symbol: data.symbol }))
  }
  
  showFundAddModal.value = false
  isEditingFund.value = false
  editingFundId.value = null
  newFund.value = { symbol: '', buyPrice: '', quantity: '', fundName: '', productId: 0 }
}

function editFundPos(pos: FundPosition) {
  isEditingFund.value = true
  editingFundId.value = pos.id
  newFund.value = {
    symbol: pos.symbol,
    buyPrice: pos.buyPrice.toString(),
    quantity: pos.quantity.toString(),
    fundName: pos.fundName || '',
    productId: pos.productId || 0
  }
  showFundAddModal.value = true
}

async function removeFund(id: string, symbol: string) {
  const isConfirmed = await ui.requestConfirm({
    title: t('funds.deleteFundTitle'),
    message: t('funds.deleteFundMessage', { symbol }),
    confirmText: t('funds.deleteFundConfirm'),
    cancelText: t('common.cancel'),
    danger: true
  })
  if (!isConfirmed) return
  try {
    await fundStore.deletePosition(id)
    ui.showToast('success', t('funds.fundDeleted', { symbol }))
  } catch (e) {}
}

function getFundChartData(symbol: string) {
  const history = fundStore.histories[symbol]
  if (!history || history.length === 0) return { labels: [], datasets: [] }
  const navs = history.map(h => h.nav)
  const isUp = navs[navs.length - 1] >= navs[0]
  const color = isUp ? '#34d399' : '#fb7185'
  return {
    labels: history.map(h => new Date(h.time).toLocaleDateString()),
    datasets: [{
      data: navs,
      borderColor: color,
      backgroundColor: (ctx: any) => {
        const chart = ctx.chart
        const { ctx: c, chartArea } = chart
        if (!chartArea) return color + '1a'
        const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradient.addColorStop(0, color + '33')
        gradient.addColorStop(1, color + '00')
        return gradient
      },
      borderWidth: 2.5, pointRadius: 1, hitRadius: 20,
      tension: 0.35, fill: true
    }]
  }
}

async function handleAdd() {
  if (!newPosition.value.symbol || !newPosition.value.buyPrice || !newPosition.value.quantity) {
    ui.showToast('error', t('common.fillRequiredFields'))
    return
  }
  
  const data = {
    symbol: newPosition.value.symbol.toUpperCase(),
    buyPrice: Number(newPosition.value.buyPrice),
    quantity: Number(newPosition.value.quantity),
    targetProfit: newPosition.value.targetProfit ? Number(newPosition.value.targetProfit) : undefined,
    stopLoss: newPosition.value.stopLoss ? Number(newPosition.value.stopLoss) : undefined
  }

  if (isEditingStock.value && editingStockId.value) {
    await stockStore.updatePosition(editingStockId.value, data)
    ui.showToast('success', t('stocks.updated', { symbol: data.symbol }))
  } else {
    await stockStore.addPosition(data)
    ui.showToast('success', t('stocks.added', { symbol: data.symbol }))
  }
  
  showAddModal.value = false
  isEditingStock.value = false
  editingStockId.value = null
  newPosition.value = { symbol: '', buyPrice: '', quantity: '', targetProfit: '', stopLoss: '' }
}

function editStockPos(pos: StockPosition) {
  isEditingStock.value = true
  editingStockId.value = pos.id
  newPosition.value = {
    symbol: pos.symbol,
    buyPrice: pos.buyPrice.toString(),
    quantity: pos.quantity.toString(),
    targetProfit: pos.targetProfit?.toString() || '',
    stopLoss: pos.stopLoss?.toString() || ''
  }
  showAddModal.value = true
}

async function removePos(id: string, symbol: string) {
  const isConfirmed = await ui.requestConfirm({
    title: t('stocks.deleteStockTitle'),
    message: t('common.confirmDelete'),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
    danger: true
  })
  
  if (!isConfirmed) return

  const isValidPin = await ui.requestPinValidation(
    t('stocks.pinTitle'), 
    t('stocks.pinMessage', { symbol })
  )
  if (!isValidPin) return

  try {
    await stockStore.deletePosition(id)
    ui.showToast('success', t('stocks.deleted', { symbol }))
  } catch (e) {
    // API client handles error toasts
  }
}

function handleSymbolBlur() {
  setTimeout(() => isSymbolFocused.value = false, 200)
}

// ── Company Info Tooltip ──
function getCompanyName(symbol: string) {
  const stock = stocksList.find(s => s.symbol === symbol)
  return stock ? stock.name : ''
}

const activeTooltip = ref<string | null>(null)
const tooltipInfo = ref<any>(null)

async function fetchCompanyInfo(symbol: string) {
  activeTooltip.value = symbol
  tooltipInfo.value = null
  try {
    const res = await fetch(`https://api-finfo.vndirect.com.vn/v4/stocks?q=code:${symbol}`)
    const data = await res.json()
    if (data && data.data && data.data[0]) {
      tooltipInfo.value = data.data[0]
    }
  } catch (e) {}
}

function clearTooltip() {
  activeTooltip.value = null
}

// ── Alert Functions ──
function openAlertModal(pos: StockPosition) {
  alertTargetStock.value = pos
  alertForm.value = { targetPriceBelow: '', targetPriceAbove: '', direction: 'below', label: '' }
  showAlertModal.value = true
}

async function handleAddAlert() {
  const price = alertForm.value.direction === 'below' ? alertForm.value.targetPriceBelow : alertForm.value.targetPriceAbove
  if (!alertTargetStock.value || !price) {
    ui.showToast('error', t('common.fillRequiredFields'))
    return
  }
  try {
    await stockStore.addAlert(alertTargetStock.value.id, {
      targetPrice: Number(price),
      direction: alertForm.value.direction,
      label: alertForm.value.label || undefined
    })
    showAlertModal.value = false
    ui.showToast('success', t('stockAlert.added'))
  } catch (e) {
    // httpClient handles toast
  }
}

async function handleDeleteAlert(stockId: string, alertId: string) {
  try {
    await stockStore.deleteAlert(stockId, alertId)
  } catch (e) {}
}

async function handleResetAlert(stockId: string, alertId: string) {
  try {
    await stockStore.resetAlert(stockId, alertId)
    ui.showToast('success', t('stockAlert.resetDone'))
  } catch (e) {}
}

// ── Price bar helpers ──
function getPriceRange(pos: StockPosition) {
  const alerts = pos.alerts || []
  const currentPrice = stockStore.prices[pos.symbol] || pos.buyPrice
  const allPrices = [pos.buyPrice, currentPrice, ...alerts.map(a => a.targetPrice)]
  const min = Math.min(...allPrices) * 0.95
  const max = Math.max(...allPrices) * 1.05
  return { min, max, range: max - min }
}

function priceToPercent(price: number, min: number, range: number) {
  if (range === 0) return 50
  return Math.max(0, Math.min(100, ((price - min) / range) * 100))
}

const externalTooltipHandler = (context: any) => {
  const { chart, tooltip } = context
  let tooltipEl = document.getElementById('chartjs-tooltip')

  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.id = 'chartjs-tooltip'
    tooltipEl.style.background = 'rgba(15, 23, 42, 0.95)'
    tooltipEl.style.borderRadius = '8px'
    tooltipEl.style.color = 'white'
    tooltipEl.style.opacity = '1'
    tooltipEl.style.pointerEvents = 'none'
    tooltipEl.style.position = 'absolute'
    tooltipEl.style.transform = 'translate(-50%, 0)'
    tooltipEl.style.transition = 'all .1s ease'
    tooltipEl.style.zIndex = '9999' // Highest z-index
    tooltipEl.style.border = '1px solid rgba(124, 111, 247, 0.2)'
    tooltipEl.style.padding = '12px'
    tooltipEl.style.fontSize = '12px'
    tooltipEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
    document.body.appendChild(tooltipEl)
  }

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = '0'
    return
  }

  if (tooltip.body) {
    const dataIndex = tooltip.dataPoints[0].dataIndex
    const dataset = tooltip.dataPoints[0].dataset
    const pt = dataset.customData?.[dataIndex]
    
    let innerHtml = ''
    
    if (!pt || pt.open === undefined) {
      innerHtml = `<div style="font-weight: 600; margin-bottom: 4px; color: #fff;">${tooltip.title[0]}</div>
                   <div style="color: #cbd5e1;">${t('stocks.tooltipClose')} <span style="color: #fff; font-weight: 500;">${pt ? pt.price : tooltip.dataPoints[0].raw}</span></div>`
    } else {
      innerHtml = `
        <div style="font-weight: 600; margin-bottom: 6px; color: #fff;">${tooltip.title[0]}</div>
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; color: #cbd5e1;">
          <div>${t('stocks.tooltipOpen')}</div><div style="text-align: right; color: #fff; font-weight: 500;">${pt.open}</div>
          <div>${t('stocks.tooltipHigh')}</div><div style="text-align: right; color: #34d399; font-weight: 500;">${pt.high}</div>
          <div>${t('stocks.tooltipLow')}</div><div style="text-align: right; color: #fb7185; font-weight: 500;">${pt.low}</div>
          <div>${t('stocks.tooltipClose')}</div><div style="text-align: right; color: #60a5fa; font-weight: 500;">${pt.price}</div>
          <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">${t('stocks.tooltipVolume')}</div>
          <div style="margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; text-align: right; color: #fff; font-weight: 500;">${pt.volume ? pt.volume.toLocaleString() : '0'}</div>
        </div>
      `
    }
    tooltipEl.innerHTML = innerHtml
  }

  const canvasRect = chart.canvas.getBoundingClientRect()
  tooltipEl.style.opacity = '1'

  // Calculate initial position
  let left = canvasRect.left + window.scrollX + tooltip.caretX
  let top = canvasRect.top + window.scrollY + tooltip.caretY - tooltipEl.offsetHeight - 10

  // Clamp top: if tooltip goes above viewport, flip below the caret
  if (top < window.scrollY + 10) {
    top = canvasRect.top + window.scrollY + tooltip.caretY + 10
  }

  // Clamp horizontal: keep tooltip fully inside viewport with 12px margin
  const margin = 12
  const tooltipWidth = tooltipEl.offsetWidth
  const viewportWidth = window.innerWidth

  // Remove default centering transform; we'll position manually
  tooltipEl.style.transform = 'none'

  // Left edge: tooltip's left side (accounting for centered position)
  const tooltipLeft = left - tooltipWidth / 2
  // Right edge
  const tooltipRight = left + tooltipWidth / 2

  if (tooltipLeft < margin) {
    // Tooltip would overflow left — pin to left margin
    left = margin
  } else if (tooltipRight > viewportWidth - margin) {
    // Tooltip would overflow right — pin to right margin
    left = viewportWidth - margin - tooltipWidth
  } else {
    // Normal centered positioning
    left = left - tooltipWidth / 2
  }

  tooltipEl.style.left = left + 'px'
  tooltipEl.style.top = top + 'px'
}

// ── Sparkline config ──
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 } as any,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: { 
    legend: { display: false }, 
    tooltip: { 
      enabled: false,
      external: externalTooltipHandler
    } 
  },
  scales: {
    x: { display: false },
    y: { display: false }
  }
}

function getChartData(symbol: string) {
  const history = stockStore.histories[symbol]
  if (!history || history.length === 0) return { labels: [], datasets: [] }
  
  const prices = history.map(h => h.price)
  const isUp = prices[prices.length - 1] >= prices[0]
  const color = isUp ? '#34d399' : '#fb7185'
  
  return {
    labels: history.map(h => new Date(h.time).toLocaleDateString()),
    datasets: [{
      data: prices,
      customData: history,
      borderColor: color,
      backgroundColor: (ctx: any) => {
        const chart = ctx.chart
        const { ctx: c, chartArea } = chart
        if (!chartArea) return color + '1a'
        const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradient.addColorStop(0, color + '33')
        gradient.addColorStop(1, color + '00')
        return gradient
      },
      borderWidth: 2.5,
      pointRadius: 1,
      hitRadius: 20,
      pointBackgroundColor: color,
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: color,
      pointHoverBorderWidth: 2,
      pointHoverRadius: 6,
      tension: 0.35,
      fill: true
    }]
  }
}
</script>

<template>
  <div class="space-y-6">

    <!-- ── Tab Switcher ── -->
    <div class="flex p-1 rounded-2xl bg-bg-surface border border-border-default">
      <button
        class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
        :class="activeTab === 'stocks' ? 'bg-accent text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'"
        @click="activeTab = 'stocks'"
      >
        <LineChart :size="16" />
        {{ t('stocks.tabStocks') }}
      </button>
      <button
        class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
        :class="activeTab === 'funds' ? 'bg-accent text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'"
        @click="activeTab = 'funds'"
      >
        <Landmark :size="16" />
        {{ t('stocks.tabFunds') }}
      </button>
    </div>

    <!-- ══════════ STOCKS TAB ══════════ -->
    <template v-if="activeTab === 'stocks'">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">{{ t('settings.stocks') }}</h1>
        <p class="text-text-tertiary text-sm mt-1">
          {{ t('nav.totalBalance') }}: <span class="text-accent font-semibold">{{ formatVNDShort(totalValue) }}</span>
          <span :class="totalProfit > 0 ? 'text-success' : (totalProfit < 0 ? 'text-error' : 'text-text-primary')" class="ml-2 font-medium">
            ({{ totalProfit > 0 ? '+' : '' }}{{ formatVNDShort(totalProfit) }})
          </span>
        </p>
      </div>
      <button @click="showAddModal = true" class="btn-primary">
        <Plus :size="18" /> {{ t('common.add') }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="stockStore.loading" class="text-center py-10">
      <LogoLoader :size="32" :showGlow="true" class="mx-auto" />
    </div>

    <!-- Empty State -->
    <div v-else-if="stockStore.positions.length === 0" class="card-premium p-8 text-center flex flex-col items-center">
      <div class="h-12 w-12 rounded-full bg-accent-subtle flex items-center justify-center text-accent mb-3">
        <LineChart :size="24" />
      </div>
      <p class="text-text-secondary font-medium">{{ t('common.noData') }}</p>
    </div>

    <!-- Portfolio Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="pos in stockStore.positions" :key="pos.id" class="card-premium p-5 flex flex-col relative group">
        <!-- Action buttons -->
        <div class="absolute top-4 right-4 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
          <button @click="editStockPos(pos)" class="p-1.5 text-text-disabled hover:text-accent active:text-accent hover:bg-accent/10 active:bg-accent/10 rounded-lg transition-colors" :title="t('common.edit')">
            <Pencil :size="16" />
          </button>
          <button @click="removePos(pos.id, pos.symbol)" class="p-1.5 text-text-disabled hover:text-error active:text-error hover:bg-error/10 active:bg-error/10 rounded-lg transition-colors" :title="t('common.delete')">
            <Trash2 :size="16" />
          </button>
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between mb-4 pr-20 gap-2">
          <div class="flex items-center gap-3 relative min-w-0 flex-1">
            <div class="h-10 w-14 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-bold text-xs relative overflow-hidden border border-accent/20 p-1.5 bg-white dark:bg-bg-elevated flex-shrink-0">
              <span class="absolute z-0 text-accent opacity-50">{{ pos.symbol }}</span>
              <img :src="getLogoUrls(pos.symbol)[0]" :alt="pos.symbol" referrerpolicy="no-referrer" :data-fallback-index="0" class="w-full h-full object-contain relative z-10" @error="(e) => handleImageError(e, pos.symbol)" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-lg cursor-help inline-block leading-tight" @mouseenter="fetchCompanyInfo(pos.symbol)" @mouseleave="clearTooltip">{{ pos.symbol }}</p>
              <p class="text-xs text-text-tertiary line-clamp-2 leading-tight mt-0.5" :title="getCompanyName(pos.symbol)">{{ getCompanyName(pos.symbol) }}</p>
              <p class="text-[10px] text-text-disabled mt-0.5">{{ pos.quantity }} {{ t('common.shares') }}</p>
            </div>
            
            <!-- Company Info API Tooltip -->
            <transition name="fade">
              <div v-if="activeTooltip === pos.symbol" class="absolute top-full left-0 mt-2 p-3 w-64 bg-bg-elevated border border-border-default rounded-xl shadow-2xl z-50 text-xs pointer-events-none">
                <div v-if="!tooltipInfo" class="flex items-center gap-2 text-text-tertiary">
                  <AppSpinner :size="14"  />
                  {{ t('stocks.loadingInfo') }}
                </div>
                <div v-else class="space-y-1.5">
                  <div class="font-bold text-sm text-accent mb-2 leading-tight">{{ tooltipInfo.companyName }}</div>
                  <div class="flex justify-between"><span class="text-text-tertiary">{{ t('stocks.listedCode') }}</span> <span class="font-medium">{{ tooltipInfo.code }}</span></div>
                  <div class="flex justify-between"><span class="text-text-tertiary">{{ t('stocks.exchange') }}</span> <span class="font-medium">{{ tooltipInfo.floor }}</span></div>
                  <div class="flex justify-between"><span class="text-text-tertiary">{{ t('stocks.listedDate') }}</span> <span class="font-medium">{{ tooltipInfo.listedDate }}</span></div>
                  <div class="flex justify-between gap-2"><span class="text-text-tertiary shrink-0">{{ t('stocks.intlName') }}</span> <span class="font-medium truncate text-right min-w-0" :title="tooltipInfo.companyNameEng">{{ tooltipInfo.companyNameEng || '---' }}</span></div>
                </div>
              </div>
            </transition>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-xs text-text-tertiary">{{ t('common.currentPrice') }}</p>
            <p class="font-semibold text-lg">{{ stockStore.prices[pos.symbol] || '---' }}</p>
          </div>
        </div>

        <!-- Stats Row -->
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="bg-bg-surface p-3 rounded-xl border border-border-default">
            <p class="text-xs text-text-disabled">{{ t('common.buyPrice') }}</p>
            <p class="font-medium text-sm mt-0.5">{{ pos.buyPrice }}</p>
          </div>
          <div class="bg-bg-surface p-3 rounded-xl border border-border-default text-right">
            <p class="text-xs text-text-disabled">{{ t('common.profit') }}</p>
            <template v-if="stockStore.prices[pos.symbol]">
              <p :class="(stockStore.prices[pos.symbol] - pos.buyPrice) > 0 ? 'text-success' : ((stockStore.prices[pos.symbol] - pos.buyPrice) < 0 ? 'text-error' : 'text-text-primary')" class="font-medium text-sm mt-0.5 flex items-center justify-end gap-1">
                <TrendingUp v-if="(stockStore.prices[pos.symbol] - pos.buyPrice) > 0" :size="14" />
                <TrendingDown v-else-if="(stockStore.prices[pos.symbol] - pos.buyPrice) < 0" :size="14" />
                <span v-else class="w-[14px] inline-block"></span>
                {{ (stockStore.prices[pos.symbol] - pos.buyPrice) > 0 ? '+' : '' }}{{ formatVNDShort((stockStore.prices[pos.symbol] - pos.buyPrice) * pos.quantity * 1000) }}
              </p>
            </template>
            <p v-else class="font-medium text-sm mt-0.5">---</p>
          </div>
        </div>

        <!-- 7-Day Chart -->
        <div v-if="stockStore.histories[pos.symbol] && stockStore.histories[pos.symbol].length > 0" class="h-16 mb-4 -mx-2">
          <Line :data="getChartData(pos.symbol)" :options="chartOptions" />
        </div>

        <!-- Price Bar — Visual Price Markers -->
        <div v-if="pos.alerts && pos.alerts.length > 0 && stockStore.prices[pos.symbol]" class="mb-4">
          <div class="relative h-6 bg-bg-surface rounded-full border border-border-default overflow-visible">
            <!-- Buy price marker -->
            <div 
              class="absolute top-0 h-full w-0.5 bg-accent/50"
              :style="{ left: priceToPercent(pos.buyPrice, getPriceRange(pos).min, getPriceRange(pos).range) + '%' }"
              :title="t('stocks.buyPriceLabel') + ' ' + pos.buyPrice"
            ></div>
            <!-- Current price marker -->
            <div 
              class="absolute top-[-2px] h-[calc(100%+4px)] w-1.5 bg-accent rounded-full shadow-sm shadow-accent/40 z-10"
              :style="{ left: 'calc(' + priceToPercent(stockStore.prices[pos.symbol], getPriceRange(pos).min, getPriceRange(pos).range) + '% - 3px)' }"
              :title="t('stocks.currentPriceLabel') + ' ' + stockStore.prices[pos.symbol]"
            ></div>
            <!-- Alert markers -->
            <div 
              v-for="alert in pos.alerts" :key="alert.id"
              class="absolute top-0 h-full w-0.5 z-5"
              :class="alert.triggered ? 'bg-text-disabled' : (alert.direction === 'below' ? 'bg-success' : 'bg-error')"
              :style="{ left: priceToPercent(alert.targetPrice, getPriceRange(pos).min, getPriceRange(pos).range) + '%' }"
              :title="alert.label + ': ' + alert.targetPrice"
            >
              <!-- Dot -->
              <div 
                class="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full"
                :class="alert.triggered ? 'bg-text-disabled' : (alert.direction === 'below' ? 'bg-success' : 'bg-error')"
              ></div>
            </div>
          </div>
          <div class="flex justify-between text-[9px] text-text-disabled mt-0.5 px-0.5">
            <span>{{ getPriceRange(pos).min.toFixed(1) }}</span>
            <span>{{ getPriceRange(pos).max.toFixed(1) }}</span>
          </div>
        </div>

        <!-- Alert Badges -->
        <div v-if="pos.alerts && pos.alerts.length > 0" class="flex flex-wrap gap-1.5 mb-3">
          <div 
            v-for="alert in pos.alerts" :key="alert.id"
            class="group/alert flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-medium transition-all"
            :class="alert.triggered 
              ? 'bg-bg-elevated text-text-disabled line-through' 
              : (alert.direction === 'below' ? 'bg-success/10 text-success' : 'bg-error/10 text-error')"
          >
            <BellRing v-if="alert.triggered" :size="10" />
            <Bell v-else :size="10" />
            <span>{{ alert.direction === 'below' ? '📉' : '📈' }} {{ alert.targetPrice }}</span>
            <!-- Alert actions -->
            <button 
              v-if="alert.triggered"
              @click.stop="handleResetAlert(pos.id, alert.id)" 
              class="ml-0.5 p-0.5 rounded hover:bg-bg-hover active:bg-bg-hover transition-colors"
              :title="t('stockAlert.reset')"
            >
              <RotateCcw :size="9" />
            </button>
            <button 
              @click.stop="handleDeleteAlert(pos.id, alert.id)" 
              class="ml-0.5 p-0.5 rounded hover:bg-error/20 active:bg-error/20 hover:text-error active:text-error transition-colors opacity-100 md:opacity-0 md:group-hover/alert:opacity-100"
              :title="t('stockAlert.delete')"
            >
              <X :size="9" />
            </button>
          </div>
        </div>

        <!-- Bottom Action Bar -->
        <div class="mt-auto pt-4 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <!-- Badges -->
          <div class="flex gap-2 flex-wrap">
            <span v-if="pos.targetProfit" class="text-[10px] px-2 py-1 rounded-md bg-success/10 text-success font-medium">{{ t('stockAlert.takeProfit') }}: {{ pos.targetProfit }}%</span>
            <span v-if="pos.stopLoss" class="text-[10px] px-2 py-1 rounded-md bg-error/10 text-error font-medium">{{ t('stockAlert.stopLoss') }}: {{ pos.stopLoss }}%</span>
          </div>

          <!-- Premium Add Alert Button -->
          <button 
            @click="openAlertModal(pos)" 
            class="ml-auto flex-shrink-0 flex items-center justify-center gap-1.5 text-xs font-medium text-text-primary bg-bg-surface hover:bg-bg-hover active:bg-bg-hover border border-border-default hover:border-border-hover active:border-border-hover rounded-lg py-1.5 px-3 transition-all duration-200"
          >
            <BellRing :size="14" class="text-accent" /> 
            <span>{{ t('stockAlert.addAlert') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ══════ Add Position Modal ══════ -->
    <transition name="fade">
      <div v-if="showAddModal" class="stock-modal-overlay" @click.self="showAddModal = false">
        <div ref="addModalRef" class="stock-modal-panel card-premium" @click.stop>
          <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent-hover rounded-t-2xl"></div>
          <h3 class="mb-5 text-lg font-bold">{{ isEditingStock ? t('common.update') : t('common.add') }} {{ t('settings.stocks') }}</h3>
          
          <div class="space-y-4">
            <div class="relative">
              <label class="mb-1.5 block text-sm font-medium text-text-secondary">{{ t('common.symbol') }}</label>
              <input 
                v-model="newPosition.symbol" 
                type="text" 
                class="uppercase border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all duration-150 focus:ring-2 focus:outline-none" 
                placeholder="FPT" 
                :disabled="isEditingStock"
                @focus="!isEditingStock && (isSymbolFocused = true)"
                @blur="handleSymbolBlur"
              />
              <!-- Autocomplete dropdown -->
              <div v-if="isSymbolFocused && !isEditingStock && searchResults.length > 0" class="absolute z-10 mt-1 w-full max-h-[240px] overflow-y-auto custom-scrollbar bg-bg-elevated border border-border-default rounded-xl shadow-lg">
                <div 
                  v-for="stock in searchResults" 
                  :key="stock.symbol"
                  @click="newPosition.symbol = stock.symbol; isSymbolFocused = false"
                  class="flex items-center gap-3 p-3 hover:bg-bg-hover active:bg-bg-hover cursor-pointer transition-colors"
                >
                  <div class="h-8 w-12 rounded-md bg-bg-surface flex items-center justify-center text-text-secondary font-bold text-[10px] relative overflow-hidden border border-border-subtle p-1 bg-white dark:bg-bg-elevated flex-shrink-0">
                    <span class="absolute z-0 opacity-30">{{ stock.symbol }}</span>
                    <img :src="getLogoUrls(stock.symbol)[0]" referrerpolicy="no-referrer" :data-fallback-index="0" @error="handleImageError($event, stock.symbol)" class="w-full h-full object-contain relative z-10" />
                  </div>
                  <div class="overflow-hidden">
                    <div class="font-bold text-sm text-text-primary">{{ stock.symbol }}</div>
                    <div class="text-xs text-text-tertiary truncate">{{ stock.name }}</div>
                  </div>
                  <div class="ml-auto flex-shrink-0 text-[10px] bg-bg-surface px-1.5 py-0.5 rounded text-text-tertiary border border-border-subtle">{{ stock.exchange }}</div>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-text-secondary">{{ t('common.quantity') }}</label>
                <input v-model="newPosition.quantity" type="number" class="border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all duration-150 focus:ring-2 focus:outline-none" />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-text-secondary">{{ t('common.buyPrice') }} (x1000)</label>
                <input v-model="newPosition.buyPrice" type="number" step="0.1" class="border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all duration-150 focus:ring-2 focus:outline-none" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-text-secondary">{{ t('common.target') }} (%)</label>
                <input v-model="newPosition.targetProfit" type="number" class="border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all duration-150 focus:ring-2 focus:outline-none" />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-text-secondary">{{ t('common.stopLoss') }} (%)</label>
                <input v-model="newPosition.stopLoss" type="number" class="border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all duration-150 focus:ring-2 focus:outline-none" />
              </div>
            </div>
          </div>

          <div class="mt-8 flex justify-end gap-3">
            <button @click="showAddModal = false; isEditingStock = false; newPosition = { symbol: '', buyPrice: '', quantity: '', targetProfit: '', stopLoss: '' }" class="btn-secondary w-full">{{ t('common.cancel') }}</button>
            <button @click="handleAdd" class="btn-primary w-full">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="showAlertModal" class="stock-modal-overlay" @click.self="showAlertModal = false">
        <div ref="alertModalRef" class="stock-modal-panel card-premium" @click.stop>
          <!-- Header gradient - Thicker for premium look -->
          <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-accent to-accent-hover"></div>
          
          <div class="p-6">
            <div class="flex items-center gap-3 mb-6">
              <div class="h-11 w-11 rounded-2xl bg-accent/10 flex items-center justify-center shadow-inner">
                <Bell :size="22" class="text-accent" />
              </div>
              <div>
                <h3 class="text-base font-bold tracking-tight">{{ t('stockAlert.addAlert') }}</h3>
                <p class="text-[11px] text-text-tertiary uppercase font-medium tracking-wider">
                  {{ alertTargetStock?.symbol }} <span class="mx-1 opacity-30">•</span> {{ t('common.currentPrice') }}: <span class="text-accent font-bold">{{ stockStore.prices[alertTargetStock?.symbol || ''] || '---' }}</span>
                </p>
              </div>
            </div>

            <div class="space-y-5">
              <!-- Direction Toggle - Refined CSS -->
              <div>
                <label class="mb-2 block text-[11px] font-bold text-text-tertiary uppercase tracking-widest">{{ t('stockAlert.direction') }}</label>
                <div class="flex p-1 rounded-2xl bg-bg-surface border border-border-default">
                  <button 
                    class="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                    :class="alertForm.direction === 'below' 
                      ? 'bg-success/20 text-success shadow-sm' 
                      : 'text-text-tertiary hover:bg-bg-hover'"
                    @click="alertForm.direction = 'below'"
                  >
                    📉 {{ t('stockAlert.buy') }}
                  </button>
                  <button 
                    class="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                    :class="alertForm.direction === 'above' 
                      ? 'bg-error/20 text-error shadow-sm' 
                      : 'text-text-tertiary hover:bg-bg-hover'"
                    @click="alertForm.direction = 'above'"
                  >
                    📈 {{ t('stockAlert.sell') }}
                  </button>
                </div>
              </div>

              <!-- Target Price -->
              <div>
                <label class="mb-1.5 block text-xs font-semibold text-text-secondary">{{ t('stockAlert.targetPrice') }}</label>
                <div class="relative">
                  <input 
                    v-if="alertForm.direction === 'below'"
                    v-model="alertForm.targetPriceBelow" 
                    type="number" 
                    step="0.1"
                    class="border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-3 text-sm font-bold transition-all focus:ring-2 focus:outline-none" 
                  />
                  <input 
                    v-else
                    v-model="alertForm.targetPriceAbove" 
                    type="number" 
                    step="0.1"
                    class="border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-3 text-sm font-bold transition-all focus:ring-2 focus:outline-none" 
                  />
                  <div class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-disabled uppercase">VND</div>
                </div>
              </div>

              <!-- Label -->
              <div>
                <label class="mb-1.5 block text-xs font-semibold text-text-secondary">{{ t('stockAlert.label') }} <span class="text-text-disabled font-normal">({{ t('stockAlert.optional') }})</span></label>
                <input 
                  v-model="alertForm.label" 
                  type="text"
                  class="border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-3 text-sm transition-all focus:ring-2 focus:outline-none" 
                  :placeholder="alertForm.direction === 'below' ? t('stockAlert.buyPlaceholder') : t('stockAlert.sellPlaceholder')" 
                />
              </div>
            </div>

            <!-- Footer - Standardized border-radius -->
            <div class="mt-8 flex gap-3">
              <button @click="showAlertModal = false" class="btn-secondary flex-1 !rounded-xl !py-3">{{ t('common.cancel') }}</button>
              <button @click="handleAddAlert" class="flex-[1.5] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-3 text-sm font-bold text-white shadow-lg shadow-accent/20 hover:shadow-accent/40 active:scale-[0.98] transition-all">
                <Bell :size="18" /> {{ t('stockAlert.addAlert') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
    </template>
    <!-- END STOCKS TAB -->

    <!-- ══════════ FUNDS TAB ══════════ -->
    <template v-if="activeTab === 'funds'">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold flex items-center gap-2">
            <Landmark :size="20" class="text-accent" /> {{ t('funds.title') }}
          </h1>
          <p class="text-text-tertiary text-sm mt-1">
            {{ t('funds.totalNav') }}: <span class="text-accent font-semibold">{{ formatVNDShort(fundTotalValue) }}</span>
            <span :class="fundTotalProfit > 0 ? 'text-success' : (fundTotalProfit < 0 ? 'text-error' : 'text-text-primary')" class="ml-2 font-medium">
              ({{ fundTotalProfit > 0 ? '+' : '' }}{{ formatVNDShort(fundTotalProfit) }})
            </span>
          </p>
        </div>
        <button @click="showFundAddModal = true; isEditingFund = false; newFund = { symbol: '', buyPrice: '', quantity: '', fundName: '', productId: 0 }" class="btn-primary">
          <Plus :size="18" /> {{ t('funds.addFund') }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="fundStore.loading" class="text-center py-10">
        <LogoLoader :size="32" :showGlow="true" class="mx-auto" />
      </div>

      <!-- Empty -->
      <div v-else-if="fundStore.positions.length === 0" class="card-premium p-8 text-center flex flex-col items-center">
        <div class="h-12 w-12 rounded-full bg-accent-subtle flex items-center justify-center text-accent mb-3">
          <Landmark :size="24" />
        </div>
        <p class="text-text-secondary font-medium">{{ t('funds.empty') }}</p>
        <p class="text-text-disabled text-xs mt-1">{{ t('funds.emptyHint') }}</p>
      </div>

      <!-- Fund Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="pos in fundStore.positions" :key="pos.id" class="card-premium p-5 flex flex-col relative group">
          <!-- Delete button -->
          <div class="absolute top-4 right-4 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
            <button @click="editFundPos(pos)" class="p-1.5 text-text-disabled hover:text-accent hover:bg-accent/10 rounded-lg transition-colors" :title="t('common.edit')">
              <Pencil :size="16" />
            </button>
            <button @click="removeFund(pos.id, pos.symbol)" class="p-1.5 text-text-disabled hover:text-error hover:bg-error/10 rounded-lg transition-colors" :title="t('common.delete')">
              <Trash2 :size="16" />
            </button>
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between mb-4 pr-20 gap-2">
            <div class="min-w-0 flex-1">
              <p class="font-bold text-lg text-accent leading-tight">{{ pos.symbol }}</p>
              <p class="text-xs text-text-tertiary line-clamp-2 leading-tight mt-0.5" :title="pos.fundName">{{ pos.fundName || '—' }}</p>
              <p class="text-[10px] text-text-disabled mt-0.5">{{ t('funds.unitCount', { count: pos.quantity.toLocaleString() }) }}</p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-xs text-text-tertiary">{{ t('funds.currentNav') }}</p>
              <p class="font-semibold text-lg">
                {{ fundStore.navs[pos.symbol] ? fundStore.navs[pos.symbol].toLocaleString('vi-VN') : '---' }}
              </p>
            </div>
          </div>

          <!-- Stats -->
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-bg-surface p-3 rounded-xl border border-border-default">
              <p class="text-xs text-text-disabled">{{ t('funds.buyPricePerUnit') }}</p>
              <p class="font-medium text-sm mt-0.5">{{ pos.buyPrice.toLocaleString('vi-VN') }}</p>
            </div>
            <div class="bg-bg-surface p-3 rounded-xl border border-border-default text-right">
              <p class="text-xs text-text-disabled">{{ t('funds.profit') }}</p>
              <template v-if="fundStore.navs[pos.symbol]">
                <p :class="(fundStore.navs[pos.symbol] - pos.buyPrice) > 0 ? 'text-success' : ((fundStore.navs[pos.symbol] - pos.buyPrice) < 0 ? 'text-error' : 'text-text-primary')"
                   class="font-medium text-sm mt-0.5 flex items-center justify-end gap-1">
                  <TrendingUp v-if="(fundStore.navs[pos.symbol] - pos.buyPrice) > 0" :size="14" />
                  <TrendingDown v-else-if="(fundStore.navs[pos.symbol] - pos.buyPrice) < 0" :size="14" />
                  {{ (((fundStore.navs[pos.symbol] - pos.buyPrice) / pos.buyPrice) * 100).toFixed(2) }}%
                </p>
              </template>
              <p v-else class="font-medium text-sm mt-0.5">---</p>
            </div>
          </div>

          <!-- Sparkline -->
          <div v-if="fundStore.histories[pos.symbol]?.length > 0" class="h-16 mb-4 -mx-2">
            <Line :data="getFundChartData(pos.symbol)" :options="chartOptions" />
          </div>

          <!-- Total value -->
          <div class="mt-auto pt-3 border-t border-border-subtle flex items-center justify-between">
            <span class="text-xs text-text-disabled">{{ t('funds.portfolioValue') }}</span>
            <span class="font-bold text-sm text-accent">
              {{ formatVNDShort((fundStore.navs[pos.symbol] || pos.buyPrice) * pos.quantity) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Add Fund Modal -->
      <transition name="fade">
        <div v-if="showFundAddModal" class="stock-modal-overlay" @click.self="showFundAddModal = false">
          <div ref="fundAddModalRef" class="stock-modal-panel card-premium" @click.stop>
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent-hover rounded-t-2xl"></div>
            <h3 class="mb-5 text-lg font-bold flex items-center gap-2"><Landmark :size="18" class="text-accent" /> {{ isEditingFund ? t('common.update') : t('common.add') }} {{ t('finance.fundsLabel') }}</h3>

            <div class="space-y-4">
              <!-- Symbol search -->
              <div class="relative">
                <label class="mb-1.5 block text-sm font-medium text-text-secondary">{{ t('common.fundSymbol') }}</label>
                <input
                  v-model="newFund.symbol"
                  type="text"
                  class="uppercase border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none"
                  placeholder="SSISCA"
                  :disabled="isEditingFund"
                  @focus="!isEditingFund && (isFundSymbolFocused = true)"
                  @blur="handleFundSymbolBlur"
                />
                <!-- Autocomplete -->
                <div v-if="isFundSymbolFocused && !isEditingFund && fundSearchResults.length > 0" class="absolute z-10 mt-1 w-full max-h-[260px] overflow-y-auto custom-scrollbar bg-bg-elevated border border-border-default rounded-xl shadow-lg">
                  <div
                    v-for="fund in fundSearchResults"
                    :key="fund.symbol"
                    @click="selectFund(fund)"
                    class="flex items-center gap-3 p-3 hover:bg-bg-hover cursor-pointer transition-colors"
                  >
                    <div class="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Landmark :size="14" class="text-accent" />
                    </div>
                    <div class="overflow-hidden flex-1">
                      <div class="font-bold text-sm text-accent">{{ fund.symbol }}</div>
                      <div class="text-xs text-text-tertiary truncate">{{ fund.name }}</div>
                    </div>
                    <div class="text-[10px] px-1.5 py-0.5 rounded border border-border-subtle text-text-disabled shrink-0"
                         :class="fund.type === 'STOCK' ? 'text-success border-success/30' : (fund.type === 'BOND' ? 'text-blue-400 border-blue-400/30' : 'text-orange-400 border-orange-400/30')">
                      {{ fund.type === 'STOCK' ? t('funds.typeStock') : fund.type === 'BOND' ? t('funds.typeBond') : t('funds.typeBalance') }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Buy price + Quantity -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1.5 block text-sm font-medium text-text-secondary">{{ t('common.quantity') }} CCQ</label>
                  <input v-model="newFund.quantity" type="number" min="0" step="1"
                    class="border-border-default bg-bg-surface text-text-primary focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none" />
                </div>
                <div>
                  <label class="mb-1.5 block text-sm font-medium text-text-secondary">{{ t('common.buyPrice') }} / CCQ (VND)</label>
                  <input v-model="newFund.buyPrice" type="number" min="0" step="100"
                    class="border-border-default bg-bg-surface text-text-primary focus:border-accent focus:ring-accent-subtle w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none" />
                </div>
              </div>
            </div>

            <div class="mt-8 flex justify-end gap-3">
              <button @click="showFundAddModal = false; isEditingFund = false; newFund = { symbol: '', buyPrice: '', quantity: '', fundName: '', productId: 0 }" class="btn-secondary w-full">{{ t('common.cancel') }}</button>
              <button @click="handleFundAdd" class="btn-primary w-full">{{ t('common.save') }}</button>
            </div>
          </div>
        </div>
      </transition>
    </template>
    <!-- END FUNDS TAB -->

  </div>
</template>

<style scoped>
/* ── Stock Modal: always centered in visual viewport ── */
.stock-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 1rem;
  /* Allow overlay itself to scroll if modal is taller than viewport */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.stock-modal-panel {
  position: relative;
  width: 100%;
  max-width: 28rem; /* max-w-md */
  max-height: 90vh;
  max-height: 90dvh;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  /* Prevent iOS keyboard from pushing modal off-screen */
  margin: auto;
}

/* On small mobile screens, shrink padding and ensure safe-area */
@media (max-height: 600px) {
  .stock-modal-panel {
    max-height: 85vh;
    max-height: 85dvh;
    padding: 1rem;
  }
}

/* iOS PWA safe area at bottom */
@media (display-mode: standalone) {
  .stock-modal-overlay {
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 1rem);
  }
}
</style>
