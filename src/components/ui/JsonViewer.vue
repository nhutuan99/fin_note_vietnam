<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import {
  Copy,
  Check,
  Search,
  X,
  Minimize2,
  Maximize2,
  Braces
} from 'lucide-vue-next'

const props = defineProps<{
  data: any
  rootName?: string
}>()

const searchQuery = ref('')
const showSearch = ref(false)
const copied = ref(false)
const globalCollapsed = ref(false)
const collapsedPaths = ref<Set<string>>(new Set())
const searchInput = ref<HTMLInputElement | null>(null)
const matchCount = ref(0)

// ── Helpers ──
function typeOf(val: any): string {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}

function childCount(val: any): number {
  if (Array.isArray(val)) return val.length
  if (typeof val === 'object' && val !== null) return Object.keys(val).length
  return 0
}

function togglePath(path: string) {
  if (collapsedPaths.value.has(path)) {
    collapsedPaths.value.delete(path)
  } else {
    collapsedPaths.value.add(path)
  }
  // Force reactivity
  collapsedPaths.value = new Set(collapsedPaths.value)
}

function expandAll() {
  globalCollapsed.value = false
  collapsedPaths.value = new Set()
}

function collapseAll() {
  globalCollapsed.value = true
  collapsedPaths.value = new Set()
}

// ── Search ──
function toggleSearch() {
  showSearch.value = !showSearch.value
  if (showSearch.value) {
    nextTick(() => searchInput.value?.focus())
  } else {
    searchQuery.value = ''
  }
}

// Count matches
watch(searchQuery, () => {
  if (!searchQuery.value) {
    matchCount.value = 0
    return
  }
  const q = searchQuery.value.toLowerCase()
  let count = 0
  function walk(val: any) {
    if (val === null || val === undefined) return
    if (typeof val === 'object') {
      for (const key of Object.keys(val)) {
        if (key.toLowerCase().includes(q)) count++
        walk(val[key])
      }
    } else {
      if (String(val).toLowerCase().includes(q)) count++
    }
  }
  walk(props.data)
  matchCount.value = count
})

// ── Copy ──
async function copyJson() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.data, null, 2))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {}
}

async function copyMinified() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(props.data))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {}
}
</script>

<template>
  <div class="json-viewer">
    <!-- Toolbar -->
    <div class="jv-toolbar">
      <div class="jv-toolbar-left">
        <Braces :size="14" class="jv-toolbar-icon" />
        <span class="jv-toolbar-title">JSON Viewer</span>
        <span class="jv-badge">{{ childCount(data) }} {{ typeOf(data) === 'array' ? 'items' : 'keys' }}</span>
      </div>
      <div class="jv-toolbar-right">
        <!-- Search -->
        <button class="jv-tool-btn" :class="{ active: showSearch }" @click="toggleSearch" title="Search">
          <Search :size="13" />
        </button>
        <!-- Expand All -->
        <button class="jv-tool-btn" @click="expandAll" title="Expand All">
          <Maximize2 :size="13" />
        </button>
        <!-- Collapse All -->
        <button class="jv-tool-btn" @click="collapseAll" title="Collapse All">
          <Minimize2 :size="13" />
        </button>
        <!-- Copy Formatted -->
        <button class="jv-tool-btn" @click="copyJson" title="Copy Formatted">
          <component :is="copied ? Check : Copy" :size="13" />
          <span class="jv-tool-label">{{ copied ? 'Copied!' : 'Copy' }}</span>
        </button>
        <!-- Copy Minified -->
        <button class="jv-tool-btn" @click="copyMinified" title="Copy Minified">
          <Minimize2 :size="13" />
          <span class="jv-tool-label">Min</span>
        </button>
      </div>
    </div>

    <!-- Search Bar -->
    <Transition name="slide-search">
      <div v-if="showSearch" class="jv-search-bar">
        <Search :size="13" class="jv-search-icon" />
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Search keys & values..."
          class="jv-search-input"
          @keyup.escape="toggleSearch"
        />
        <span v-if="searchQuery" class="jv-search-count">{{ matchCount }} match{{ matchCount !== 1 ? 'es' : '' }}</span>
        <button v-if="searchQuery" class="jv-search-clear" @click="searchQuery = ''">
          <X :size="12" />
        </button>
      </div>
    </Transition>

    <!-- Tree -->
    <div class="jv-tree">
      <JsonNode
        :value="data"
        :path="'$'"
        :depth="0"
        :collapsed-paths="collapsedPaths"
        :global-collapsed="globalCollapsed"
        :search="searchQuery"
        @toggle="togglePath"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h, type PropType, type VNode } from 'vue'
import { ChevronDown as ChevDown, ChevronRight as ChevRight } from 'lucide-vue-next'

const JsonNode: ReturnType<typeof defineComponent> = defineComponent({
  name: 'JsonNode',
  props: {
    value: { type: null as unknown as PropType<any>, required: true },
    path: { type: String, required: true },
    depth: { type: Number, default: 0 },
    keyName: { type: [String, Number], default: undefined },
    isLast: { type: Boolean, default: true },
    collapsedPaths: { type: Object as PropType<Set<string>>, required: true },
    globalCollapsed: { type: Boolean, default: false },
    search: { type: String, default: '' },
  },
  emits: ['toggle'],
  setup(props, { emit }): () => VNode {
    function getType(v: any): string {
      if (v === null) return 'null'
      if (Array.isArray(v)) return 'array'
      return typeof v
    }

    function isNodeCollapsed(): boolean {
      if (props.globalCollapsed && !props.collapsedPaths.has(props.path)) return true
      if (!props.globalCollapsed && props.collapsedPaths.has(props.path)) return true
      return false
    }

    function highlightText(text: string): string | VNode {
      if (!props.search) return text
      const idx = text.toLowerCase().indexOf(props.search.toLowerCase())
      if (idx === -1) return text
      const before = text.slice(0, idx)
      const match = text.slice(idx, idx + props.search.length)
      const after = text.slice(idx + props.search.length)
      return h('span', [before, h('mark', { class: 'jv-highlight' }, match), after])
    }

    return (): VNode => {
      const type = getType(props.value)
      const expandable = type === 'object' || type === 'array'
      const collapsed = expandable && isNodeCollapsed()
      const comma = props.isLast ? '' : ','
      const indent = props.depth * 18

      // Key label
      const keyLabel = props.keyName !== undefined
        ? h('span', { class: 'jv-key' }, [
            highlightText(typeof props.keyName === 'number' ? String(props.keyName) : `"${props.keyName}"`),
            h('span', { class: 'jv-colon' }, ': ')
          ])
        : null

      if (!expandable) {
        // Primitive value
        const valClass = `jv-val jv-${type}`
        let display: VNode
        if (type === 'string') {
          display = h('span', { class: valClass }, ['"', highlightText(props.value), '"'])
        } else if (type === 'null') {
          display = h('span', { class: valClass }, 'null')
        } else if (type === 'boolean') {
          display = h('span', { class: valClass }, String(props.value))
        } else {
          display = h('span', { class: valClass }, [highlightText(String(props.value))])
        }

        return h('div', {
          class: 'jv-line',
          style: { paddingLeft: `${indent}px` }
        }, [keyLabel, display, h('span', { class: 'jv-comma' }, comma)])
      }

      // Expandable (object / array)
      const openBrace = type === 'array' ? '[' : '{'
      const closeBrace = type === 'array' ? ']' : '}'
      const entries = type === 'array'
        ? (props.value as any[]).map((v: any, i: number) => ({ k: i, v }))
        : Object.entries(props.value).map(([k, v]: [string, any]) => ({ k, v }))

      // Toggle arrow
      const arrow = h('span', {
        class: 'jv-toggle',
        onClick: (e: MouseEvent) => { e.stopPropagation(); emit('toggle', props.path) }
      }, [h(collapsed ? ChevRight : ChevDown, { size: 12 })])

      if (collapsed) {
        const count = entries.length
        const preview = type === 'array'
          ? `Array(${count})`
          : (() => {
              const keys = Object.keys(props.value)
              return keys.length <= 3 ? keys.join(', ') : keys.slice(0, 3).join(', ') + ', …'
            })()

        return h('div', {
          class: 'jv-line jv-collapsed-line',
          style: { paddingLeft: `${indent}px` }
        }, [
          arrow,
          keyLabel,
          h('span', { class: 'jv-bracket' }, openBrace),
          h('span', {
            class: 'jv-preview',
            onClick: () => emit('toggle', props.path)
          }, ` ${preview} `),
          h('span', { class: 'jv-bracket' }, closeBrace),
          h('span', { class: 'jv-comma' }, comma),
          h('span', { class: 'jv-count-badge' }, `${count}`)
        ])
      }

      // Expanded
      const children: VNode[] = entries.map(({ k, v }: { k: string | number; v: any }, i: number) =>
        h(JsonNode as any, {
          value: v,
          path: `${props.path}.${k}`,
          depth: props.depth + 1,
          keyName: k,
          isLast: i === entries.length - 1,
          collapsedPaths: props.collapsedPaths,
          globalCollapsed: props.globalCollapsed,
          search: props.search,
          onToggle: (p: string) => emit('toggle', p)
        })
      )

      return h('div', { class: 'jv-node' }, [
        h('div', {
          class: 'jv-line',
          style: { paddingLeft: `${indent}px` }
        }, [arrow, keyLabel, h('span', { class: 'jv-bracket' }, openBrace)]),
        ...children,
        h('div', {
          class: 'jv-line',
          style: { paddingLeft: `${indent}px` }
        }, [h('span', { class: 'jv-bracket' }, closeBrace), h('span', { class: 'jv-comma' }, comma)])
      ])
    }
  }
})

export default { name: 'JsonViewerWrapper' }
</script>

<style scoped>
.json-viewer {
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--bg-elevated);
  overflow: hidden;
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.8125rem;
  line-height: 1.65;
}

/* ── Toolbar ── */
.jv-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-surface);
  gap: 8px;
  flex-wrap: wrap;
}

.jv-toolbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.jv-toolbar-icon { color: var(--accent); }

.jv-toolbar-title {
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
}

.jv-badge {
  font-size: 0.625rem;
  background: var(--accent-subtle);
  color: var(--accent);
  border-radius: 100px;
  padding: 1px 8px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
}

.jv-toolbar-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.jv-tool-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 0.6875rem;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  transition: all 120ms;
}
.jv-tool-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.jv-tool-btn.active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.jv-tool-label {
  display: none;
}
@media (min-width: 640px) {
  .jv-tool-label { display: inline; }
}

/* ── Search Bar ── */
.jv-search-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-surface);
}

.jv-search-icon { color: var(--text-disabled); flex-shrink: 0; }

.jv-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.8125rem;
  color: var(--text-primary);
  font-family: inherit;
}
.jv-search-input::placeholder { color: var(--text-disabled); }

.jv-search-count {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
}

.jv-search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}
.jv-search-clear:hover { background: var(--bg-hover); }

.slide-search-enter-active,
.slide-search-leave-active {
  transition: all 150ms ease;
  overflow: hidden;
}
.slide-search-enter-from,
.slide-search-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.slide-search-enter-to,
.slide-search-leave-from {
  max-height: 50px;
}

/* ── Tree ── */
.jv-tree {
  padding: 0.5rem 0.5rem;
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
}

.jv-tree :deep(.jv-line) {
  display: flex;
  align-items: baseline;
  min-height: 1.5em;
  white-space: nowrap;
}

.jv-tree :deep(.jv-toggle) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  cursor: pointer;
  color: var(--text-disabled);
  flex-shrink: 0;
  margin-right: 2px;
  border-radius: 3px;
  transition: all 100ms;
}
.jv-tree :deep(.jv-toggle:hover) {
  color: var(--accent);
  background: var(--accent-subtle);
}

.jv-tree :deep(.jv-key) {
  color: #c792ea;
}

.jv-tree :deep(.jv-colon) {
  color: var(--text-disabled);
  margin-right: 4px;
}

.jv-tree :deep(.jv-bracket) {
  color: var(--text-tertiary);
  font-weight: 600;
}

.jv-tree :deep(.jv-comma) {
  color: var(--text-disabled);
}

/* Value types */
.jv-tree :deep(.jv-val.jv-string) { color: #c3e88d; }
.jv-tree :deep(.jv-val.jv-number) { color: #f78c6c; }
.jv-tree :deep(.jv-val.jv-boolean) { color: #ff5370; }
.jv-tree :deep(.jv-val.jv-null) { color: #546e7a; font-style: italic; }

/* Collapsed preview */
.jv-tree :deep(.jv-preview) {
  color: var(--text-disabled);
  font-style: italic;
  font-size: 0.75rem;
  cursor: pointer;
  transition: color 100ms;
}
.jv-tree :deep(.jv-preview:hover) {
  color: var(--text-secondary);
}

.jv-tree :deep(.jv-count-badge) {
  font-size: 0.5625rem;
  background: var(--bg-hover);
  color: var(--text-tertiary);
  border-radius: 100px;
  padding: 0 5px;
  margin-left: 4px;
  font-family: 'Inter', sans-serif;
}

.jv-tree :deep(.jv-collapsed-line) {
  cursor: pointer;
}
.jv-tree :deep(.jv-collapsed-line:hover) {
  background: var(--bg-hover);
  border-radius: 4px;
}

/* Search highlights */
.jv-tree :deep(.jv-highlight) {
  background: rgba(255, 213, 79, 0.35);
  color: #ffd54f;
  border-radius: 2px;
  padding: 0 1px;
}

/* Light theme overrides */
[data-theme='light'] .jv-tree :deep(.jv-key) { color: #7c3aed; }
[data-theme='light'] .jv-tree :deep(.jv-val.jv-string) { color: #16a34a; }
[data-theme='light'] .jv-tree :deep(.jv-val.jv-number) { color: #ea580c; }
[data-theme='light'] .jv-tree :deep(.jv-val.jv-boolean) { color: #dc2626; }
[data-theme='light'] .jv-tree :deep(.jv-val.jv-null) { color: #94a3b8; }
[data-theme='light'] .jv-tree :deep(.jv-highlight) {
  background: rgba(250, 204, 21, 0.4);
  color: #92400e;
}
</style>
