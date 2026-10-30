<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SlashCommandItem } from './slashCommand'

const props = defineProps<{
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}>()

const { t } = useI18n()
const selected = ref(0)
const listRef = ref<HTMLElement | null>(null)

const groups = computed(() => {
  const map = new Map<string, { item: SlashCommandItem; index: number }[]>()
  props.items.forEach((item, index) => {
    if (!map.has(item.group)) map.set(item.group, [])
    map.get(item.group)!.push({ item, index })
  })
  return Array.from(map.entries())
})

watch(
  () => props.items,
  () => {
    selected.value = 0
  }
)

watch(selected, async (index) => {
  await nextTick()
  listRef.value?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
})

function choose(index: number) {
  const item = props.items[index]
  if (item) props.command(item)
}

/** Called by the suggestion plugin; returns true when the key was handled here. */
function onKeyDown(event: KeyboardEvent): boolean {
  if (!props.items.length) return false
  if (event.key === 'ArrowDown') {
    selected.value = (selected.value + 1) % props.items.length
    return true
  }
  if (event.key === 'ArrowUp') {
    selected.value = (selected.value - 1 + props.items.length) % props.items.length
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    choose(selected.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<template>
  <div ref="listRef" class="slash-menu" role="listbox" :aria-label="t('editor.slash.label')">
    <template v-if="items.length">
      <div v-for="[group, entries] in groups" :key="group" class="slash-menu__group">
        <div class="slash-menu__group-label">{{ group }}</div>
        <button
          v-for="{ item, index } in entries"
          :key="item.id"
          :data-index="index"
          role="option"
          :aria-selected="index === selected"
          class="slash-menu__item"
          :class="{ 'is-selected': index === selected }"
          @mouseenter="selected = index"
          @mousedown.prevent="choose(index)"
        >
          <span class="slash-menu__icon"><component :is="item.icon" :size="16" /></span>
          <span class="slash-menu__text">
            <span class="slash-menu__title">{{ item.title }}</span>
            <span class="slash-menu__desc">{{ item.description }}</span>
          </span>
        </button>
      </div>
    </template>
    <div v-else class="slash-menu__empty">{{ t('editor.slash.empty') }}</div>
  </div>
</template>

<style scoped>
.slash-menu {
  width: 17rem;
  max-height: 20rem;
  overflow-y: auto;
  padding: 0.375rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
  animation: slashIn 0.12s ease-out;
}

@keyframes slashIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: none; }
}

.slash-menu__group + .slash-menu__group {
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--border-subtle);
}

.slash-menu__group-label {
  padding: 0.375rem 0.5rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.slash-menu__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  text-align: left;
}

.slash-menu__item.is-selected {
  background: var(--bg-hover);
}

.slash-menu__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.slash-menu__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.slash-menu__title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
}

.slash-menu__desc {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slash-menu__empty {
  padding: 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}
</style>
