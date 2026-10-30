<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useFinanceStore } from '@/stores/finance'
import { useEventListener } from '@/composables/useEventListener'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { formatMoney } from '@/composables/useCurrency'
import { getWalletBrand } from '@/constants/walletBrands'
import { useSavingsStore } from '@/stores/savings'
import { Menu, ChevronLeft, Bell, Settings, LogOut, ArrowUpRight, ArrowDownRight, CheckCheck, Trash2, BellOff, Zap, Sun, Moon, Eye, EyeOff } from 'lucide-vue-next'

const { t } = useI18n()
const auth = useAuthStore()
const ui = useUiStore()
const notiStore = useNotificationStore()
const finance = useFinanceStore()
const savings = useSavingsStore()
const router = useRouter()
const route = useRoute()

// Dynamic back route:
// - routes with meta.parentRoute use that
const backRoute = computed(() => (route.meta.parentRoute as string | undefined) ?? null)

function goBack() {
  if (backRoute.value) {
    router.push(backRoute.value)
  } else {
    router.back()
  }
}

const imgError = ref(false)
watch(() => auth.user?.avatarUrl, () => {
  imgError.value = false
})

// ─── Bell Dropdown ─────────────────────────────────────────────────────────
const bellOpen = ref(false)
const bellRef = ref<HTMLElement | null>(null)

function toggleBell() {
  bellOpen.value = !bellOpen.value
  if (bellOpen.value) notiStore.fetch()
}

function handleOutsideClick(e: MouseEvent) {
  if (bellRef.value && !bellRef.value.contains(e.target as Node)) {
    bellOpen.value = false
  }
}

useEventListener(document, 'click', handleOutsideClick as EventListener)

// Initial fetch is handled by AppLayout.vue (single source of truth).
// AppHeader only re-fetches when the user explicitly opens the bell dropdown.

// ─── Auth ───────────────────────────────────────────────────────────────────
function handleLogout() {
  finance.reset()   // clear cached transactions/wallets before leaving
  auth.logout()
  router.push('/login')
}

// ─── Auto-Save Action ────────────────────────────────────────────────────────
const actionLoading = ref<string | null>(null)
async function handleAutoSaveApprove(n: any) {
  if (!n.meta?.savingId || !n.meta?.amount) return
  actionLoading.value = n.id
  try {
    // If savings store is empty (e.g. user refreshed and hasn't visited Savings), fetch it first
    if (savings.goals.length === 0) await savings.fetch()
    const target = savings.goals.find(g => g.id === n.meta.savingId)
    const walletId = target?.autoSaveWalletId || finance.wallets[0]?.id
    
    if (walletId) {
      await savings.deposit(n.meta.savingId, n.meta.amount, walletId)
      ui.showToast('success', t('savings.depositSuccess'))
      await notiStore.markRead(n.id)
      
      // Also refresh wallet balance
      await finance.fetchWallets()
    } else {
      ui.showToast('error', t('savings.depositNoWallet'))
    }
  } catch (error: any) {
    ui.showToast('error', error.message || t('savings.depositError'))
  } finally {
    actionLoading.value = null
  }
}
</script>

<template>
  <header
    class="pwa-header-safe glass-header fixed top-0 right-0 left-0 z-50 flex h-[3.5rem] items-center justify-between px-4 transition-colors duration-300"
  >
    <!-- Left -->
    <div class="flex items-center gap-3">
      <button
        v-if="backRoute"
        class="text-text-secondary hover:bg-bg-hover active:bg-bg-hover hover:text-text-primary active:text-text-primary flex h-8.5 w-8.5 items-center justify-center rounded-lg transition-all duration-150"
        @click="goBack"
      >
        <ChevronLeft :size="24" />
      </button>
      <button
        v-else
        id="toggle-sidebar-btn"
        class="text-text-secondary hover:bg-bg-hover active:bg-bg-hover hover:text-text-primary active:text-text-primary flex h-8.5 w-8.5 items-center justify-center rounded-lg transition-all duration-150"
        @click="ui.toggleSidebar"
      >
        <Menu :size="18" />
      </button>
      <router-link
        to="/"
        class="text-text-primary group flex items-center gap-2.5 text-base font-bold tracking-tight no-underline"
      >
        <div class="flex h-[1.875rem] w-[1.875rem] items-center justify-center transition-all duration-150 group-hover:scale-105">
          <img src="/images/logo-512.png" alt="FinNote Logo" class="h-full w-full rounded-md drop-shadow-[0_0_8px_rgba(124,111,247,0.35)] object-cover" />
        </div>
        <span class="hidden md:inline group-hover:text-accent transition-colors duration-150">FinNote</span>
      </router-link>
    </div>

    <!-- Right -->
    <div class="flex items-center gap-1">
      <!-- Toggle Balance -->
      <button
        class="text-text-secondary hover:bg-bg-hover active:bg-bg-hover hover:text-accent active:text-accent relative flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
        :title="ui.hideBalances ? t('dashboard.toggleBalance') : t('dashboard.toggleBalance')"
        @click="ui.toggleHideBalances()"
      >
        <EyeOff v-if="ui.hideBalances" :size="18" />
        <Eye v-else :size="18" />
      </button>

      <!-- Theme Toggle -->
      <button
        class="text-text-secondary hover:bg-bg-hover active:bg-bg-hover hover:text-accent active:text-accent relative flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
        :title="t('common.toggleTheme')"
        @click="ui.toggleTheme()"
      >
        <Sun v-if="ui.theme === 'dark'" :size="18" />
        <Moon v-else :size="18" />
      </button>

      <!-- Auto Sync -->
      <router-link
        to="/auto-sync"
        class="text-text-secondary hover:bg-bg-hover active:bg-bg-hover hover:text-accent active:text-accent relative flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
        :title="t('nav.autoSync')"
      >
        <Zap :size="18" />
      </router-link>

      <!-- ── Bell Notification ── -->
      <div ref="bellRef" class="relative">
        <button
          id="notifications-btn"
          class="text-text-secondary hover:bg-bg-hover active:bg-bg-hover hover:text-text-primary active:text-text-primary relative flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
          :class="bellOpen ? 'bg-bg-hover text-text-primary' : ''"
          @click.stop="toggleBell"
        >
          <Bell :size="18" />
          <!-- Unread badge -->
          <span
            v-if="notiStore.unreadCount > 0"
            class="bg-error absolute top-1 right-1 flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full text-[0.5625rem] font-bold text-white"
          >
            {{ notiStore.unreadCount > 9 ? '9+' : notiStore.unreadCount }}
          </span>
        </button>

        <!-- Dropdown Panel -->
        <transition name="dropdown">
          <div
            v-if="bellOpen"
            class="
              glass-dropdown fixed left-1/2 top-[4.25rem] z-50 w-[calc(100vw-2rem)] -translate-x-1/2
              sm:absolute sm:left-auto sm:top-full sm:translate-x-0 sm:-right-2 sm:w-[22rem] sm:mt-3
              overflow-hidden rounded-xl shadow-xl
            "
            @click.stop
          >
            <!-- Header -->
            <div class="border-border-default flex items-center justify-between border-b px-4 py-3">
              <div class="flex items-center gap-2">
                <Bell :size="15" class="text-text-secondary" />
                <span class="text-sm font-semibold">{{ t('notifications.title') }}</span>
                <span
                  v-if="notiStore.unreadCount > 0"
                  class="bg-error/15 text-error rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap shrink-0"
                >
                  {{ t('notifications.new', { n: notiStore.unreadCount }) }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  v-if="notiStore.unreadCount > 0"
                  class="text-text-tertiary hover:bg-bg-hover active:bg-bg-hover hover:text-accent active:text-accent flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.6875rem] transition-colors duration-150"
                  :title="t('notifications.readAll')"
                  @click="notiStore.markAllRead()"
                >
                  <CheckCheck :size="14" />
                  <span class="hidden sm:inline">{{ t('notifications.readAll') }}</span>
                </button>
                <button
                  v-if="notiStore.notifications.length > 0"
                  class="text-text-tertiary hover:bg-error/10 active:bg-error/10 hover:text-error active:text-error flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.6875rem] transition-colors duration-150"
                  :title="t('notifications.deleteAll')"
                  @click="notiStore.clearAll()"
                >
                  <Trash2 :size="14" />
                  <span class="hidden sm:inline">{{ t('notifications.deleteAll') }}</span>
                </button>
              </div>
            </div>

            <!-- Filter Tabs -->
            <div class="border-border-default flex border-b">
              <button
                v-for="tab in [{ key: 'all', labelKey: 'notifications.tabAll' }, { key: 'unread', labelKey: 'notifications.tabUnread' }]"
                :key="tab.key"
                class="border-border-default flex-1 border-r py-2 text-[0.75rem] font-medium transition-colors duration-150 last:border-r-0"
                :class="notiStore.filter === tab.key
                  ? 'bg-accent-subtle text-accent'
                  : 'text-text-secondary hover:bg-bg-hover active:bg-bg-hover'"
                @click="notiStore.filter = tab.key as any"
              >
                {{ t(tab.labelKey) }}
              </button>
            </div>

            <!-- Notification List -->
            <div class="max-h-[60vh] sm:max-h-[24rem] overflow-y-auto">
              <!-- Loading -->
              <div v-if="notiStore.loading" class="flex flex-col gap-2 p-3">
                <div v-for="i in 3" :key="i" class="skeleton h-14 rounded-lg" />
              </div>

              <!-- Items -->
              <template v-else-if="notiStore.filtered.length">
                <button
                  v-for="(n, idx) in notiStore.filtered"
                  :key="n.id"
                  class="noti-item hover:bg-bg-hover flex w-full items-start gap-3 px-4 py-3.5 text-left transition-all duration-200 relative"
                  :class="!n.read ? 'bg-bg-elevated border-l-[3px] border-l-accent' : 'border-l-[3px] border-l-transparent'"
                  :style="{ animationDelay: idx * 30 + 'ms' }"
                  @click="notiStore.markRead(n.id)"
                >
                  <!-- Icon: Bank logo or fallback arrow -->
                  <div
                    v-if="n.meta?.bankName && getWalletBrand(n.meta.bankName)?.logoUrl"
                    class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-white/10 overflow-hidden"
                  >
                    <img
                      :src="getWalletBrand(n.meta.bankName)!.logoUrl"
                      :alt="n.meta.bankName"
                      class="h-6 w-6 object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div
                    v-else
                    class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm"
                    :class="n.type === 'bank_in'
                      ? 'bg-gradient-to-br from-violet-500/20 to-violet-500/5 ring-1 ring-violet-500/20'
                      : n.type === 'bank_out'
                        ? 'bg-gradient-to-br from-red-500/20 to-red-500/5 ring-1 ring-red-500/20'
                        : 'bg-gradient-to-br from-blue-500/20 to-blue-500/5 ring-1 ring-blue-500/20'"
                  >
                    <ArrowUpRight v-if="n.type === 'bank_in'" :size="16" class="text-success" />
                    <ArrowDownRight v-else-if="n.type === 'bank_out'" :size="16" class="text-error" />
                    <Bell v-else :size="16" class="text-info" />
                  </div>

                  <!-- Content -->
                  <div class="min-w-0 flex-1">
                    <!-- Money Amount (hero) -->
                    <div v-if="n.meta?.amount" class="mb-0.5">
                      <span
                        class="text-[0.9375rem] font-bold tracking-tight"
                        :class="n.meta.txType === 'income' ? 'text-success' : 'text-error'"
                      >
                        {{ n.meta.txType === 'income' ? '+' : '-' }}{{ formatMoney(n.meta.amount) }}
                      </span>
                    </div>
                    <!-- Title -->
                    <span
                      class="text-[0.8125rem] leading-tight block"
                      :class="!n.read ? 'text-text-primary font-semibold' : 'text-text-secondary font-medium'"
                    >
                      {{ n.title === '[SMS] Tiền ra tài khoản' ? t('notifications.smsOut') : n.title === '[SMS] Tiền vào tài khoản' ? t('notifications.smsIn') : n.title }}
                    </span>
                    <!-- Wallet + Time row -->
                    <div class="flex items-center gap-2 mt-1">
                      <span
                        v-if="n.meta?.walletName"
                        class="bg-bg-elevated text-text-primary border border-border-strong inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[0.625rem] font-medium shadow-sm"
                      >
                        {{ n.meta.walletName }}
                      </span>
                      <span class="text-text-disabled text-[0.6875rem]">
                        {{ notiStore.timeSince(n.createdAt) }}
                      </span>
                    </div>

                    <!-- Auto-Save Action Button -->
                    <div v-if="n.meta?.savingId && !n.read" class="mt-3">
                      <button 
                        @click.stop="handleAutoSaveApprove(n)" 
                        class="bg-accent hover:bg-accent-hover text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-md transition-colors flex items-center gap-1.5"
                        :disabled="actionLoading === n.id"
                      >
                        <Zap :size="12" />
                        <span v-if="actionLoading === n.id">{{ t('savings.processing') }}</span>
                        <span v-else>{{ t('savings.approveExtract', { amount: formatMoney(n.meta.amount || 0) }) }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Unread dot -->
                  <span v-if="!n.read" class="bg-accent mt-2 h-2 w-2 shrink-0 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                </button>
              </template>

              <!-- Empty -->
              <div v-else class="flex flex-col items-center py-10 text-center">
                <BellOff :size="32" class="text-text-disabled mb-3" />
                <p class="text-text-tertiary text-sm font-medium">
                  {{ notiStore.filter === 'unread' ? t('notifications.emptyUnread') : t('notifications.empty') }}
                </p>
                <p class="text-text-disabled mt-1 text-[0.75rem]">
                  {{ t('notifications.emptyHint') }}
                </p>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Settings -->
      <router-link
        to="/settings"
        class="text-text-secondary hover:bg-bg-hover active:bg-bg-hover hover:text-text-primary active:text-text-primary flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-lg transition-all duration-150"
        id="settings-btn"
      >
        <Settings :size="18" />
      </router-link>

      <div class="bg-border-default mx-2 h-6 w-px"></div>

      <!-- User / Logout -->
      <template v-if="auth.isAuthenticated">
        <button
          id="user-menu-btn"
          class="group flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-all duration-150"
          @click="handleLogout"
        >
          <div
            v-if="!auth.user?.avatarUrl || imgError"
            class="bg-accent-subtle text-accent flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold"
          >
            {{ auth.user?.name?.charAt(0)?.toUpperCase() || 'U' }}
          </div>
          <img
            v-else
            v-show="!imgError"
            :src="auth.user?.avatarUrl"
            alt="Avatar"
            class="h-7 w-7 rounded-full object-cover"
            referrerpolicy="no-referrer"
            @error="imgError = true"
          />
          <div
            class="flex h-7 w-7 items-center justify-center rounded-lg bg-error/10 text-error transition-colors duration-150 group-hover:bg-error/20"
            :title="t('common.logout')"
          >
            <LogOut :size="14" />
          </div>
        </button>
      </template>
      <template v-else>
        <router-link
          to="/login"
          class="btn-primary"
        >
          {{ t('common.login') }}
        </router-link>
      </template>
    </div>
  </header>
</template>

<style scoped>
.dropdown-enter-active {
  transition: opacity 150ms ease, transform 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-leave-active {
  transition: opacity 100ms ease, transform 100ms ease;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-0.375rem) scale(0.97);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem) scale(0.98);
}
.noti-item {
  animation: notiSlideIn 200ms ease both;
}
@keyframes notiSlideIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Glassmorphism ── */
.glass-header {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--glass-border);
}
.glass-dropdown {
  background: var(--glass-bg-heavy);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
}
</style>
