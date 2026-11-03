<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import { useFinanceStore } from '@/stores/finance'
import { formatVND, formatVNDShort } from '@/constants/finance'
import { splitChi, joinChi, formatGrams, pickableGoldTypes, goldTag } from '@/shared/utils/gold'

/**
 * Picks a gold kind from the live price board and a quantity in cây / chỉ / phân,
 * and previews what it is worth at the shop's buy-back price.
 */
const props = defineProps<{ type: string; qtyChi: number }>()
const emit = defineEmits<{ 'update:type': [string]; 'update:qtyChi': [number] }>()

const { t, locale } = useI18n()
const finance = useFinanceStore()

onMounted(() => {
  if (!finance.goldPrices) void finance.fetchGoldPrices()
})

const types = computed(() => pickableGoldTypes(finance.goldPrices?.items ?? []))
const selected = computed(() => types.value.find((i) => i.code === props.type) ?? null)

const listRef = ref<HTMLElement | null>(null)

// Default to the first (most common) kind once the board arrives; when editing,
// bring the current kind into view (it can sit below the fold of the scrolling list)
watch(
  types,
  (list) => {
    if (!list.length) return
    if (!list.some((i) => i.code === props.type)) emit('update:type', list[0].code)
    void nextTick(() => {
      const list = listRef.value
      const active = list?.querySelector<HTMLElement>('.is-active')
      if (list && active && active.offsetTop + active.offsetHeight > list.clientHeight) {
        list.scrollTop = active.offsetTop - 8
      }
    })
  },
  { immediate: true }
)

const parts = reactive(splitChi(props.qtyChi))
watch(
  () => props.qtyChi,
  (q) => {
    if (joinChi(parts) !== q) Object.assign(parts, splitChi(q))
  }
)

function setPart(key: 'cay' | 'chi' | 'phan', raw: string) {
  const n = Number(raw.replace(',', '.'))
  parts[key] = isFinite(n) && n > 0 ? n : 0
  emit('update:qtyChi', joinChi(parts))
}

const value = computed(() => (selected.value ? Math.round(selected.value.buy * props.qtyChi) : 0))

const updatedAt = computed(() => {
  const iso = finance.goldPrices?.updatedAt
  if (!iso) return ''
  return new Date(iso).toLocaleString(locale.value === 'vi' ? 'vi-VN' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  })
})

const UNITS = ['cay', 'chi', 'phan'] as const
</script>

<template>
  <div class="gold-editor">
    <!-- Kind -->
    <div>
      <div class="gold-editor__head">
        <span class="gold-editor__label">{{ t('wallets.goldType') }}</span>
        <span v-if="finance.goldPrices" class="text-text-disabled text-[0.6875rem]">
          {{ finance.goldPrices.source }} · {{ updatedAt }}
        </span>
      </div>

      <div v-if="types.length" ref="listRef" class="gold-types" role="radiogroup" :aria-label="t('wallets.goldType')">
        <button
          v-for="item in types"
          :key="item.code"
          type="button"
          role="radio"
          :aria-checked="item.code === type"
          class="gold-type"
          :class="{ 'is-active': item.code === type }"
          @click="emit('update:type', item.code)"
        >
          <span class="gold-type__tag">{{ goldTag(item) }}</span>
          <span class="gold-type__name">{{ item.name }}</span>
          <span class="gold-type__price">
            <span>{{ formatVNDShort(item.buy) }}</span>
            <span v-if="item.sell" class="text-text-disabled">/ {{ formatVNDShort(item.sell) }}</span>
          </span>
        </button>
      </div>

      <div v-else-if="finance.goldPricesError" class="gold-editor__error">
        <span>{{ t('wallets.goldPricesError') }}</span>
        <button type="button" class="gold-editor__retry" @click="finance.fetchGoldPrices(true)">
          <RefreshCw :size="12" /> {{ t('wallets.goldRetry') }}
        </button>
      </div>
      <div v-else class="space-y-1.5">
        <div v-for="i in 4" :key="i" class="skeleton h-10 w-full rounded-lg" />
      </div>
      <p v-if="types.length" class="text-text-disabled mt-1.5 text-[0.6875rem]">{{ t('wallets.goldPriceLegend') }}</p>
    </div>

    <!-- Quantity -->
    <div>
      <div class="gold-editor__head">
        <span class="gold-editor__label">{{ t('wallets.goldQty') }}</span>
        <span v-if="qtyChi > 0" class="text-text-disabled text-[0.6875rem]">≈ {{ formatGrams(qtyChi) }}</span>
      </div>
      <div class="gold-qty">
        <label v-for="unit in UNITS" :key="unit" class="gold-qty__field">
          <input
            :value="parts[unit] || ''"
            type="number"
            inputmode="decimal"
            min="0"
            :step="unit === 'phan' ? 0.5 : 1"
            placeholder="0"
            class="gold-qty__input"
            @input="setPart(unit, ($event.target as HTMLInputElement).value)"
          />
          <span class="gold-qty__unit">{{ t(`wallets.unit_${unit}`) }}</span>
        </label>
      </div>
      <p class="text-text-disabled mt-1.5 text-[0.6875rem]">{{ t('wallets.goldUnitsHint') }}</p>
    </div>

    <!-- Value -->
    <div class="gold-value">
      <div class="min-w-0">
        <div class="text-text-tertiary text-[0.6875rem]">{{ t('wallets.goldValue') }}</div>
        <div class="gold-value__amount">{{ selected ? formatVND(value) : '—' }}</div>
      </div>
      <div v-if="selected" class="text-text-tertiary text-right text-[0.6875rem] leading-snug">
        {{ t('wallets.goldValueBasis') }}<br />
        <span class="text-text-secondary font-medium">{{ formatVND(selected.buy) }}/{{ t('wallets.unit_chi') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gold-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gold-editor__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.gold-editor__label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.gold-types {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.375rem;
  max-height: 16.5rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 0.125rem;
}

@media (min-width: 640px) {
  .gold-types {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.gold-type {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.625rem;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  text-align: left;
  transition: border-color 0.12s, background-color 0.12s;
}

.gold-type:hover {
  border-color: var(--border-strong);
}

.gold-type.is-active {
  border-color: var(--accent);
  background: var(--accent-subtle);
}

.gold-type__tag {
  flex-shrink: 0;
  min-width: 2.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  background: color-mix(in srgb, #d4a017 18%, transparent);
  color: #b8860b;
  font-size: 0.6875rem;
  font-weight: 700;
  text-align: center;
}

:global([data-theme='dark'] .gold-type__tag) {
  color: #e8c25a;
}

.gold-type__name {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.3;
  overflow-wrap: break-word;
}

.gold-type__price {
  display: flex;
  flex-shrink: 0;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.gold-editor__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.625rem;
  background: color-mix(in srgb, var(--error) 10%, transparent);
  color: var(--error);
  font-size: 0.8125rem;
}

.gold-editor__retry {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 600;
}

.gold-qty {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.gold-qty__field {
  position: relative;
  display: block;
}

.gold-qty__input {
  width: 100%;
  padding: 0.625rem 2.75rem 0.625rem 0.75rem;
  border-radius: 0.625rem;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  appearance: textfield;
  -moz-appearance: textfield;
}

.gold-qty__input::-webkit-outer-spin-button,
.gold-qty__input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.gold-qty__input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.gold-qty__unit {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--text-tertiary);
  pointer-events: none;
}

.gold-value {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid color-mix(in srgb, #d4a017 35%, transparent);
  background: color-mix(in srgb, #d4a017 8%, var(--bg-surface));
}

.gold-value__amount {
  font-size: 1.25rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
