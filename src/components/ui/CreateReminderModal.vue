<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReminderStore } from '@/stores/reminders'
import { useUiStore } from '@/stores/ui'
import type { Reminder } from '@/types'
import { X, Bell, CalendarDays, Clock, Save, Repeat, Plus, Link, ExternalLink, Sparkles } from 'lucide-vue-next'
import CustomTimePicker from './CustomTimePicker.vue'
import AppSpinner from '@/components/ui/AppSpinner.vue'
import LogoLoader from '@/components/ui/LogoLoader.vue'

const props = defineProps<{
  reminder?: Reminder | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
  suggestions: [suggestions: any[]]
}>()

const { t } = useI18n()
const store = useReminderStore()
const ui = useUiStore()

const isEditing = computed(() => !!props.reminder?.id)

const title = ref('')
const description = ref('')
const eventDate = ref('')
const eventTime = ref('09:00')
const selectedOffsets = ref<string[]>(['1h', '1d'])
const customDate = ref('')
const customTime = ref('')
const showCustomInput = ref(false)
const repeatInterval = ref('none')
const saving = ref(false)

const offsetOptions = computed(() => [
  { key: '15m', label: t('reminders.offset15m'), group: 'time' },
  { key: '30m', label: t('reminders.offset30m'), group: 'time' },
  { key: '1h', label: t('reminders.offset1h'), group: 'time' },
  { key: '2h', label: t('reminders.offset2h'), group: 'time' },
  { key: '3h', label: t('reminders.offset3h'), group: 'time' },
  { key: '1d', label: t('reminders.offset1d'), group: 'day' },
  { key: '2d', label: t('reminders.offset2d'), group: 'day' },
  { key: '3d', label: t('reminders.offset3d'), group: 'day' },
  { key: '1w', label: t('reminders.offset1w'), group: 'day' },
])

const repeatOptions = computed(() => [
  { key: 'none', label: t('reminders.repeatNone') },
  { key: 'daily', label: t('reminders.repeatDaily') },
  { key: 'weekly', label: t('reminders.repeatWeekly') },
  { key: 'monthly', label: t('reminders.repeatMonthly') },
])

const timeOffsets = computed(() => offsetOptions.value.filter(o => o.group === 'time'))
const dayOffsets = computed(() => offsetOptions.value.filter(o => o.group === 'day'))

const currentStep = ref(1)

const aiInput = ref('')
const processingAi = ref(false)

async function handleAiSubmit() {
  if (!aiInput.value.trim() || processingAi.value) return
  processingAi.value = true
  try {
    const suggestions = await store.detectFromText(aiInput.value)
    if (suggestions.length > 0) {
      emit('suggestions', suggestions)
    } else {
      ui.showToast('info', t('reminders.noEventsFound'))
    }
  } catch {
    ui.showToast('error', t('common.somethingWentWrong'))
  } finally {
    processingAi.value = false
  }
}

function toggleOffset(key: string) {
  const idx = selectedOffsets.value.indexOf(key)
  if (idx === -1) selectedOffsets.value.push(key)
  else selectedOffsets.value.splice(idx, 1)
}

const isStep1Valid = computed(() => {
  return title.value.trim() && eventDate.value
})

const isValid = computed(() => {
  return isStep1Valid.value && (selectedOffsets.value.length > 0 || (customDate.value && customTime.value))
})

function getLocalDateString(d: Date) {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().split('T')[0]
}

onMounted(() => {
  if (props.reminder) {
    title.value = props.reminder.title
    description.value = props.reminder.description || ''
    selectedOffsets.value = [...(props.reminder.offsets || ['1h', '1d'])]
    repeatInterval.value = props.reminder.repeatInterval || 'none'
    const d = new Date(props.reminder.eventDate)
    if (!isNaN(d.getTime())) {
      eventDate.value = getLocalDateString(d)
      eventTime.value = d.toTimeString().substring(0, 5)
    }
    if (props.reminder.customRemindAt) {
      const cd = new Date(props.reminder.customRemindAt)
      if (!isNaN(cd.getTime())) {
        customDate.value = getLocalDateString(cd)
        customTime.value = cd.toTimeString().substring(0, 5)
        showCustomInput.value = true
      }
    }
  } else {
    const now = new Date()
    if (now.getHours() < 9) {
      eventDate.value = getLocalDateString(now)
      eventTime.value = '09:00'
    } else if (now.getHours() < 16) {
      eventDate.value = getLocalDateString(now)
      eventTime.value = '16:00'
    } else {
      now.setDate(now.getDate() + 1)
      eventDate.value = getLocalDateString(now)
      eventTime.value = '09:00'
    }
  }

  nextTick(() => {
    const el = document.getElementById('reminder-title-input')
    if (el) el.focus()
  })
})

function computeCustomRemindAt(): string | undefined {
  if (!customDate.value || !customTime.value) return undefined
  return new Date(`${customDate.value}T${customTime.value}:00`).toISOString()
}

async function handleSave() {
  if (!isValid.value || saving.value) return
  saving.value = true

  const eventDateTime = `${eventDate.value}T${eventTime.value}:00`
  const customRemindAt = computeCustomRemindAt()

  try {
    if (isEditing.value && props.reminder) {
      const result = await store.update(props.reminder.id, {
        title: title.value.trim(),
        description: description.value.trim(),
        eventDate: new Date(eventDateTime).toISOString(),
        offsets: selectedOffsets.value,
        customRemindAt,
        repeatInterval: repeatInterval.value,
      })
      if (result) { ui.showToast('success', t('reminders.updated')); emit('saved') }
    } else {
      const result = await store.create({
        title: title.value.trim(),
        description: description.value.trim(),
        eventDate: new Date(eventDateTime).toISOString(),
        offsets: selectedOffsets.value,
        customRemindAt,
        repeatInterval: repeatInterval.value,
        sourceType: props.reminder?.sourceType,
        sourceId: props.reminder?.sourceId,
      })
      if (result) { ui.showToast('success', t('reminders.created')); emit('saved') }
    }
  } catch {
    ui.showToast('error', t('common.somethingWentWrong'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal-container">
        <!-- Header -->
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <Bell :size="18" class="text-accent" />
            <h2 class="text-lg font-bold">
              {{ isEditing ? t('reminders.edit') : t('reminders.create') }}
            </h2>
          </div>
          <button @click="emit('close')" class="modal-close-btn"><X :size="18" /></button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <template v-if="currentStep === 1">
            <!-- AI Quick Add -->
            <div v-if="!isEditing" class="mb-6">
              <label class="flex items-center gap-2 text-sm font-bold text-accent mb-2">
                <Sparkles :size="16" /> {{ t('reminders.aiQuickAdd') }}
              </label>
              <div class="relative group">
                <textarea
                  v-model="aiInput"
                  rows="2"
                  :placeholder="t('reminders.aiPlaceholder')"
                  class="w-full bg-bg-surface border border-border-default focus:border-accent focus:ring-2 focus:ring-accent/20 rounded-xl text-sm transition-all duration-200 outline-none text-text-primary placeholder:text-text-disabled shadow-sm resize-none p-3 pr-14"
                  @keydown.enter.prevent="handleAiSubmit"
                />
                <button 
                  @click="handleAiSubmit" 
                  :disabled="!aiInput.trim() || processingAi"
                  class="absolute bottom-2 right-2 p-1.5 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  <AppSpinner v-if="processingAi" :size="16"  />
                  <Sparkles v-else :size="16" />
                </button>
              </div>
              <div class="flex items-center gap-3 my-5">
                <div class="flex-1 h-px bg-border-default"></div>
                <span class="text-[0.6875rem] text-text-tertiary uppercase font-bold tracking-wider">{{ t('reminders.orManual') }}</span>
                <div class="flex-1 h-px bg-border-default"></div>
              </div>
            </div>

            <!-- Title -->
            <div class="field">
              <label class="field-label">{{ t('reminders.titleField') }} *</label>
              <input
                id="reminder-title-input"
                v-model="title"
                type="text"
                class="field-input"
                :placeholder="t('reminders.titlePlaceholder')"
                maxlength="100"
              />
            </div>

            <!-- Description -->
            <div class="field">
              <label class="field-label">{{ t('reminders.descField') }}</label>
              <textarea
                v-model="description"
                class="field-input field-textarea"
                :placeholder="t('reminders.descPlaceholder')"
                rows="4"
                maxlength="1000"
              />
            </div>

            <!-- Date & Time -->
            <div class="field-row">
              <div class="field flex-1">
                <CustomDatePicker v-model="eventDate" :label="t('reminders.eventDate')" />
              </div>
              <div class="field" style="width: 8.5rem">
                <CustomTimePicker v-model="eventTime" :label="t('reminders.eventTime')" />
              </div>
            </div>
          </template>

          <template v-if="currentStep === 2">

          <!-- Offset Selector -->
          <div class="field">
            <label class="field-label">{{ t('reminders.offsets') }} *</label>
            <p class="text-text-disabled text-[0.6875rem] mb-2">{{ t('reminders.offsetsHint') }}</p>

            <div class="offset-section">
              <span class="offset-section-label">⏱ {{ t('reminders.beforeHours') }}</span>
              <div class="offset-chips">
                <button
                  v-for="opt in timeOffsets" :key="opt.key"
                  @click="toggleOffset(opt.key)"
                  class="offset-chip"
                  :class="{ 'offset-chip--active': selectedOffsets.includes(opt.key) }"
                >{{ opt.label }}</button>
              </div>
            </div>

            <div class="offset-section">
              <span class="offset-section-label">📅 {{ t('reminders.beforeDays') }}</span>
              <div class="offset-chips">
                <button
                  v-for="opt in dayOffsets" :key="opt.key"
                  @click="toggleOffset(opt.key)"
                  class="offset-chip"
                  :class="{ 'offset-chip--active': selectedOffsets.includes(opt.key) }"
                >{{ opt.label }}</button>
              </div>
            </div>
          </div>

          <!-- Custom Reminder Time -->
          <div class="field">
            <button
              v-if="!showCustomInput"
              @click="showCustomInput = true"
              class="custom-time-toggle"
            >
              <Plus :size="14" />
              {{ t('reminders.addCustomTime') }}
            </button>
            <template v-else>
              <label class="field-label">🕐 {{ t('reminders.customTime') }}</label>
              <div class="field-row" style="align-items: flex-start">
                <div class="flex-1"><CustomDatePicker v-model="customDate" /></div>
                <div style="width: 8.5rem"><CustomTimePicker v-model="customTime" /></div>
                <button @click="showCustomInput = false; customDate = ''; customTime = ''" class="custom-remove-btn" style="height: 2.625rem; margin-top: 0">
                  <X :size="14" />
                </button>
              </div>
            </template>
          </div>

          <!-- Repeat Interval -->
          <div class="field">
            <label class="field-label">
              <Repeat :size="14" class="inline-block mr-1" />
              {{ t('reminders.repeat') }}
            </label>
            <div class="repeat-chips">
              <button
                v-for="opt in repeatOptions" :key="opt.key"
                @click="repeatInterval = opt.key"
                class="offset-chip"
                :class="{ 'offset-chip--active': repeatInterval === opt.key }"
              >{{ opt.label }}</button>
            </div>
          </div>

          <!-- Last-chance info -->
          <div class="info-banner">
            <span class="text-warning">🛡</span>
            <span class="text-[0.6875rem] text-text-tertiary">
              {{ t('reminders.lastChanceInfo') }}
            </span>
          </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <template v-if="currentStep === 1">
            <button @click="emit('close')" class="btn-cancel">{{ t('common.cancel') }}</button>
            <button @click="currentStep = 2" :disabled="!isStep1Valid" class="btn-save">
              {{ t('common.continue') }}
            </button>
          </template>
          <template v-else>
            <button @click="currentStep = 1" class="btn-cancel">{{ t('common.goBack') }}</button>
            <button @click="handleSave" :disabled="!isValid || saving" class="btn-save">
              <span v-if="saving" class="spinner" />
              <Save v-else :size="15" />
              {{ isEditing ? t('common.save') : t('reminders.create') }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; z-index: var(--z-modal);
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  padding: 1rem; animation: fadeIn 0.15s ease;
}
.modal-container {
  width: 100%; max-width: 36rem; max-height: 90vh;
  display: flex; flex-direction: column;
  border-radius: var(--radius-xl); background: var(--bg-surface);
  border: 1px solid var(--border-default); box-shadow: var(--shadow-lg);
  animation: scaleIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-default);
}
.modal-close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 2rem; height: 2rem; border-radius: var(--radius-sm);
  background: none; border: none; color: var(--text-tertiary); cursor: pointer;
  transition: all 0.15s ease;
}
.modal-close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.modal-body {
  padding: 1.5rem;
  display: flex; flex-direction: column; gap: 1.25rem;
}
.field-label {
  display: flex; align-items: center;
  font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);
  margin-bottom: 0.375rem; text-transform: uppercase; letter-spacing: 0.03em;
}
.field-input {
  width: 100%; padding: 0.625rem 0.875rem; border-radius: var(--radius-md);
  background: var(--bg-elevated); border: 1px solid var(--border-default);
  color: var(--text-primary); font-size: 0.875rem; transition: border-color 0.15s ease; outline: none;
}
.field-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-subtle); }
.field-input::placeholder { color: var(--text-disabled); }
.field-textarea { resize: vertical; min-height: 5.5rem; }
.field-row { display: flex; gap: 0.75rem; align-items: flex-end; }

.offset-section { margin-bottom: 0.75rem; }
.offset-section-label {
  display: block; font-size: 0.6875rem; font-weight: 500;
  color: var(--text-tertiary); margin-bottom: 0.5rem;
}
.offset-chips, .repeat-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.offset-chip {
  padding: 0.375rem 0.75rem; border-radius: var(--radius-full);
  font-size: 0.75rem; font-weight: 500;
  background: var(--bg-elevated); color: var(--text-secondary);
  border: 1px solid var(--border-default); cursor: pointer; transition: all 0.15s ease;
}
.offset-chip:hover { border-color: var(--accent); color: var(--accent); }
.offset-chip--active {
  background: var(--accent-subtle); color: var(--accent);
  border-color: var(--accent); font-weight: 600;
}

/* Custom time toggle */
.custom-time-toggle {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.5rem 0.875rem; border-radius: var(--radius-md);
  font-size: 0.8125rem; font-weight: 500;
  color: var(--accent); background: var(--accent-subtle);
  border: 1px dashed rgba(142, 125, 250, 0.3); cursor: pointer;
  transition: all 0.15s ease; width: 100%;
}
.custom-time-toggle:hover { background: rgba(142, 125, 250, 0.15); border-style: solid; }
.custom-remove-btn {
  display: flex; align-items: center; justify-content: center;
  width: 2.25rem; height: 2.25rem; border-radius: var(--radius-md);
  background: var(--bg-elevated); border: 1px solid var(--border-default);
  color: var(--text-tertiary); cursor: pointer; transition: all 0.15s ease; flex-shrink: 0;
}
.custom-remove-btn:hover { color: var(--error); border-color: var(--error); }

/* Info banner */
.info-banner {
  display: flex; align-items: flex-start; gap: 0.5rem;
  padding: 0.625rem 0.875rem; border-radius: var(--radius-md);
  background: rgba(251, 191, 36, 0.06); border: 1px solid rgba(251, 191, 36, 0.15);
}

.modal-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;
  padding: 1rem 1.5rem; border-top: 1px solid var(--border-default);
}
.btn-cancel {
  padding: 0.5rem 1rem; border-radius: var(--radius-md);
  font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary);
  background: var(--bg-elevated); border: 1px solid var(--border-default);
  cursor: pointer; transition: all 0.15s ease;
}
.btn-cancel:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-save {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 1.25rem; border-radius: var(--radius-md);
  font-size: 0.8125rem; font-weight: 600; color: #fff;
  background: var(--accent); border: none; cursor: pointer; transition: all 0.15s ease;
}
.btn-save:hover:not(:disabled) { background: var(--accent-hover); }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.spinner {
  width: 1rem; height: 1rem; border: 2px solid rgba(255,255,255,0.3);
  border-left-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

input[type="date"], input[type="time"] { color-scheme: dark; }
[data-theme='light'] input[type="date"],
[data-theme='light'] input[type="time"] { color-scheme: light; }

@media (max-width: 480px) {
  .modal-container { max-height: 95vh; border-radius: var(--radius-lg); }
  .modal-body { padding: 1rem; }
  .field-row { flex-direction: column; }
  .field-row .field { width: 100% !important; }
  .field-row input[style] { width: 100% !important; }
}
</style>
