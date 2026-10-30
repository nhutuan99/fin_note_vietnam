<script setup lang="ts">
import { computed } from 'vue'
import { normalizeForSearch } from '@/shared/utils/noteText'

/**
 * Renders `text` with every occurrence of the query terms wrapped in <mark>.
 * Matching ignores case and Vietnamese diacritics; no v-html, so the text stays escaped.
 */
const props = defineProps<{
  text: string
  query?: string
}>()

const segments = computed(() => {
  const terms = normalizeForSearch(props.query?.trim() || '').split(/\s+/).filter(Boolean)
  if (!terms.length || !props.text) return [{ value: props.text, match: false }]

  // Normalize char by char, remembering which original index each normalized char came from
  let normalized = ''
  const origin: number[] = []
  Array.from(props.text).reduce((offset, ch) => {
    for (const n of normalizeForSearch(ch)) {
      normalized += n
      origin.push(offset)
    }
    return offset + ch.length
  }, 0)

  const marked = new Array<boolean>(props.text.length).fill(false)
  for (const term of terms) {
    let from = normalized.indexOf(term)
    while (from !== -1) {
      const start = origin[from]
      const endOrigin = origin[from + term.length - 1]
      // Cover the whole source code point at the end of the match
      const end = endOrigin + (props.text.codePointAt(endOrigin)! > 0xffff ? 2 : 1)
      for (let i = start; i < end; i++) marked[i] = true
      from = normalized.indexOf(term, from + term.length)
    }
  }

  const result: { value: string; match: boolean }[] = []
  for (let i = 0; i < props.text.length; i++) {
    const last = result[result.length - 1]
    if (last && last.match === marked[i]) last.value += props.text[i]
    else result.push({ value: props.text[i], match: marked[i] })
  }
  return result
})
</script>

<template>
  <template v-for="(seg, i) in segments" :key="i"><mark v-if="seg.match" class="search-hit">{{ seg.value }}</mark><template v-else>{{ seg.value }}</template></template>
</template>

<style scoped>
.search-hit {
  background: color-mix(in srgb, var(--warning) 30%, transparent);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}
</style>
