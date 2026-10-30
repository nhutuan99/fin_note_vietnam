import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { exitSuggestion, type SuggestionProps } from '@tiptap/suggestion'
import { VueRenderer } from '@tiptap/vue-3'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import type { Component } from 'vue'
import { normalizeForSearch } from '@/shared/utils/noteText'
import SlashMenu from './SlashMenu.vue'

export interface SlashCommandItem {
  id: string
  title: string
  description: string
  icon: Component
  group: string
  /** Extra search words (English aliases, markdown syntax…) */
  keywords: string[]
  run: (editor: Editor, range: Range) => void
}

const slashPluginKey = new PluginKey('slashCommand')

function matches(item: SlashCommandItem, query: string) {
  if (!query) return true
  const q = normalizeForSearch(query)
  return [item.title, item.id, ...item.keywords].some((word) => normalizeForSearch(word).includes(q))
}

/**
 * Notion-style "/" menu. `getItems` is called lazily so labels follow the current locale.
 */
export function createSlashCommand(getItems: () => SlashCommandItem[]) {
  return Extension.create({
    name: 'slashCommand',

    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommandItem, SlashCommandItem>({
          editor: this.editor,
          pluginKey: slashPluginKey,
          char: '/',
          // "/" after a word (URLs, dates, "and/or") should stay plain text
          allowedPrefixes: [' '],
          allow: ({ state, range }) => {
            const $from = state.doc.resolve(range.from)
            return $from.parent.type.name !== 'codeBlock'
          },
          items: ({ query }) => getItems().filter((item) => matches(item, query)),
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => {
            let renderer: VueRenderer | null = null
            let el: HTMLElement | null = null

            const place = (props: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
              const rect = props.clientRect?.()
              if (!el || !rect) return
              const reference = { getBoundingClientRect: () => rect }
              computePosition(reference, el, {
                placement: 'bottom-start',
                strategy: 'fixed',
                middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })]
              }).then(({ x, y }) => {
                if (el) Object.assign(el.style, { left: `${x}px`, top: `${y}px` })
              })
            }

            return {
              onStart: (props) => {
                renderer = new VueRenderer(SlashMenu, {
                  props: { items: props.items, command: props.command },
                  editor: props.editor
                })
                el = renderer.element as HTMLElement
                Object.assign(el.style, { position: 'fixed', left: '0px', top: '0px', zIndex: '60' })
                document.body.appendChild(el)
                place(props)
              },
              onUpdate: (props) => {
                renderer?.updateProps({ items: props.items, command: props.command })
                place(props)
              },
              onKeyDown: ({ event, view }) => {
                if (event.key === 'Escape') {
                  exitSuggestion(view, slashPluginKey)
                  return true
                }
                return renderer?.ref?.onKeyDown(event) ?? false
              },
              onExit: () => {
                el?.remove()
                renderer?.destroy()
                el = null
                renderer = null
              }
            }
          }
        })
      ]
    }
  })
}
