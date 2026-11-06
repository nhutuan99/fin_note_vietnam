<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useSavingsStore } from '@/stores/savings'
import { useFinanceStore } from '@/stores/finance'
import { formatVND } from '@/constants/finance'
import { Plus, Trash2, Target, ArrowUpRight, ArrowDownRight, PartyPopper, X, Zap, Settings } from 'lucide-vue-next'
import CurrencyInput from '@/components/ui/CurrencyInput.vue'
import CustomDatePicker from '@/components/ui/CustomDatePicker.vue'
import CustomSelect from '@/components/ui/CustomSelect.vue'

const { t } = useI18n()
const ui = useUiStore()
const savingsStore = useSavingsStore()
const financeStore = useFinanceStore()

onMounted(async () => {
  await financeStore.fetchWallets()
  await savingsStore.migrateFromLocal()
  await savingsStore.fetch()
})

const goals = computed(() => savingsStore.goals)
const showAdd = ref(false)
const saving = ref(false)
const showDeposit = ref<string | null>(null)
const depositAmount = ref<number>(0)
const depositWalletId = ref<string>('')

// Auto Save Modal
const showAutoSave = ref<string | null>(null)
const autoSaveAmount = ref<number>(0)
const autoSaveWalletId = ref<string>('')

const ICONS = ['🏖️','💻','🏠','🚗','🎓','💍','🏥','🎮','📱','✈️','🎯','💰']
const COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#ef4444','#14b8a6','#6366f1']

const form = ref({ name: '', icon: '🎯', color: '#10b981', targetAmount: 0, deadline: '', autoSaveEnabled: false, autoSaveAmount: 0, autoSaveWalletId: '' })

// AI Planner State
const planDurationMonths = ref<number | null>(null)
const aiDailyAmount = computed(() => {
  if (form.value.targetAmount <= 0 || !planDurationMonths.value) return 0;
  const days = planDurationMonths.value * 30;
  return Math.ceil(form.value.targetAmount / days);
})
const aiWeeklyAmount = computed(() => {
  if (form.value.targetAmount <= 0 || !planDurationMonths.value) return 0;
  const weeks = planDurationMonths.value * 4;
  return Math.ceil(form.value.targetAmount / weeks);
})

function applyAiPlan() {
  if (!planDurationMonths.value) return;
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + planDurationMonths.value);
  form.value.deadline = targetDate.toISOString().substring(0, 10);
  form.value.autoSaveEnabled = true;
  form.value.autoSaveAmount = aiDailyAmount.value;
  if (!form.value.autoSaveWalletId && financeStore.cashWallets.length > 0) {
    form.value.autoSaveWalletId = financeStore.cashWallets[0].id;
  }
}


async function addGoal() {
  const amt = form.value.targetAmount
  if (!form.value.name.trim() || amt <= 0) return
  if (saving.value) return
  saving.value = true
  try {
    const goal = await savingsStore.create({
      name: form.value.name.trim(),
      icon: form.value.icon,
      color: form.value.color,
      targetAmount: amt,
      deadline: form.value.deadline || undefined,
      autoSaveEnabled: form.value.autoSaveEnabled,
      autoSaveAmount: form.value.autoSaveAmount || undefined,
      autoSaveWalletId: form.value.autoSaveWalletId || undefined
    })
    if (!goal) {
      ui.showToast('error', t('savings.createError'))
      return
    }
    showAdd.value = false
    planDurationMonths.value = null
    form.value = { name: '', icon: '🎯', color: '#10b981', targetAmount: 0, deadline: '', autoSaveEnabled: false, autoSaveAmount: 0, autoSaveWalletId: '' }
    ui.showToast('success', t('savings.createSuccess'))
  } catch (err) {
    console.error('Failed to create saving goal:', err)
    ui.showToast('error', t('savings.createError'))
  } finally {
    saving.value = false
  }
}

async function deposit(id: string) {
  const amt = depositAmount.value
  if (amt <= 0) return
  await savingsStore.deposit(id, amt, depositWalletId.value || undefined)
  showDeposit.value = null; depositAmount.value = 0
}

async function withdraw(id: string) {
  const amt = depositAmount.value
  if (amt <= 0) return
  await savingsStore.withdraw(id, amt, depositWalletId.value || undefined)
  showDeposit.value = null; depositAmount.value = 0
}

async function deleteGoal(id: string) {
  const ok = await ui.requestConfirm({ title: t('savings.deleteTitle'), message: t('savings.deleteMessage'), danger: true, confirmText: t('common.delete') })
  if (!ok) return;
  await savingsStore.remove(id)
}

function openAutoSave(id: string) {
  const g = goals.value.find(x => x.id === id)
  if (g) {
    autoSaveAmount.value = g.autoSaveAmount || 0
    autoSaveWalletId.value = g.autoSaveWalletId || (financeStore.cashWallets[0]?.id) || ''
    showAutoSave.value = id
  }
}

async function enableAutoSave() {
  if (!showAutoSave.value) return
  await savingsStore.update(showAutoSave.value, {
    autoSaveEnabled: true,
    autoSaveAmount: autoSaveAmount.value,
    autoSaveWalletId: autoSaveWalletId.value || undefined
  })
  showAutoSave.value = null
}

async function disableAutoSave(id: string) {
  await savingsStore.update(id, { autoSaveEnabled: false })
  showAutoSave.value = null
}

function pct(g: any) { return g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0 }
function daysLeft(deadline?: string) { if (!deadline) return null; return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)) }
function dailySaveNeeded(g: any) { const d = daysLeft(g.deadline); if (!d || d === 0) return 0; return Math.ceil((g.targetAmount - g.currentAmount) / d) }

const totalSaved = computed(() => savingsStore.totalSaved)
const totalTarget = computed(() => savingsStore.totalTarget)

const walletOptions = computed(() => financeStore.cashWallets.map(w => ({
  value: w.id,
  label: `${w.name} (${formatVND(w.balance)})`
})))

const depositWalletOptions = computed(() => [
  { value: '', label: t('savings.autoSaveSourceExt') },
  ...walletOptions.value
])
</script>

<template>
  <div class="mx-auto max-w-[64rem]">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ t('savings.title') }}</h1>
        <p class="text-text-tertiary mt-1 text-sm">{{ t('savings.count', { n: goals.length }) }}</p>
      </div>
      <button @click="showAdd = !showAdd" class="btn-primary"><Plus :size="16" /> {{ t('savings.add') }}</button>
    </div>

    <!-- Summary -->
    <div v-if="goals.length" class="card-premium mb-6 p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="bg-success/10 flex h-9 w-9 items-center justify-center rounded-lg"><Target :size="18" class="text-success" /></div>
          <div>
            <div class="text-text-tertiary text-[0.6875rem] font-medium">{{ t('savings.totalSaved') }}</div>
            <div class="text-lg font-bold text-text-primary">{{ formatVND(totalSaved) }}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-text-tertiary text-[0.6875rem]">{{ t('savings.totalTarget') }}</div>
          <div class="text-sm font-semibold text-text-secondary">{{ formatVND(totalTarget) }}</div>
        </div>
      </div>
      <div class="bg-bg-elevated h-2 overflow-hidden rounded-full">
        <div class="h-full rounded-full bg-success transition-all duration-700" :style="{ width: (totalTarget > 0 ? (totalSaved/totalTarget)*100 : 0) + '%' }"></div>
      </div>
    </div>

    <!-- Add Form -->
    <transition name="expand">
      <div v-if="showAdd" class="bg-bg-surface border-border-default mb-6 rounded-xl border p-5">
        <h3 class="mb-4 text-sm font-semibold">{{ t('savings.addNew') }}</h3>
        <div class="flex flex-col gap-4">
          <input v-model="form.name" :placeholder="t('savings.namePlaceholder')" class="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none" />
          <div>
            <span class="text-text-tertiary mb-2 block text-[0.6875rem]">{{ t('savings.icon') }}</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="ic in ICONS" :key="ic" @click="form.icon = ic" class="h-9 w-9 rounded-lg border text-lg flex items-center justify-center transition-all" :class="form.icon === ic ? 'border-accent bg-accent-subtle scale-110' : 'border-border-default hover:border-border-strong'">{{ ic }}</button>
            </div>
          </div>
          <div>
            <span class="text-text-tertiary mb-2 block text-[0.6875rem]">{{ t('savings.color') }}</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="c in COLORS" :key="c" @click="form.color = c" class="h-7 w-7 rounded-full border-2 transition-all" :class="form.color === c ? 'scale-110 border-white' : 'border-transparent'" :style="{ backgroundColor: c }"></button>
            </div>
          </div>
          <CurrencyInput v-model="form.targetAmount" :placeholder="t('savings.targetPlaceholder')" className="border-border-default bg-bg-elevated text-text-primary placeholder:text-text-disabled focus:border-accent focus:ring-accent-subtle w-full rounded-lg border px-4 py-2.5 text-sm transition-all focus:ring-2 focus:outline-none" />
          
          <!-- AI Planner Widget -->
          <div v-if="form.targetAmount > 0" class="bg-accent/5 border border-accent/20 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden mt-1">
            <div class="flex gap-3">
              <img src="/images/cat_think_nobg.png" class="w-12 h-12 object-contain drop-shadow-md" alt="AI Mít" />
              <div class="flex-1">
                <div class="bg-white dark:bg-bg-elevated rounded-2xl rounded-tl-none p-3 text-sm text-text-primary shadow-sm border border-border-default relative">
                  {{ t('savings.aiPlannerText') }}
                </div>
              </div>
            </div>
            
            <div class="flex flex-wrap gap-2 ml-14">
              <button @click="planDurationMonths = 1" :class="planDurationMonths === 1 ? 'bg-accent text-white border-accent' : 'bg-bg-elevated text-text-secondary border-border-default hover:border-accent'" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all">{{ t('savings.oneMonth') }}</button>
              <button @click="planDurationMonths = 3" :class="planDurationMonths === 3 ? 'bg-accent text-white border-accent' : 'bg-bg-elevated text-text-secondary border-border-default hover:border-accent'" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all">{{ t('savings.threeMonths') }}</button>
              <button @click="planDurationMonths = 6" :class="planDurationMonths === 6 ? 'bg-accent text-white border-accent' : 'bg-bg-elevated text-text-secondary border-border-default hover:border-accent'" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all">{{ t('savings.sixMonths') }}</button>
              <button @click="planDurationMonths = 12" :class="planDurationMonths === 12 ? 'bg-accent text-white border-accent' : 'bg-bg-elevated text-text-secondary border-border-default hover:border-accent'" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all">{{ t('savings.oneYear') }}</button>
            </div>

            <div v-if="planDurationMonths" class="ml-14 bg-white dark:bg-bg-elevated rounded-xl p-3 border border-border-default shadow-sm">
              <p class="text-xs text-text-secondary mb-2">{{ t('savings.savingsSuggestion') }}</p>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-semibold text-text-primary">{{ formatVND(aiDailyAmount) }} <span class="text-[0.625rem] text-text-tertiary font-normal">{{ t('savings.perDayText') }}</span></span>
                <span class="text-text-disabled text-xs">{{ t('savings.or') }}</span>
                <span class="text-sm font-semibold text-text-primary">{{ formatVND(aiWeeklyAmount) }} <span class="text-[0.625rem] text-text-tertiary font-normal">{{ t('savings.perWeek') }}</span></span>
              </div>
              <button @click="applyAiPlan" class="w-full mt-2 bg-accent/10 text-accent hover:bg-accent/20 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all">
                <Zap :size="12" /> {{ t('savings.applyAiPlan', { amount: formatVND(aiDailyAmount) }) }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <CustomDatePicker
              v-model="form.deadline"
              :label="t('savings.deadline')"
              :placeholder="t('savings.deadline')"
            />
            <div v-if="form.autoSaveEnabled">
              <span class="text-text-tertiary mb-1 block text-[0.6875rem]">{{ t('savings.autoSaveSourceLabel') }}</span>
              <CustomSelect 
                v-model="form.autoSaveWalletId" 
                :options="walletOptions" 
                :placeholder="t('savings.chooseWallet')"
              />
            </div>
          </div>

          <div class="flex gap-2">
            <button @click="showAdd = false; planDurationMonths = null" class="border-border-default text-text-secondary hover:bg-bg-hover flex-1 rounded-lg border py-2 text-sm transition-all">{{ t('common.cancel') }}</button>
            <button @click="addGoal" :disabled="saving || !form.name.trim() || form.targetAmount <= 0" class="btn-primary flex-1 justify-center py-2 disabled:opacity-40">
              <AppSpinner v-if="saving" :size="16" />
              <template v-else>{{ t('common.add') }}</template>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Goals Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div v-if="!goals.length" class="sm:col-span-2 bg-bg-surface border-border-default flex flex-col items-center rounded-2xl border border-dashed py-12 text-center">
        <Target :size="48" class="text-text-disabled mb-4" />
        <h4 class="mb-2 text-lg font-semibold">{{ t('savings.empty') }}</h4>
        <p class="text-text-tertiary mb-6 text-sm">{{ t('savings.emptyHint') }}</p>
        <button @click="showAdd = true" class="btn-secondary"><Plus :size="16" /> {{ t('savings.add') }}</button>
      </div>

      <div v-for="g in goals" :key="g.id" class="bg-bg-surface border-border-default hover:border-border-strong rounded-xl border p-5 transition-all duration-150 relative overflow-hidden">
        <!-- Completed celebration -->
        <div v-if="pct(g) >= 100" class="absolute top-2 right-2"><PartyPopper :size="20" class="text-warning animate-bounce" /></div>

        <div class="flex items-center gap-3 mb-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl text-xl" :style="{ backgroundColor: g.color + '20' }">{{ g.icon }}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold min-w-0 wrap-break-word">{{ g.name }}</div>
            <div class="text-text-disabled text-[0.6875rem] flex items-center gap-1">
              <span v-if="daysLeft(g.deadline) !== null">{{ t('savings.daysLeft', { n: daysLeft(g.deadline) }) }}</span>
              <span v-if="g.autoSaveEnabled" class="text-accent flex items-center gap-0.5 ml-1"><Zap :size="10" /> Auto</span>
            </div>
          </div>
          <button v-if="g.autoSaveEnabled" @click="openAutoSave(g.id)" class="text-text-tertiary hover:text-accent p-1 rounded hover:bg-bg-hover transition-all"><Settings :size="14" /></button>
          <button v-else @click="openAutoSave(g.id)" class="bg-bg-elevated border border-border-default hover:border-accent text-text-primary px-2 py-1 rounded text-[0.6875rem] font-semibold transition-all">{{ t('savings.autoSaveEnable') }}</button>
          <button @click="deleteGoal(g.id)" class="text-text-tertiary hover:text-error p-1 rounded hover:bg-bg-hover transition-all"><Trash2 :size="14" /></button>
        </div>

        <!-- Progress -->
        <div class="mb-2">
          <div class="flex items-end justify-between mb-1">
            <span class="text-sm font-bold" :style="{ color: g.color }">{{ formatVND(g.currentAmount) }}</span>
            <span class="text-text-tertiary text-[0.6875rem]">{{ formatVND(g.targetAmount) }}</span>
          </div>
          <div class="bg-bg-elevated h-2.5 overflow-hidden rounded-full">
            <div class="h-full rounded-full transition-all duration-700" :style="{ width: pct(g) + '%', backgroundColor: g.color }"></div>
          </div>
          <div class="flex justify-between mt-1">
            <span class="text-text-disabled text-[0.625rem]">{{ pct(g).toFixed(0) }}%</span>
            <span v-if="dailySaveNeeded(g) > 0" class="text-text-disabled text-[0.625rem]">~{{ formatVND(dailySaveNeeded(g)) }}/{{ t('savings.perDay') }}</span>
          </div>
        </div>

        <!-- Deposit/Withdraw -->
        <div v-if="showDeposit === g.id" class="flex flex-col gap-2 mt-3 bg-bg-hover p-2 rounded-lg">
          <CustomSelect 
            v-model="depositWalletId" 
            :options="depositWalletOptions" 
            :placeholder="t('savings.autoSaveSourceExt')"
          />
          <div class="flex gap-2">
            <CurrencyInput v-model="depositAmount" placeholder="0" className="border-border-default bg-bg-elevated text-text-primary focus:border-accent w-full rounded-lg border px-3 py-1.5 text-sm focus:ring-1 focus:ring-accent-subtle focus:outline-none flex-1" />
            <button @click="deposit(g.id)" class="bg-success/15 text-success hover:bg-success/25 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"><ArrowUpRight :size="14" /></button>
            <button @click="withdraw(g.id)" class="bg-error/15 text-error hover:bg-error/25 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"><ArrowDownRight :size="14" /></button>
            <button @click="showDeposit = null; depositAmount = 0" class="text-text-tertiary hover:text-text-primary p-1"><X :size="14" /></button>
          </div>
        </div>
        <button v-else @click="showDeposit = g.id" class="mt-3 w-full border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary rounded-lg border py-2 text-xs font-medium transition-all">{{ t('savings.addMoney') }}</button>
      </div>
    </div>

    <!-- Smart Auto-Save Modal -->
    <div v-if="showAutoSave" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="bg-bg-surface border-border-default w-full max-w-md rounded-2xl border p-5 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold flex items-center gap-2"><Zap class="text-accent" :size="20" /> {{ t('savings.autoSaveTitle') }}</h3>
          <button @click="showAutoSave = null" class="text-text-tertiary hover:text-text-primary"><X :size="20" /></button>
        </div>
        <p class="text-sm text-text-secondary mb-4">{{ t('savings.autoSaveDesc') }}</p>
        
        <div class="space-y-4 mb-6">
          <div>
            <label class="text-xs text-text-tertiary mb-1 block">{{ t('savings.autoSaveSource') }}</label>
            <CustomSelect 
              v-model="autoSaveWalletId" 
              :options="walletOptions" 
              :placeholder="t('savings.autoSaveSource')"
            />
          </div>
          <div>
            <label class="text-xs text-text-tertiary mb-1 block">{{ t('savings.autoSaveAmount') }}</label>
            <CurrencyInput v-model="autoSaveAmount" className="border-border-default bg-bg-elevated text-text-primary focus:border-accent w-full rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none" />
          </div>
        </div>

        <div class="flex gap-3">
          <button v-if="goals.find(g => g.id === showAutoSave)?.autoSaveEnabled" @click="disableAutoSave(showAutoSave)" class="flex-1 py-2 rounded-lg border border-border-default text-error hover:bg-error/10 font-semibold transition-all">{{ t('savings.autoSaveDisable') }}</button>
          <button @click="enableAutoSave" class="btn-primary flex-1 justify-center py-2 shadow-lg shadow-accent/20">{{ t('savings.autoSaveEnable') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

