<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Landmark, Copy, KeyRound, RefreshCw, Unplug, CheckCircle2, ExternalLink } from 'lucide-vue-next'
import { httpClient } from '@/shared/api/httpClient'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'

/**
 * SePay bank sync settings: SePay watches the linked bank account (TPBank…) and calls
 * FinNote's webhook on every money in/out. Here the user gets the webhook URL + API key
 * to paste into SePay (or saves SePay's HMAC secret), and sees whether events arrive.
 */
interface SepayStatus {
  connected: boolean
  webhookUrl: string
  keyHint: string | null
  hasHmacSecret: boolean
  lastEventAt: string | null
  events: number
}

const { t, locale } = useI18n()
const ui = useUiStore()
const isGuest = useAuthStore().isGuest

const status = ref<SepayStatus | null>(null)
/** Full key: only available right after it is created */
const newKey = ref('')
const secret = ref('')
const busy = ref(false)

onMounted(async () => {
  if (isGuest) return
  try {
    status.value = await httpClient.get<SepayStatus>('/api/integrations/sepay', { silent: true })
  } catch {
    /* shown as not connected */
  }
})

const lastEvent = computed(() =>
  status.value?.lastEventAt
    ? new Date(status.value.lastEventAt).toLocaleString(locale.value === 'vi' ? 'vi-VN' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      })
    : ''
)

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ui.showToast('success', t('autoSync.copySuccess'))
  } catch {
    ui.showToast('error', t('autoSync.copyFailed'))
  }
}

async function createKey() {
  if (status.value?.connected) {
    const ok = await ui.requestConfirm({
      title: t('autoSync.sepayRotateTitle'),
      message: t('autoSync.sepayRotateMessage'),
      confirmText: t('autoSync.sepayRotate')
    })
    if (!ok) return
  }
  if (!(await ui.requestPinValidation())) return
  busy.value = true
  try {
    const data = await httpClient.post<SepayStatus & { apiKey: string }>('/api/integrations/sepay/key', {})
    if (data) {
      newKey.value = data.apiKey
      status.value = data
    }
  } finally {
    busy.value = false
  }
}

async function saveSecret() {
  busy.value = true
  try {
    status.value = await httpClient.put<SepayStatus>('/api/integrations/sepay/secret', { secret: secret.value })
    secret.value = ''
    ui.showToast('success', t('autoSync.sepaySecretSaved'))
  } finally {
    busy.value = false
  }
}

async function disconnect() {
  const ok = await ui.requestConfirm({
    title: t('autoSync.sepayDisconnectTitle'),
    message: t('autoSync.sepayDisconnectMessage'),
    danger: true,
    confirmText: t('autoSync.sepayDisconnect')
  })
  if (!ok) return
  busy.value = true
  try {
    await httpClient.del('/api/integrations/sepay')
    if (status.value) status.value = { ...status.value, connected: false, keyHint: null, hasHmacSecret: false, lastEventAt: null, events: 0 }
    newKey.value = ''
  } finally {
    busy.value = false
  }
}

const STEPS = ['sepayStep1', 'sepayStep2', 'sepayStep3', 'sepayStep4', 'sepayStep5'] as const
</script>

<template>
  <section class="sepay card-premium">
    <header class="sepay__head">
      <div class="sepay__icon"><Landmark :size="20" /></div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 class="text-base font-bold">{{ t('autoSync.sepayTitle') }}</h3>
          <span v-if="status?.connected" class="sepay__badge"><CheckCircle2 :size="12" /> {{ t('autoSync.sepayConnected') }}</span>
        </div>
        <p class="text-text-secondary mt-1 text-[0.8125rem]">{{ t('autoSync.sepayDesc') }}</p>
      </div>
    </header>

    <p v-if="isGuest" class="text-text-tertiary mt-4 text-sm">{{ t('autoSync.sepayGuest') }}</p>

    <template v-else>
      <!-- Status -->
      <div v-if="status?.connected" class="sepay__status">
        <span v-if="status.events">{{ t('autoSync.sepayEvents', { n: status.events, time: lastEvent }) }}</span>
        <span v-else>{{ t('autoSync.sepayWaiting') }}</span>
      </div>

      <!-- Setup steps -->
      <ol class="sepay__steps">
        <li v-for="(key, i) in STEPS" :key="key">
          <span class="sepay__step-no">{{ i + 1 }}</span>
          <span class="min-w-0 wrap-break-word" v-html="t(`autoSync.${key}`)" />
        </li>
      </ol>

      <!-- Webhook URL + key -->
      <div v-if="status?.connected" class="sepay__fields">
        <div class="sepay__field">
          <div class="sepay__label">{{ t('autoSync.sepayUrl') }}</div>
          <div class="sepay__value">
            <code class="min-w-0 flex-1 wrap-anywhere">{{ status.webhookUrl }}</code>
            <button class="sepay__copy" :aria-label="t('autoSync.copy')" @click="copy(status.webhookUrl)"><Copy :size="14" /></button>
          </div>
        </div>

        <div class="sepay__field">
          <div class="sepay__label">{{ t('autoSync.sepayKey') }}</div>
          <div v-if="newKey" class="sepay__value sepay__value--new">
            <code class="min-w-0 flex-1 wrap-anywhere">{{ newKey }}</code>
            <button class="sepay__copy" :aria-label="t('autoSync.copy')" @click="copy(newKey)"><Copy :size="14" /></button>
          </div>
          <div v-else class="sepay__value">
            <code class="flex-1">{{ status.keyHint }}</code>
          </div>
          <p v-if="newKey" class="text-warning mt-1.5 text-xs">{{ t('autoSync.sepayKeyOnce') }}</p>
        </div>

        <!-- Optional: HMAC secret from SePay -->
        <div class="sepay__field">
          <div class="sepay__label">
            {{ t('autoSync.sepaySecret') }}
            <span v-if="status.hasHmacSecret" class="text-success normal-case">· {{ t('autoSync.sepaySecretSet') }}</span>
          </div>
          <div class="flex gap-2">
            <input
              v-model="secret"
              type="password"
              autocomplete="off"
              class="sepay__input"
              :placeholder="t('autoSync.sepaySecretPlaceholder')"
            />
            <button class="btn-primary shrink-0 px-4 text-xs" :disabled="busy || (!secret && !status.hasHmacSecret)" @click="saveSecret">
              {{ secret || !status.hasHmacSecret ? t('common.save') : t('autoSync.sepaySecretClear') }}
            </button>
          </div>
        </div>
      </div>

      <div class="sepay__actions">
        <button class="btn-primary" :disabled="busy" @click="createKey">
          <component :is="status?.connected ? RefreshCw : KeyRound" :size="15" />
          {{ status?.connected ? t('autoSync.sepayRotate') : t('autoSync.sepayCreate') }}
        </button>
        <a href="https://my.sepay.vn" target="_blank" rel="noopener" class="sepay__link">
          my.sepay.vn <ExternalLink :size="12" />
        </a>
        <button v-if="status?.connected" class="sepay__danger" :disabled="busy" @click="disconnect">
          <Unplug :size="14" /> {{ t('autoSync.sepayDisconnect') }}
        </button>
      </div>

      <p class="text-text-tertiary mt-4 text-xs">{{ t('autoSync.sepayNote') }}</p>
    </template>
  </section>
</template>

<style scoped>
.sepay {
  padding: 1.25rem;
}

@media (min-width: 640px) {
  .sepay {
    padding: 1.5rem;
  }
}

.sepay__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.875rem;
}

.sepay__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  background: var(--accent-subtle);
  color: var(--accent);
}

.sepay__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
  font-size: 0.75rem;
  font-weight: 600;
}

.sepay__status {
  margin-top: 1rem;
  padding: 0.625rem 0.875rem;
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.sepay__steps {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 1.25rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

.sepay__steps li {
  display: flex;
  gap: 0.625rem;
}

.sepay__steps :deep(strong) {
  color: var(--text-primary);
}

.sepay__step-no {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 0.6875rem;
  font-weight: 700;
}

.sepay__fields {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  margin-top: 1.25rem;
}

.sepay__label {
  margin-bottom: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.sepay__value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  font-size: 0.8125rem;
}

.sepay__value--new {
  border-color: color-mix(in srgb, var(--warning) 50%, var(--border-default));
}

.sepay__copy {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  color: var(--text-tertiary);
}

.sepay__copy:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.sepay__input {
  min-width: 0;
  flex: 1;
  height: 2.5rem;
  padding: 0 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.sepay__input:focus {
  outline: none;
  border-color: var(--accent);
}

.sepay__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  margin-top: 1.25rem;
}

.sepay__link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 600;
}

.sepay__danger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: 0.8125rem;
}

.sepay__danger:hover {
  color: var(--error);
}
</style>
