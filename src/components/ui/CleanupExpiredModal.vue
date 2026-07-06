<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReminderStore } from '@/stores/reminders'
import { useUiStore } from '@/stores/ui'
import type { Reminder } from '@/types'
import { X, Trash2, Clock, CheckSquare, Square } from 'lucide-vue-next'
import AppSpinner from '@/components/ui/AppSpinner.vue'

const props = defineProps<{
  reminders: Reminder[]
}>()

const emit = defineEmits<{
  close: []
  cleaned: []
}>()

const { t, locale } = useI18n()
const store = useReminderStore()
const ui = useUiStore()

const selectedIds = ref<Set<string>>(new Set(props.reminders.map(r => r.id)))
const isCleaning = ref(false)

const isAllSelected = computed(() => selectedIds.value.size === props.reminders.length && props.reminders.length > 0)
const isIndeterminate = computed(() => selectedIds.value.size > 0 && selectedIds.value.size < props.reminders.length)

function toggleAll() {
  if (isAllSelected.value) {
    selectedIds.value.clear()
  } else {
    props.reminders.forEach(r => selectedIds.value.add(r.id))
  }
}

function toggleSelection(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(locale.value, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function handleCleanup() {
  if (selectedIds.value.size === 0 || isCleaning.value) return
  isCleaning.value = true
  
  try {
    if (isAllSelected.value) {
      // Use bulk delete if all are selected
      const success = await store.clear('expired')
      if (!success) throw new Error('Failed')
    } else {
      // Delete individually
      const ids = Array.from(selectedIds.value)
      await Promise.all(ids.map(id => store.remove(id)))
    }
    ui.showToast('success', t('reminders.cleanupSuccess'))
    emit('cleaned')
  } catch (error) {
    ui.showToast('error', t('common.somethingWentWrong'))
  } finally {
    isCleaning.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center shrink-0">
            <Trash2 :size="20" />
          </div>
          <div>
            <h3 class="text-lg font-bold">{{ t('reminders.cleanupModalTitle') }}</h3>
            <p class="text-sm text-text-tertiary">{{ t('reminders.cleanupDesc', { n: reminders.length }) }}</p>
          </div>
        </div>
        <button @click="emit('close')" class="modal-close">
          <X :size="20" />
        </button>
      </div>

      <div class="modal-body">
        <div class="flex items-center gap-3 p-3 mb-2 rounded-xl bg-bg-elevated cursor-pointer hover:bg-bg-hover transition-colors" @click="toggleAll">
          <div class="text-accent">
            <CheckSquare v-if="isAllSelected" :size="20" />
            <div v-else-if="isIndeterminate" class="w-5 h-5 rounded border border-accent bg-accent/20 flex items-center justify-center">
              <div class="w-2.5 h-0.5 bg-accent rounded-full"></div>
            </div>
            <Square v-else :size="20" class="text-text-tertiary" />
          </div>
          <span class="text-sm font-semibold text-text-primary">{{ t('common.selectAll') }}</span>
        </div>

        <div class="list-container">
          <div 
            v-for="r in reminders" 
            :key="r.id"
            class="list-item"
            :class="{ 'is-selected': selectedIds.has(r.id) }"
            @click="toggleSelection(r.id)"
          >
            <div class="item-checkbox text-accent">
              <CheckSquare v-if="selectedIds.has(r.id)" :size="18" />
              <Square v-else :size="18" class="text-text-disabled" />
            </div>
            <div class="item-content min-w-0">
              <div class="text-sm font-medium text-text-primary truncate mb-0.5" :class="{ 'opacity-70 line-through': selectedIds.has(r.id) }">{{ r.title }}</div>
              <div class="text-[0.6875rem] text-text-tertiary flex items-center gap-1 opacity-80">
                <Clock :size="10" /> {{ formatDateTime(r.eventDate) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="emit('close')" class="btn-cancel" :disabled="isCleaning">
          {{ t('common.cancel') }}
        </button>
        <button 
          @click="handleCleanup" 
          class="btn-delete"
          :disabled="selectedIds.size === 0 || isCleaning"
        >
          <AppSpinner v-if="isCleaning" :size="16" />
          <Trash2 v-else :size="16" />
          {{ isAllSelected ? t('reminders.deleteAllSelected') : t('reminders.deleteSelected', { n: selectedIds.size }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

.modal-container {
  width: 100%;
  max-width: 28rem;
  background: var(--bg-surface);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-default);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { 
  from { transform: translateY(20px) scale(0.95); opacity: 0; } 
  to { transform: translateY(0) scale(1); opacity: 1; } 
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 1rem 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 40vh;
  overflow-y: auto;
  padding-right: 0.25rem;
}

/* Custom Scrollbar */
.list-container::-webkit-scrollbar { width: 4px; }
.list-container::-webkit-scrollbar-track { background: transparent; }
.list-container::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }

.list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: var(--radius-xl);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  cursor: pointer;
  transition: all 0.2s;
}

.list-item:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.list-item.is-selected {
  background: rgba(251, 113, 133, 0.05); /* very light red */
  border-color: rgba(251, 113, 133, 0.3);
}

.item-checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.list-item.is-selected .item-checkbox {
  color: var(--error);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-default);
}

.btn-cancel {
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.btn-delete {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  background: var(--error);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(251, 113, 133, 0.2);
}

.btn-delete:hover:not(:disabled) {
  background: #e11d48; /* slightly darker red */
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(251, 113, 133, 0.3);
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}
</style>
