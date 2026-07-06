<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFinanceStore } from '@/stores/finance'
import { formatVND } from '@/constants/finance'
import { getWalletBrand } from '@/constants/walletBrands'
import { httpClient } from '@/shared/api/httpClient'
import { Plus, Trash2, Edit3, X, Check, GripVertical, Link, Upload, Image as ImageIcon } from 'lucide-vue-next'
import PinDialog from '@/components/PinDialog.vue'
import CurrencyInput from '@/components/ui/CurrencyInput.vue'
import LogoLoader from '@/components/ui/LogoLoader.vue'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import type { Wallet } from '@/types'

const { t } = useI18n()
const ui = useUiStore()
const finance = useFinanceStore()

onMounted(() => finance.fetchWallets())

const showAdd = ref(false)
const editId = ref<string | null>(null)
const newWallet = ref({ name: '', icon: '💰', color: '#10b981', customLogoUrl: '' })

// Custom logo mode: 'url' | 'upload'
const logoMode = ref<'url' | 'upload'>('url')
const uploadPreview = ref<string>('')
const isUploadLoading = ref(false)
const urlPreviewError = ref(false)

// PIN state
const hasPin = ref(false)
const showPinDialog = ref(false)
const pendingDeleteId = ref<string | null>(null)

onMounted(async () => {
  try {
    const data = await httpClient.get<{ hasPin: boolean }>('/api/pin')
    hasPin.value = data?.hasPin || false
  } catch { /* no pin set */ }
})

const COLORS = [
  '#e62e2e', '#7b2d8e', '#d82d8b', '#0068ff', '#1a1f71',
  '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444',
  '#006838', '#1e3765', '#00529b', '#d11f26', '#003c7d'
]

/** Whether the current name has an auto-detected brand logo */
const hasBrandLogo = computed(() => !!getWalletBrand(newWallet.value.name))

/** The effective logo URL to use when adding the wallet */
const effectiveLogoUrl = computed(() => {
  if (hasBrandLogo.value) return '' // brand takes priority, don't save custom
  if (logoMode.value === 'upload') return uploadPreview.value
  return newWallet.value.customLogoUrl.trim()
})

const isAdding = ref(false)

/** Handle file upload → base64 */
async function handleFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  // Limit to 300KB to stay within KV value size sanity
  if (file.size > 300 * 1024) {
    ui.showToast('error', t('wallets.logoTooLarge'))
    return
  }
  if (!file.type.startsWith('image/')) {
    ui.showToast('error', t('wallets.logoInvalidType'))
    return
  }

  isUploadLoading.value = true
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    uploadPreview.value = base64
    logoMode.value = 'upload'
  } catch {
    ui.showToast('error', t('wallets.logoReadError'))
  } finally {
    isUploadLoading.value = false
  }
}

function clearCustomLogo() {
  uploadPreview.value = ''
  newWallet.value.customLogoUrl = ''
  urlPreviewError.value = false
  logoMode.value = 'url'
}

async function addWallet() {
  if (!newWallet.value.name.trim() || isAdding.value) return
  isAdding.value = true
  try {
    const brand = getWalletBrand(newWallet.value.name)
    await finance.addWallet({
      name: newWallet.value.name.trim(),
      balance: 0,
      currency: 'VND',
      icon: newWallet.value.icon,
      color: brand?.bgColor || newWallet.value.color,
      order: finance.wallets.length,
      customLogoUrl: effectiveLogoUrl.value || undefined
    })
    newWallet.value = { name: '', icon: '💰', color: '#10b981', customLogoUrl: '' }
    uploadPreview.value = ''
    urlPreviewError.value = false
    showAdd.value = false
  } finally {
    isAdding.value = false
  }
}

async function requestDelete(id: string) {
  if (hasPin.value) {
    pendingDeleteId.value = id
    showPinDialog.value = true
  } else {
    const confirmed = await ui.requestConfirm({
      title: t('wallets.deleteTitle'),
      message: t('wallets.deleteMessage'),
      danger: true,
      confirmText: t('wallets.deleteConfirm')
    })
    if (confirmed) finance.deleteWallet(id)
  }
}

async function onPinConfirmed() {
  showPinDialog.value = false
  if (pendingDeleteId.value) {
    await finance.deleteWallet(pendingDeleteId.value)
    pendingDeleteId.value = null
  }
}

const editBalances = ref<Record<string, number>>({})

function startEdit(id: string, currentBalance: number) { 
  editId.value = id
  editBalances.value[id] = currentBalance
}

async function saveEdit(id: string) {
  const bal = editBalances.value[id] ?? 0
  await finance.updateWallet(id, { balance: bal })
  editId.value = null
}

// ── Drag & Drop ──

const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)
const isDraggingSaving = ref(false)

function onDragStart(e: DragEvent, wallet: Wallet) {
  draggedId.value = wallet.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', wallet.id)
  }
}

function onDragOver(e: DragEvent, wallet: Wallet) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  if (draggedId.value !== wallet.id) {
    dragOverId.value = wallet.id
  }
}

function onDragLeave() {
  dragOverId.value = null
}

async function onDrop(e: DragEvent, targetWallet: Wallet) {
  e.preventDefault()
  dragOverId.value = null

  if (!draggedId.value || draggedId.value === targetWallet.id) {
    draggedId.value = null
    return
  }

  const wallets = [...finance.wallets]
  const fromIdx = wallets.findIndex(w => w.id === draggedId.value)
  const toIdx = wallets.findIndex(w => w.id === targetWallet.id)

  if (fromIdx === -1 || toIdx === -1) { draggedId.value = null; return }

  const [moved] = wallets.splice(fromIdx, 1)
  wallets.splice(toIdx, 0, moved)
  wallets.forEach((w, i) => { w.order = i })
  finance.wallets = wallets

  isDraggingSaving.value = true
  try {
    for (let i = 0; i < wallets.length; i++) {
      await finance.updateWallet(wallets[i].id, { order: i })
    }
  } catch {
    ui.showToast('error', t('wallets.cannotSaveOrder'))
    await finance.fetchWallets()
  } finally {
    isDraggingSaving.value = false
  }

  draggedId.value = null
}

function onDragEnd() {
  draggedId.value = null
  dragOverId.value = null
}

/** Resolve the logo URL for an existing wallet in the list */
function getWalletLogo(w: Wallet) {
  if (w.customLogoUrl) return w.customLogoUrl
  const brand = getWalletBrand(w.name)
  return brand?.logoUrl || null
}

function getWalletBrandConfig(w: Wallet) {
  if (w.customLogoUrl) return null  // custom logo wins
  return getWalletBrand(w.name)
}
</script>

<template>
  <div class="mx-auto max-w-[64rem]">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold tracking-tight">{{ t('wallets.title') }}</h1>
        <span v-if="isDraggingSaving" class="text-text-disabled flex items-center gap-1.5 text-xs">
          <AppSpinner :size="12"  />
          {{ t('common.saving') }}
        </span>
      </div>
      <button @click="showAdd = !showAdd" class="btn-primary">
        <Plus :size="16" />
        {{ t('wallets.addWallet') }}
      </button>
    </div>

    <!-- Add Wallet Form -->
    <transition name="slide">
      <div v-if="showAdd" class="bg-bg-surface border-border-default mb-6 rounded-xl border p-5">
        <h3 class="mb-4 text-sm font-semibold">{{ t('wallets.addNew') }}</h3>
        <div class="flex flex-col gap-4">
          <input
            v-model="newWallet.name"
            :placeholder="t('wallets.walletName')"
            class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-4 py-2.5 text-sm transition-all duration-150 focus:ring-2 focus:outline-none"
          />

          <div class="mb-2">
            <span class="text-text-tertiary mb-2 block text-[0.6875rem]">{{ t('wallets.popularBanks') }}</span>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="brand in ['MoMo', 'ZaloPay', 'Techcombank', 'TPBank', 'Vietcombank', 'MBBank', 'Visa', 'Tiền mặt']"
                :key="brand"
                @click="newWallet.name = brand"
                class="border-border-default hover:border-accent hover:text-accent bg-bg-surface text-text-secondary rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150"
                :class="newWallet.name === brand ? 'border-accent bg-accent/10 text-accent' : ''"
              >
                {{ brand }}
              </button>
            </div>
          </div>

          <!-- Brand preview -->
          <div v-if="newWallet.name.trim()">
            <span class="text-text-tertiary mb-2 block text-[0.6875rem]">{{ t('common.preview') }}</span>
            <div class="flex items-center gap-3">
              <!-- Custom logo preview -->
              <div v-if="!hasBrandLogo && effectiveLogoUrl" class="flex h-10 w-10 overflow-hidden rounded-xl border border-border-default bg-white dark:bg-bg-elevated shadow-sm p-1">
                <img :src="effectiveLogoUrl" class="h-full w-full object-contain" alt="logo" />
              </div>
              <!-- Brand logo -->
              <div v-else-if="hasBrandLogo && getWalletBrand(newWallet.name)?.logoUrl" class="flex h-10 w-10 overflow-hidden rounded-xl bg-white border border-border-default shadow-sm p-1.5">
                <img :src="getWalletBrand(newWallet.name)!.logoUrl" class="h-full w-full object-contain" alt="logo" />
              </div>
              <div v-else-if="hasBrandLogo" class="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold" :style="{ backgroundColor: getWalletBrand(newWallet.name)!.bgColor, color: getWalletBrand(newWallet.name)!.textColor }">
                {{ getWalletBrand(newWallet.name)!.abbr }}
              </div>
              <div v-else class="flex h-10 w-10 items-center justify-center rounded-xl text-lg" :style="{ backgroundColor: newWallet.color + '30' }">
                {{ newWallet.icon }}
              </div>
              <span class="text-sm font-medium">{{ newWallet.name }}</span>
            </div>
          </div>

          <!-- ── Custom Logo Section (only shown when no brand match) ── -->
          <div v-if="newWallet.name.trim() && !hasBrandLogo" class="rounded-xl border border-border-default bg-bg-elevated p-4">
            <div class="flex items-center gap-2 mb-3">
              <ImageIcon :size="14" class="text-accent" />
              <span class="text-[0.6875rem] font-semibold text-text-secondary uppercase tracking-wider">{{ t('wallets.customLogo') }}</span>
              <span class="text-[0.6875rem] text-text-disabled">{{ t('wallets.logoOptional') }}</span>
            </div>

            <!-- Mode tabs -->
            <div class="flex gap-1 p-1 bg-bg-surface rounded-lg border border-border-default mb-3">
              <button
                @click="logoMode = 'url'; uploadPreview = ''"
                class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all"
                :class="logoMode === 'url' ? 'bg-accent text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'"
              >
                <Link :size="12" /> {{ t('wallets.logoPasteUrl') }}
              </button>
              <button
                @click="logoMode = 'upload'"
                class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all"
                :class="logoMode === 'upload' ? 'bg-accent text-white shadow-sm' : 'text-text-tertiary hover:text-text-primary'"
              >
                <Upload :size="12" /> {{ t('wallets.logoUploadImage') }}
              </button>
            </div>

            <!-- URL mode -->
            <div v-if="logoMode === 'url'" class="flex gap-2">
              <input
                v-model="newWallet.customLogoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                @input="urlPreviewError = false"
                class="border-border-default bg-bg-surface text-text-primary placeholder:text-text-disabled focus:border-accent w-full rounded-lg border px-3 py-2 text-xs transition-all focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button v-if="newWallet.customLogoUrl" @click="clearCustomLogo" class="text-text-disabled hover:text-error transition-colors p-1 shrink-0">
                <X :size="16" />
              </button>
            </div>

            <!-- URL Preview error hint -->
            <p v-if="logoMode === 'url' && urlPreviewError" class="text-[10px] text-error mt-1">{{ t('wallets.logoUrlError') }}</p>

            <!-- Upload mode -->
            <div v-if="logoMode === 'upload'" class="flex items-center gap-3">
              <label class="flex-1 cursor-pointer">
                <div class="flex items-center justify-center gap-2 border-2 border-dashed border-border-default rounded-lg py-3 px-4 hover:border-accent hover:bg-accent/5 transition-all text-xs text-text-tertiary">
                  <Upload :size="14" />
                  <span>{{ isUploadLoading ? t('wallets.logoUploading') : t('wallets.logoChooseFile') }}</span>
                </div>
                <input type="file" accept="image/*" class="hidden" @change="handleFileUpload" :disabled="isUploadLoading" />
              </label>
              <button v-if="uploadPreview" @click="clearCustomLogo" class="text-text-disabled hover:text-error transition-colors p-1 shrink-0">
                <X :size="16" />
              </button>
            </div>

            <!-- Upload Preview -->
            <div v-if="uploadPreview" class="mt-2 flex items-center gap-2">
              <div class="h-8 w-8 rounded-lg border border-border-default overflow-hidden bg-white p-1 shrink-0">
                <img :src="uploadPreview" class="h-full w-full object-contain" alt="preview" />
              </div>
              <span class="text-[10px] text-success">{{ t('wallets.logoUploaded') }}</span>
            </div>
          </div>

          <div>
            <span class="text-text-tertiary mb-2 block text-[0.6875rem]">{{ t('wallets.colorCustom') }}</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in COLORS"
                :key="color"
                class="h-7 w-7 rounded-full border-2 transition-all duration-150"
                :class="newWallet.color === color ? 'scale-110 border-white' : 'border-transparent'"
                :style="{ backgroundColor: color }"
                @click="newWallet.color = color"
              ></button>
            </div>
          </div>

          <div class="flex gap-2">
            <button @click="showAdd = false" class="border-border-default text-text-secondary hover:bg-bg-hover flex-1 rounded-lg border py-2 text-sm transition-all duration-150">{{ t('common.cancel') }}</button>
            <button @click="addWallet" :disabled="!newWallet.name.trim() || isAdding" class="btn-primary flex-1 justify-center py-2 disabled:opacity-40">{{ t('common.add') }}</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Wallet List -->
    <div class="space-y-3">
      <!-- Loading Skeletons -->
      <template v-if="finance.loading">
        <div v-for="i in 3" :key="'skel-' + i" class="bg-bg-surface border-border-default flex items-center gap-4 rounded-xl border p-5">
          <div class="skeleton h-12 w-12 rounded-xl"></div>
          <div class="flex-1 space-y-2">
            <div class="skeleton h-4 w-32"></div>
            <div class="skeleton h-3 w-16"></div>
          </div>
          <div class="skeleton h-6 w-24"></div>
        </div>
      </template>

      <!-- Actual List (Draggable) -->
      <template v-else>
        <div
          v-for="w in finance.wallets"
          :key="w.id"
          draggable="true"
          class="wallet-item bg-bg-surface border-border-default flex items-center gap-4 rounded-xl border p-5 transition-all duration-150"
          :class="{
            'dragging': draggedId === w.id,
            'drag-over': dragOverId === w.id,
            'hover:border-border-strong': draggedId === null
          }"
          @dragstart="onDragStart($event, w)"
          @dragover="onDragOver($event, w)"
          @dragleave="onDragLeave"
          @drop="onDrop($event, w)"
          @dragend="onDragEnd"
        >
          <!-- Drag Handle -->
          <div class="drag-handle text-text-disabled hover:text-text-tertiary shrink-0 cursor-grab active:cursor-grabbing">
            <GripVertical :size="18" />
          </div>

          <!-- Wallet Logo: customLogoUrl > brandLogoUrl > brandAbbr > emoji -->
          <div class="flex h-12 w-12 shrink-0 items-center justify-center">
            <!-- Custom logo (user-uploaded or URL) -->
            <div v-if="w.customLogoUrl" class="flex h-12 w-12 overflow-hidden rounded-xl bg-white dark:bg-bg-elevated border border-border-default shadow-sm p-1.5">
              <img :src="w.customLogoUrl" :alt="w.name" class="h-full w-full object-contain object-center" loading="lazy" />
            </div>
            <!-- Auto brand logo (image) -->
            <div v-else-if="getWalletBrand(w.name)?.logoUrl" class="flex h-12 w-12 overflow-hidden rounded-xl bg-white border border-border-default shadow-sm p-1.5">
              <img :src="getWalletBrand(w.name)!.logoUrl" :alt="w.name" class="h-full w-full object-contain object-center" loading="lazy" />
            </div>
            <!-- Auto brand abbr -->
            <div
              v-else-if="getWalletBrand(w.name)"
              class="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold shadow-sm"
              :style="{ backgroundColor: getWalletBrand(w.name)!.bgColor, color: getWalletBrand(w.name)!.textColor }"
            >
              {{ getWalletBrand(w.name)!.abbr }}
            </div>
            <!-- Emoji fallback -->
            <div v-else class="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" :style="{ backgroundColor: w.color + '20' }">
              {{ w.icon }}
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">{{ w.name }}</div>
            <div class="text-text-tertiary text-[0.6875rem]">{{ w.currency }}</div>
          </div>

          <!-- Edit mode -->
          <div v-if="editId === w.id" class="flex items-center gap-2">
            <CurrencyInput
              :modelValue="editBalances[w.id] ?? w.balance"
              @update:modelValue="editBalances[w.id] = $event"
              @keydown.enter="saveEdit(w.id)"
              :allowNegative="true"
              className="border-accent bg-bg-elevated text-text-primary w-[8rem] rounded-lg border px-2 py-1 text-right text-sm focus:outline-none"
            />
            <button @click="saveEdit(w.id)" class="text-success hover:text-success p-1">
              <Check :size="14" />
            </button>
            <button @click="editId = null" class="text-text-tertiary hover:text-text-primary p-1">
              <X :size="14" />
            </button>
          </div>

          <!-- Normal mode -->
          <div v-else class="flex items-center gap-2">
            <span class="text-base font-bold" :class="w.balance >= 0 ? 'text-text-primary' : 'text-error'">
              {{ formatVND(w.balance) }}
            </span>
            <button @click="startEdit(w.id, w.balance)" class="text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded p-2 transition-all duration-150 touch-target" :title="t('wallets.editBalance')">
              <Edit3 :size="16" />
            </button>
            <button @click="requestDelete(w.id)" class="text-text-tertiary hover:text-error hover:bg-bg-hover rounded p-2 transition-all duration-150 touch-target" :title="t('wallets.deleteWallet')">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Total -->
    <div class="bg-bg-elevated border-border-default mt-6 flex items-center justify-between rounded-xl border p-5">
      <span class="text-text-secondary text-sm font-medium">{{ t('wallets.totalAll') }}</span>
      <span class="text-xl font-bold" :class="finance.totalBalance >= 0 ? 'text-accent' : 'text-error'">
        {{ formatVND(finance.totalBalance) }}
      </span>
    </div>

    <!-- PIN Dialog -->
    <PinDialog
      :show="showPinDialog"
      :title="t('wallets.pinDeleteTitle')"
      :message="t('wallets.pinDeleteMessage')"
      @confirmed="onPinConfirmed"
      @cancelled="showPinDialog = false; pendingDeleteId = null"
    />
  </div>
</template>

<style>
.wallet-item {
  user-select: none;
}

.wallet-item.dragging {
  opacity: 0.4;
  scale: 0.98;
}

.wallet-item.drag-over {
  border-color: var(--accent) !important;
  background: var(--accent-subtle);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.drag-handle {
  transition: color 120ms;
}

.slide-enter-active,
.slide-leave-active {
  transition: max-height 200ms ease, opacity 200ms ease;
  overflow: hidden;
}
.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}
.slide-enter-to,
.slide-leave-from {
  max-height: 60rem;
  opacity: 1;
}
</style>
