<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useFinanceStore } from '@/stores/finance'
import { useNotesStore } from '@/stores/notes'
import { useDevice } from '@/composables/useDevice'
import { usePortfolioSummary } from '@/composables/usePortfolioSummary'
import { formatVNDShort } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'
import { useI18n } from 'vue-i18n'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  FileText,
  Settings,
  Plus,
  Target,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  LineChart,
  Bell,
  GripVertical,
  Coffee
} from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const ui = useUiStore()
const finance = useFinanceStore()
const notesStore = useNotesStore()
const { isMobileOrTablet } = useDevice()
const portfolio = usePortfolioSummary()

// ── Grouped Navigation ──
interface NavGroup {
  labelKey?: string;
  items: { key: string; icon: any; route: string }[];
}

const navGroups = computed<NavGroup[]>(() => {
  // 1. Finance & Core
  const financeItems = [
    { key: 'nav.dashboard',    icon: LayoutDashboard, route: '/' },
    { key: 'nav.transactions', icon: ArrowLeftRight,  route: '/transactions' },
    { key: 'nav.wallets',      icon: Wallet,          route: '/wallets' },
    { key: 'nav.planning',     icon: Target,          route: '/planning' }
  ]
  
  if (ui.enableStocks) {
    financeItems.push({ key: 'nav.stocks', icon: LineChart, route: '/stocks' })
  }

  // 2. Workspace & Tools
  const workspaceItems = [
    { key: 'reminders.title',  icon: Bell,            route: '/reminders' },
    { key: 'nav.notes',        icon: FileText,        route: '/notes' }
  ]

  return [
    { items: financeItems }, // No label for the primary group to save space
    { labelKey: 'nav.workspace', items: workspaceItems },
    { items: [{ key: 'nav.settings', icon: Settings, route: '/settings' }] }
  ]
})

// ── Collapsible Section State (persisted) ──
const STORAGE_KEY = 'sb_sections'

function loadSections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { wallets: true, notes: true }
  } catch {
    return { wallets: true, notes: true }
  }
}

const sections = ref<{ wallets: boolean; notes: boolean }>(loadSections())

function toggleSection(key: 'wallets' | 'notes') {
  sections.value[key] = !sections.value[key]
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sections.value)) } catch {}
}

// When sidebar collapses to icon-only, collapse all sections
watch(() => ui.sidebarOpen, (open) => {
  if (!open) {
    sections.value = { wallets: false, notes: false }
  }
})

const isActive = (path: string) => (path === '/' ? route.path === '/' : route.path.startsWith(path))

function closeSidebarOnMobile() {
  if (isMobileOrTablet.value) ui.closeSidebar()
}

function quickAdd() {
  router.push('/transactions/add')
  closeSidebarOnMobile()
}

function navigateWallet(walletId: string) {
  finance.filter = { walletId }
  router.push('/transactions')
  closeSidebarOnMobile()
}

// ── Drag & Drop for Notes ──
const dragIndex = ref<number | null>(null)
const dropIndex = ref<number | null>(null)

// Sidebar notes order (first 5), persisted via localStorage
const NOTES_ORDER_KEY = 'sb_notes_order'

function loadNotesOrder(): string[] {
  try {
    const raw = localStorage.getItem(NOTES_ORDER_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) { console.warn('[Sidebar] Failed to parse notes order', e); return [] }
}

const sidebarNotesOrder = ref<string[]>(loadNotesOrder())

const sidebarNotes = computed(() => {
  const all = notesStore.notes
  const order = sidebarNotesOrder.value
  if (order.length === 0) return all.slice(0, 5)

  // Place ordered notes first, then any remaining notes not in the order list
  const ordered: typeof all = []
  const remaining = [...all]

  for (const id of order) {
    const idx = remaining.findIndex(n => n.id === id)
    if (idx !== -1) {
      ordered.push(remaining.splice(idx, 1)[0])
    }
  }

  return [...ordered, ...remaining].slice(0, 5)
})

function onDragStart(index: number, e: DragEvent) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropIndex.value = index
}

function onDragLeave() {
  dropIndex.value = null
}

function onDrop(index: number, e: DragEvent) {
  e.preventDefault()
  if (dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null
    dropIndex.value = null
    return
  }

  // Build a mutable array from current sidebar notes
  const items = [...sidebarNotes.value]
  const [moved] = items.splice(dragIndex.value, 1)
  items.splice(index, 0, moved)

  // Persist the new order
  sidebarNotesOrder.value = items.map(n => n.id)
  try { localStorage.setItem(NOTES_ORDER_KEY, JSON.stringify(sidebarNotesOrder.value)) } catch (e) { console.warn('[Sidebar] Failed to persist notes order', e) }

  dragIndex.value = null
  dropIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dropIndex.value = null
}
</script>

<template>
  <!-- Mobile overlay -->
  <div
    v-if="ui.sidebarOpen"
    class="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] md:hidden"
    @click="ui.toggleSidebar"
  />

  <aside
    class="pwa-sidebar-safe sidebar glass-sidebar fixed top-[3.5rem] bottom-0 z-40 flex flex-col overflow-hidden transition-all duration-300 md:translate-x-0"
    :class="[
      ui.sidebarOpen
        ? 'w-[15.5rem] translate-x-0'
        : 'w-[3.75rem] -translate-x-full md:translate-x-0 md:w-[3.75rem]'
    ]"
  >
    <div class="flex flex-1 flex-col overflow-x-hidden overflow-y-auto p-2.5 gap-1">

      <!-- ── Quick Add ── -->
      <button
        @click="quickAdd"
        class="quick-add-btn"
        :class="{ 'icon-only': !ui.sidebarOpen }"
        :title="ui.sidebarOpen ? '' : t('nav.addTransaction')"
      >
        <Plus :size="ui.sidebarOpen ? 15 : 20" class="shrink-0" />
        <span v-if="ui.sidebarOpen" class="truncate">{{ t('nav.addTransaction') }}</span>
      </button>

      <!-- ── Navigation section ── -->
      <nav class="flex flex-col gap-0.5 mt-1">
        <template v-for="(group, gIdx) in navGroups" :key="'group-'+gIdx">
          
          <!-- Group Label or Divider -->
          <template v-if="group.labelKey">
            <div v-if="ui.sidebarOpen" class="section-label mt-2">
              {{ t(group.labelKey) }}
            </div>
            <div v-else class="section-divider-icon mt-2" />
          </template>

          <!-- Group Items -->
          <router-link
            v-for="item in group.items"
            :key="item.route"
            :to="item.route"
            class="nav-item"
            :class="[
              isActive(item.route) ? 'nav-item--active' : '',
              !ui.sidebarOpen ? 'nav-item--icon' : ''
            ]"
            :title="ui.sidebarOpen ? '' : t(item.key)"
            @click="closeSidebarOnMobile"
          >
            <component :is="item.icon" :size="ui.sidebarOpen ? 17 : 20" class="shrink-0" />
            <span v-if="ui.sidebarOpen" class="truncate">{{ t(item.key) }}</span>
          </router-link>

        </template>
      </nav>

      <!-- ── Separator ── -->
      <div v-if="ui.sidebarOpen" class="section-sep" />
      <div v-else class="section-divider-icon mt-1" />

      <!-- ── Wallet Balances (Collapsible) ── -->
      <div v-if="finance.wallets.length > 0" class="collapsible-section">

        <!-- Section Header -->
        <button
          v-if="ui.sidebarOpen"
          class="section-header"
          @click="toggleSection('wallets')"
        >
          <span class="section-label--inline">{{ t('nav.walletSection') }}</span>
          <ChevronDown
            :size="13"
            class="section-chevron"
            :class="{ 'rotated': !sections.wallets }"
          />
        </button>
        <div v-else class="section-divider-icon" />

        <!-- Section Body -->
        <div
          class="section-body"
          :class="{ 'section-body--open': sections.wallets && ui.sidebarOpen }"
        >
          <div class="section-body__inner">
            <div
              v-for="w in finance.wallets.slice(0, 5)"
              :key="w.id"
              class="wallet-row"
              @click="navigateWallet(w.id)"
            >
              <span class="flex items-center gap-2 min-w-0">
                <!-- Custom logo (user-uploaded or URL) -->
                <div v-if="w.customLogoUrl" class="wallet-logo bg-white">
                  <img :src="w.customLogoUrl" class="h-full w-full object-contain" :alt="w.name" loading="lazy" />
                </div>
                <template v-else-if="getWalletBrand(w.name)">
                  <div v-if="getWalletBrand(w.name)?.logoUrl" class="wallet-logo">
                    <img :src="getWalletBrand(w.name)!.logoUrl" class="h-full w-full object-contain" />
                  </div>
                  <span
                    v-else
                    class="wallet-abbr"
                    :style="{ backgroundColor: getWalletBrand(w.name)!.bgColor, color: getWalletBrand(w.name)!.textColor }"
                  >
                    {{ getWalletBrand(w.name)!.abbr }}
                  </span>
                </template>
                <span v-else class="text-sm font-emoji shrink-0">{{ w.icon }}</span>
                <span class="truncate text-[0.75rem] text-text-secondary">{{ w.name }}</span>
              </span>
              <span
                class="text-[0.6875rem] font-semibold tabular-nums shrink-0"
                :class="w.balance >= 0 ? 'text-text-tertiary' : 'text-error'"
              >
                {{ formatVNDShort(w.balance) }}
              </span>
            </div>
            <!-- Total footer: Net Worth when investments exist, else wallet total -->
            <div class="wallet-total">
              <span class="text-text-disabled text-[0.6875rem]">
                {{ portfolio.hasInvestments.value ? 'Net Worth' : t('nav.totalBalance') }}
              </span>
              <span class="text-accent text-[0.6875rem] font-bold tabular-nums">
                {{ formatVNDShort(portfolio.hasInvestments.value ? portfolio.totalNetWorth.value : finance.totalBalance) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Recent Notes (Collapsible) ── -->
      <div v-if="notesStore.notes.length > 0" class="collapsible-section">

        <button
          v-if="ui.sidebarOpen"
          class="section-header"
          @click="toggleSection('notes')"
        >
          <span class="section-label--inline">{{ t('nav.recentNotes') }}</span>
          <div class="flex items-center gap-1.5">
            <span class="section-count">{{ Math.min(notesStore.notes.length, 5) }}</span>
            <ChevronDown
              :size="13"
              class="section-chevron"
              :class="{ 'rotated': !sections.notes }"
            />
          </div>
        </button>
        <div v-else class="section-divider-icon" />

        <div
          class="section-body"
          :class="{ 'section-body--open': sections.notes && ui.sidebarOpen }"
        >
          <div class="section-body__inner">
            <div
              v-for="(note, idx) in sidebarNotes"
              :key="note.id"
              class="note-row group"
              :class="{
                'note-row--dragging': dragIndex === idx,
                'note-row--drop-above': dropIndex === idx && dragIndex !== null && dragIndex > idx,
                'note-row--drop-below': dropIndex === idx && dragIndex !== null && dragIndex < idx
              }"
              draggable="true"
              @dragstart="onDragStart(idx, $event)"
              @dragover="onDragOver(idx, $event)"
              @dragleave="onDragLeave"
              @drop="onDrop(idx, $event)"
              @dragend="onDragEnd"
              @click="router.push('/notes/' + note.id); closeSidebarOnMobile()"
            >
              <GripVertical :size="11" class="shrink-0 text-text-disabled/30 cursor-grab drag-handle" />
              <FileText :size="13" class="shrink-0 text-text-disabled" />
              <span class="truncate text-[0.75rem] text-text-secondary flex-1">
                {{ note.title || t('notes.untitled') }}
              </span>
              <ChevronRightIcon :size="11" class="shrink-0 text-text-disabled/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>

      <!-- spacer -->
      <div class="flex-1" />

      <!-- Buy me a coffee -->
      <button
        @click="ui.showBuyMeCoffee = true"
        class="nav-item group mt-2"
        :class="{ 'nav-item--icon': !ui.sidebarOpen }"
        :title="ui.sidebarOpen ? '' : 'Buy me a coffee ☕'"
      >
        <Coffee :size="ui.sidebarOpen ? 17 : 20" class="shrink-0 text-text-tertiary group-hover:text-accent transition-colors" />
        <span v-if="ui.sidebarOpen" class="truncate font-medium bg-gradient-to-r from-accent/80 to-accent bg-clip-text text-transparent">Buy me a coffee ☕</span>
      </button>

    </div>
  </aside>
</template>

<style scoped>
/* ══════════════════════════════════════
   Quick Add Button
   ══════════════════════════════════════ */
.quick-add-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-default);
  transition: all 0.15s ease;
  white-space: nowrap;
  cursor: pointer;
}
.quick-add-btn:hover,
.quick-add-btn:active {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
}
.quick-add-btn.icon-only {
  justify-content: center;
  padding: 0.5rem;
}

/* ══════════════════════════════════════
   Section Labels
   ══════════════════════════════════════ */
.section-label {
  padding: 0.5rem 0.625rem 0.25rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-disabled);
}

.section-label--inline {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-disabled);
}

.section-divider-icon {
  height: 1px;
  background: var(--color-border-subtle);
  margin: 0.5rem 0.75rem;
  opacity: 0.6;
}

.section-sep {
  height: 1px;
  background: var(--color-border-subtle);
  margin: 0.25rem 0;
  opacity: 0.5;
}

/* ══════════════════════════════════════
   Nav Items
   ══════════════════════════════════════ */
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: background 0.12s ease, color 0.12s ease;
  white-space: nowrap;
}
.nav-item:hover,
.nav-item:active {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}
.nav-item--active {
  background: rgba(124, 111, 247, 0.1);
  color: var(--color-accent);
  font-weight: 600;
}
.nav-item--active:hover,
.nav-item--active:active {
  background: rgba(124, 111, 247, 0.15);
}
.nav-item--icon {
  justify-content: center;
  padding: 0.5rem;
}

/* ══════════════════════════════════════
   Collapsible Sections
   ══════════════════════════════════════ */
.collapsible-section {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.375rem 0.625rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.12s ease;
  gap: 0.5rem;
}
.section-header:hover,
.section-header:active {
  background: var(--color-bg-hover);
}

.section-chevron {
  color: var(--color-text-disabled);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}
.section-chevron.rotated {
  transform: rotate(-90deg);
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  font-size: 0.5625rem;
  font-weight: 700;
  color: var(--color-text-disabled);
}

/* ── Animated collapse (CSS grid trick) ── */
.section-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.section-body--open {
  grid-template-rows: 1fr;
}
.section-body__inner {
  overflow: hidden;
  min-height: 0;
}

/* ══════════════════════════════════════
   Wallet Rows
   ══════════════════════════════════════ */
.wallet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.625rem;
  border-radius: 0.4375rem;
  cursor: pointer;
  transition: background 0.1s ease;
  gap: 0.5rem;
}
.wallet-row:hover,
.wallet-row:active {
  background: var(--color-bg-hover);
}

.wallet-logo {
  flex-shrink: 0;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 3px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--color-border-subtle);
  padding: 1px;
}

.wallet-abbr {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 3px;
  font-size: 0.5rem;
  font-weight: 800;
}

.wallet-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.625rem;
  margin-top: 0.125rem;
  border-top: 1px solid var(--color-border-subtle);
}

/* ══════════════════════════════════════
   Note Rows
   ══════════════════════════════════════ */
.note-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.4375rem;
  cursor: pointer;
  transition: background 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
  position: relative;
}
.note-row:hover,
.note-row:active {
  background: var(--color-bg-hover);
}

/* Drag handle — only visible on hover */
.drag-handle {
  opacity: 0;
  transition: opacity 0.12s ease;
}
.note-row:hover .drag-handle {
  opacity: 1;
}

/* Dragging state */
.note-row--dragging {
  opacity: 0.35;
}

/* Drop target indicators */
.note-row--drop-above {
  box-shadow: 0 -2px 0 0 var(--color-accent) inset;
}
.note-row--drop-below {
  box-shadow: 0 2px 0 0 var(--color-accent) inset;
}

/* ── Glassmorphism ── */
.glass-sidebar {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-right: 1px solid var(--glass-border);
}
</style>
