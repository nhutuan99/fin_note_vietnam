<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, Globe, Lock, Mail, Plus, Trash2, Check, Copy } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  noteId: string
  initialIsPublic: boolean
  initialSharedWith: string[]
}>()

const emit = defineEmits<{
  close: []
  save: [isPublic: boolean, sharedWith: string[]]
}>()

const { t } = useI18n()

const isPublic = ref(props.initialIsPublic)
const sharedWith = ref<string[]>([...props.initialSharedWith])
const newEmail = ref('')
const copied = ref(false)
const saving = ref(false)

watch(() => props.initialIsPublic, (val) => isPublic.value = val)
watch(() => props.initialSharedWith, (val) => sharedWith.value = [...val])

function addEmail() {
  const email = newEmail.value.trim().toLowerCase()
  if (email && /^\S+@\S+\.\S+$/.test(email) && !sharedWith.value.includes(email)) {
    sharedWith.value.push(email)
    newEmail.value = ''
  }
}

function removeEmail(email: string) {
  sharedWith.value = sharedWith.value.filter(e => e !== email)
}

function handleSave() {
  saving.value = true
  // Artificial delay for UI feedback
  setTimeout(() => {
    emit('save', isPublic.value, sharedWith.value)
    saving.value = false
  }, 300)
}

const shareLink = computed(() => {
  return `${window.location.origin}/notes/shared/${props.noteId}`
})

async function copyLink() {
  await navigator.clipboard.writeText(shareLink.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" @click.self="emit('close')">
    <div class="bg-bg-surface border-border-default w-full max-w-md rounded-2xl border p-6 shadow-2xl">
      <div class="mb-5 flex items-center justify-between">
        <h3 class="text-lg font-bold text-text-primary">{{ t('notes.share.title') }}</h3>
        <button
          class="text-text-tertiary hover:bg-bg-hover hover:text-text-primary rounded-lg p-2 transition-colors"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </div>

      <div class="space-y-5">
        <!-- Visibility Setting -->
        <div>
          <label class="text-text-secondary mb-3 block text-sm font-medium">{{ t('notes.share.access') }}</label>
          <div class="grid grid-cols-2 gap-3">
            <button
              class="border-border-default bg-bg-elevated flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors"
              :class="!isPublic ? '!border-accent !bg-accent-subtle/30 text-accent' : 'text-text-secondary hover:bg-bg-hover'"
              @click="isPublic = false"
            >
              <Lock :size="24" :class="!isPublic ? 'text-accent' : 'text-text-tertiary'" />
              <span class="text-sm font-semibold">{{ t('notes.share.private') }}</span>
              <span class="text-text-tertiary text-center text-[0.6875rem]">{{ t('notes.share.privateDesc') }}</span>
            </button>
            <button
              class="border-border-default bg-bg-elevated flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors"
              :class="isPublic ? '!border-accent !bg-accent-subtle/30 text-accent' : 'text-text-secondary hover:bg-bg-hover'"
              @click="isPublic = true"
            >
              <Globe :size="24" :class="isPublic ? 'text-accent' : 'text-text-tertiary'" />
              <span class="text-sm font-semibold">{{ t('notes.share.public') }}</span>
              <span class="text-text-tertiary text-center text-[0.6875rem]">{{ t('notes.share.publicDesc') }}</span>
            </button>
          </div>
        </div>

        <!-- Email Invites -->
        <div v-if="!isPublic">
          <label class="text-text-secondary mb-2 block text-sm font-medium">{{ t('notes.share.inviteEmail') }}</label>
          <div class="flex gap-2">
            <div class="border-border-default bg-bg-elevated flex flex-1 items-center rounded-lg border px-3">
              <Mail :size="16" class="text-text-tertiary mr-2" />
              <input
                v-model="newEmail"
                type="email"
                :placeholder="t('notes.share.emailPlaceholder')"
                class="w-full bg-transparent py-2 text-sm text-text-primary focus:outline-none"
                @keyup.enter="addEmail"
              />
            </div>
            <button
              class="bg-bg-elevated border-border-default hover:bg-bg-hover text-text-primary rounded-lg border px-3 transition-colors"
              @click="addEmail"
            >
              <Plus :size="18" />
            </button>
          </div>
          
          <div v-if="sharedWith.length > 0" class="mt-3 flex flex-col gap-2">
            <div
              v-for="email in sharedWith"
              :key="email"
              class="border-border-subtle bg-bg-elevated flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span class="text-text-secondary truncate">{{ email }}</span>
              <button
                class="text-text-tertiary hover:text-error transition-colors"
                @click="removeEmail(email)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
        </div>

        <!-- Share Link -->
        <div>
          <label class="text-text-secondary mb-2 block text-sm font-medium">{{ t('notes.share.shareLink') }}</label>
          <div class="border-border-default bg-bg-elevated flex items-center justify-between rounded-lg border p-1 pl-3">
            <span class="text-text-tertiary truncate text-xs">{{ shareLink }}</span>
            <button
              class="bg-bg-surface border-border-default hover:bg-bg-hover flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
              :class="copied ? 'text-success' : 'text-text-primary'"
              @click="copyLink"
            >
              <component :is="copied ? Check : Copy" :size="14" />
              {{ copied ? t('notes.share.copySuccess') : t('notes.share.copy') }}
            </button>
          </div>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <button
          class="text-text-secondary hover:bg-bg-hover rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          @click="emit('close')"
          :disabled="saving"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="bg-accent text-accent-fg hover:opacity-90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
          @click="handleSave"
          :disabled="saving"
        >
          <AppSpinner v-if="saving" :size="16"  />
          {{ t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>
