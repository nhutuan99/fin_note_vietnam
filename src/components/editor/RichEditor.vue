<script setup lang="ts">
import { useEditor, EditorContent, VueNodeViewRenderer } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Typography from '@tiptap/extension-typography'
import Highlight from '@tiptap/extension-highlight'
import { createLowlight, common } from 'lowlight'
import { watch, onBeforeUnmount, ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Bold, Italic, Underline, Strikethrough, Code, Link2, Image as ImageIcon,
  List, ListOrdered, ListChecks, Quote, Minus, Undo, Redo, Type,
  Heading1, Heading2, Heading3, Highlighter, Code2, ImagePlus, X, ChevronLeft, ChevronRight,
  ExternalLink, Unlink, Check
} from 'lucide-vue-next'
import CustomImageNode from './CustomImageNode.vue'
import { createSlashCommand, type SlashCommandItem } from './slashCommand'
import { autoFormatJsonContent } from '@/shared/utils/jsonFormatter'
import { compressImageFile } from '@/shared/utils/imageCompress'
import { useEventListener } from '@/composables/useEventListener'

const props = defineProps<{
  modelValue: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  stats: [value: { words: number; characters: number }]
}>()

const { t } = useI18n()
const lowlight = createLowlight(common)
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'

const fileInputRef = ref<HTMLInputElement | null>(null)

const CustomImage = Image.extend({
  inline: true,
  group: 'inline',
  addNodeView() {
    return VueNodeViewRenderer(CustomImageNode)
  }
})

// ── Images ──

async function insertImageFiles(editor: Editor, files: File[], pos?: number) {
  const sources = await Promise.all(files.map(compressImageFile))
  const content = sources.map((src) => ({ type: 'image', attrs: { src } }))
  const chain = editor.chain().focus()
  if (pos !== undefined) chain.insertContentAt(pos, content)
  else chain.insertContent(content)
  chain.run()
}

function imageFilesFrom(list: FileList | DataTransferItemList | undefined | null): File[] {
  if (!list) return []
  const files: File[] = []
  for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = entry instanceof File ? entry : entry.kind === 'file' ? entry.getAsFile() : null
    if (file && file.type.startsWith('image/')) files.push(file)
  }
  return files
}

function triggerImageUpload() {
  fileInputRef.value?.click()
}

async function handleFileUpload(event: Event) {
  const files = imageFilesFrom((event.target as HTMLInputElement).files)
  if (files.length && editor.value) await insertImageFiles(editor.value, files)
  // Reset so picking the same file again still fires `change`
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// ── Slash menu ──

const slashItems = (): SlashCommandItem[] => {
  const basic = t('editor.slash.groupBasic')
  const media = t('editor.slash.groupMedia')
  return [
    { id: 'text', group: basic, icon: Type, title: t('editor.text'), description: t('editor.slash.textDesc'), keywords: ['paragraph', 'p'],
      run: (e, range) => e.chain().focus().deleteRange(range).setParagraph().run() },
    { id: 'h1', group: basic, icon: Heading1, title: t('editor.heading1'), description: t('editor.slash.h1Desc'), keywords: ['heading', 'title', '#'],
      run: (e, range) => e.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
    { id: 'h2', group: basic, icon: Heading2, title: t('editor.heading2'), description: t('editor.slash.h2Desc'), keywords: ['heading', 'subtitle', '##'],
      run: (e, range) => e.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
    { id: 'h3', group: basic, icon: Heading3, title: t('editor.heading3'), description: t('editor.slash.h3Desc'), keywords: ['heading', '###'],
      run: (e, range) => e.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
    { id: 'bullet', group: basic, icon: List, title: t('editor.bulletList'), description: t('editor.slash.bulletDesc'), keywords: ['list', 'ul', '-'],
      run: (e, range) => e.chain().focus().deleteRange(range).toggleBulletList().run() },
    { id: 'numbered', group: basic, icon: ListOrdered, title: t('editor.orderedList'), description: t('editor.slash.numberedDesc'), keywords: ['list', 'ol', '1.'],
      run: (e, range) => e.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { id: 'todo', group: basic, icon: ListChecks, title: t('editor.taskList'), description: t('editor.slash.todoDesc'), keywords: ['todo', 'task', 'checkbox', '[]'],
      run: (e, range) => e.chain().focus().deleteRange(range).toggleTaskList().run() },
    { id: 'quote', group: basic, icon: Quote, title: t('editor.quote'), description: t('editor.slash.quoteDesc'), keywords: ['blockquote', '>'],
      run: (e, range) => e.chain().focus().deleteRange(range).toggleBlockquote().run() },
    { id: 'code', group: basic, icon: Code2, title: t('editor.codeBlock'), description: t('editor.slash.codeDesc'), keywords: ['code', 'snippet', '```'],
      run: (e, range) => e.chain().focus().deleteRange(range).toggleCodeBlock().run() },
    { id: 'divider', group: basic, icon: Minus, title: t('editor.divider'), description: t('editor.slash.dividerDesc'), keywords: ['hr', 'line', '---'],
      run: (e, range) => e.chain().focus().deleteRange(range).setHorizontalRule().run() },
    { id: 'image', group: media, icon: ImagePlus, title: t('editor.uploadImage'), description: t('editor.slash.imageDesc'), keywords: ['image', 'photo', 'picture', 'upload'],
      run: (e, range) => {
        e.chain().focus().deleteRange(range).run()
        triggerImageUpload()
      } }
  ]
}

// ── Editor ──

function emitStats(editor: Editor) {
  emit('stats', {
    words: editor.storage.characterCount.words(),
    characters: editor.storage.characterCount.characters()
  })
}

const editor = useEditor({
  content: props.modelValue,
  editable: !props.readonly,
  extensions: [
    StarterKit.configure({
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
      }
    }),
    CodeBlockLowlight.configure({ lowlight }),
    CustomImage.configure({ allowBase64: true }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return t('editor.placeholderHeading')
        return t('editor.placeholder')
      }
    }),
    CharacterCount,
    TaskList,
    TaskItem.configure({ nested: true }),
    Typography,
    Highlight.configure({ multicolor: false }),
    createSlashCommand(slashItems)
  ],
  onCreate({ editor }) {
    emitStats(editor)
  },
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML())
    emitStats(editor)
  },
  editorProps: {
    attributes: { spellcheck: 'true' },
    handlePaste(_view, event) {
      const images = imageFilesFrom(event.clipboardData?.items)
      if (images.length && editor.value) {
        insertImageFiles(editor.value, images)
        return true
      }

      // Pasting raw JSON / NDJSON turns it into a formatted code block
      const text = event.clipboardData?.getData('text/plain')
      const hasHtml = !!event.clipboardData?.getData('text/html')
      if (text && !hasHtml) {
        const formatted = autoFormatJsonContent(text)
        if (formatted && editor.value) {
          editor.value.commands.insertContent(formatted)
          return true
        }
      }
      return false
    },
    handleDrop(view, event, _slice, moved) {
      if (moved) return false
      const images = imageFilesFrom(event.dataTransfer?.files)
      if (!images.length || !editor.value) return false
      event.preventDefault()
      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
      insertImageFiles(editor.value, images, pos)
      return true
    },
    handleClick(_view, _pos, event) {
      // Links open on Ctrl/⌘+click (plain click places the caret for editing)
      const link = (event.target as HTMLElement).closest('a')
      if (link?.href && (event.metaKey || event.ctrlKey || props.readonly)) {
        window.open(link.href, '_blank', 'noopener,noreferrer')
        return true
      }
      return false
    }
  }
})

watch(
  () => props.modelValue,
  (val) => {
    if (editor.value && editor.value.getHTML() !== val) {
      editor.value.commands.setContent(val, { emitUpdate: false })
      emitStats(editor.value)
    }
  }
)

watch(
  () => props.readonly,
  (readonly) => editor.value?.setEditable(!readonly)
)

onBeforeUnmount(() => editor.value?.destroy())

/** Focus the editor; used by the title field (Enter / ArrowDown moves into the body). */
function focus(position: 'start' | 'end' = 'start') {
  const ed = editor.value
  if (!ed) return
  // commands.focus() moves DOM focus on the next animation frame; focus the view synchronously
  // so keystrokes typed right after (e.g. Enter in the title, then typing) land in the editor
  ed.view.focus()
  ed.commands.focus(position)
}

defineExpose({ focus })

// ── Bubble menu: link editing ──

const linkEditing = ref(false)
const linkUrl = ref('')
const linkInput = ref<HTMLInputElement | null>(null)

function startLinkEdit() {
  linkUrl.value = editor.value?.getAttributes('link').href || ''
  linkEditing.value = true
  nextTick(() => linkInput.value?.focus())
}

function applyLink() {
  const url = linkUrl.value.trim()
  const chain = editor.value?.chain().focus().extendMarkRange('link')
  if (!url) chain?.unsetLink().run()
  else chain?.setLink({ href: /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}` }).run()
  linkEditing.value = false
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  linkEditing.value = false
}

function openLink() {
  const href = editor.value?.getAttributes('link').href
  if (href) window.open(href, '_blank', 'noopener,noreferrer')
}

function handleLinkKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    applyLink()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    linkEditing.value = false
    editor.value?.commands.focus()
  }
}

/** Show the bubble only for a real text selection (not images, not inside code blocks) */
function shouldShowBubble({ editor: ed, from, to }: { editor: Editor; from: number; to: number }) {
  if (!ed.isEditable || from === to) {
    linkEditing.value = false
    return false
  }
  if (ed.isActive('codeBlock') || ed.isActive('image')) return false
  return ed.state.doc.textBetween(from, to, ' ').trim().length > 0 || linkEditing.value
}

// ── Toolbar definition ──

type ToolbarButton = {
  key: string
  icon: unknown
  label: string
  active?: () => boolean
  disabled?: () => boolean
  run: () => void
}

const chain = () => editor.value!.chain().focus()

const toolbarGroups = computed<ToolbarButton[][]>(() => [
  [
    { key: 'undo', icon: Undo, label: `${t('editor.undo')} (${mod}Z)`, disabled: () => !editor.value?.can().undo(), run: () => chain().undo().run() },
    { key: 'redo', icon: Redo, label: `${t('editor.redo')} (${mod}${isMac ? '⇧Z' : 'Y'})`, disabled: () => !editor.value?.can().redo(), run: () => chain().redo().run() }
  ],
  [
    { key: 'h1', icon: Heading1, label: t('editor.heading1'), active: () => !!editor.value?.isActive('heading', { level: 1 }), run: () => chain().toggleHeading({ level: 1 }).run() },
    { key: 'h2', icon: Heading2, label: t('editor.heading2'), active: () => !!editor.value?.isActive('heading', { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
    { key: 'h3', icon: Heading3, label: t('editor.heading3'), active: () => !!editor.value?.isActive('heading', { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() }
  ],
  [
    { key: 'bold', icon: Bold, label: `${t('editor.bold')} (${mod}B)`, active: () => !!editor.value?.isActive('bold'), run: () => chain().toggleBold().run() },
    { key: 'italic', icon: Italic, label: `${t('editor.italic')} (${mod}I)`, active: () => !!editor.value?.isActive('italic'), run: () => chain().toggleItalic().run() },
    { key: 'underline', icon: Underline, label: `${t('editor.underline')} (${mod}U)`, active: () => !!editor.value?.isActive('underline'), run: () => chain().toggleUnderline().run() },
    { key: 'strike', icon: Strikethrough, label: t('editor.strike'), active: () => !!editor.value?.isActive('strike'), run: () => chain().toggleStrike().run() },
    { key: 'highlight', icon: Highlighter, label: t('editor.highlight'), active: () => !!editor.value?.isActive('highlight'), run: () => chain().toggleHighlight().run() },
    { key: 'code', icon: Code, label: t('editor.inlineCode'), active: () => !!editor.value?.isActive('code'), run: () => chain().toggleCode().run() }
  ],
  [
    { key: 'bullet', icon: List, label: t('editor.bulletList'), active: () => !!editor.value?.isActive('bulletList'), run: () => chain().toggleBulletList().run() },
    { key: 'ordered', icon: ListOrdered, label: t('editor.orderedList'), active: () => !!editor.value?.isActive('orderedList'), run: () => chain().toggleOrderedList().run() },
    { key: 'task', icon: ListChecks, label: t('editor.taskList'), active: () => !!editor.value?.isActive('taskList'), run: () => chain().toggleTaskList().run() }
  ],
  [
    { key: 'quote', icon: Quote, label: t('editor.quote'), active: () => !!editor.value?.isActive('blockquote'), run: () => chain().toggleBlockquote().run() },
    { key: 'codeBlock', icon: Code2, label: t('editor.codeBlock'), active: () => !!editor.value?.isActive('codeBlock'), run: () => chain().toggleCodeBlock().run() },
    { key: 'divider', icon: Minus, label: t('editor.divider'), run: () => chain().setHorizontalRule().run() }
  ],
  [
    { key: 'link', icon: Link2, label: t('editor.link'), active: () => !!editor.value?.isActive('link'), run: () => openToolbarLink() },
    { key: 'image', icon: ImageIcon, label: t('editor.uploadImage'), run: () => triggerImageUpload() }
  ]
])

/** Toolbar link button: select the word under the caret first so the bubble menu can edit it */
function openToolbarLink() {
  const ed = editor.value
  if (!ed) return
  if (ed.state.selection.empty) {
    ed.chain().focus().extendMarkRange('link').run()
    if (ed.state.selection.empty) {
      // No link and no selection: insert the URL as a new link
      const url = window.prompt(t('editor.linkPrompt'), 'https://')
      if (url && url.trim() && url.trim() !== 'https://') {
        ed.chain().focus().insertContent({ type: 'text', text: url.trim(), marks: [{ type: 'link', attrs: { href: url.trim() } }] }).run()
      }
      return
    }
  }
  startLinkEdit()
}

// ── Image zoom (lightbox) ──

const zoomedIndex = ref<number | null>(null)
const zoomImages = ref<string[]>([])
const zoomedImage = computed(() => (zoomedIndex.value !== null ? zoomImages.value[zoomedIndex.value] : null))

function handleEditorClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.tagName !== 'IMG' || !editor.value) return
  const srcs: string[] = []
  editor.value.state.doc.descendants((node) => {
    if (node.type.name === 'image' && node.attrs.src) srcs.push(new URL(node.attrs.src, window.location.href).href)
  })
  zoomImages.value = Array.from(new Set(srcs))
  zoomedIndex.value = Math.max(0, zoomImages.value.indexOf((target as HTMLImageElement).src))
}

function closeZoom() {
  zoomedIndex.value = null
}

function stepZoom(delta: number) {
  if (zoomedIndex.value === null) return
  const next = zoomedIndex.value + delta
  if (next >= 0 && next < zoomImages.value.length) zoomedIndex.value = next
}

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (zoomedIndex.value === null) return
  if (e.key === 'Escape') closeZoom()
  else if (e.key === 'ArrowLeft') stepZoom(-1)
  else if (e.key === 'ArrowRight') stepZoom(1)
})
</script>

<template>
  <div class="rich-editor-wrapper">
    <!-- Toolbar -->
    <div v-if="editor && !readonly" class="editor-toolbar" role="toolbar" :aria-label="t('editor.toolbar')">
      <template v-for="(group, gi) in toolbarGroups" :key="gi">
        <div v-if="gi > 0" class="toolbar-divider" />
        <div class="toolbar-group">
          <button
            v-for="btn in group"
            :key="btn.key"
            type="button"
            :title="btn.label"
            :aria-label="btn.label"
            :aria-pressed="btn.active ? btn.active() : undefined"
            :class="{ active: btn.active?.() }"
            :disabled="btn.disabled?.()"
            @click="btn.run()"
          >
            <component :is="btn.icon" :size="16" />
          </button>
        </div>
      </template>
    </div>

    <!-- Bubble menu on text selection -->
    <BubbleMenu
      v-if="editor && !readonly"
      :editor="editor"
      :should-show="shouldShowBubble"
      :options="{ placement: 'top', offset: 8 }"
      class="bubble-menu"
    >
      <template v-if="linkEditing">
        <input
          ref="linkInput"
          v-model="linkUrl"
          type="url"
          class="bubble-link-input"
          :placeholder="t('editor.linkPlaceholder')"
          @keydown="handleLinkKeydown"
        />
        <button type="button" :title="t('editor.apply')" @click="applyLink"><Check :size="15" /></button>
        <button v-if="editor.isActive('link')" type="button" :title="t('editor.removeLink')" @click="removeLink"><Unlink :size="15" /></button>
      </template>
      <template v-else>
        <button type="button" :title="t('editor.bold')" :class="{ active: editor.isActive('bold') }" @click="chain().toggleBold().run()"><Bold :size="15" /></button>
        <button type="button" :title="t('editor.italic')" :class="{ active: editor.isActive('italic') }" @click="chain().toggleItalic().run()"><Italic :size="15" /></button>
        <button type="button" :title="t('editor.underline')" :class="{ active: editor.isActive('underline') }" @click="chain().toggleUnderline().run()"><Underline :size="15" /></button>
        <button type="button" :title="t('editor.strike')" :class="{ active: editor.isActive('strike') }" @click="chain().toggleStrike().run()"><Strikethrough :size="15" /></button>
        <button type="button" :title="t('editor.highlight')" :class="{ active: editor.isActive('highlight') }" @click="chain().toggleHighlight().run()"><Highlighter :size="15" /></button>
        <button type="button" :title="t('editor.inlineCode')" :class="{ active: editor.isActive('code') }" @click="chain().toggleCode().run()"><Code :size="15" /></button>
        <span class="bubble-divider" />
        <button type="button" :title="t('editor.link')" :class="{ active: editor.isActive('link') }" @click="startLinkEdit"><Link2 :size="15" /></button>
        <button v-if="editor.isActive('link')" type="button" :title="t('editor.openLink')" @click="openLink"><ExternalLink :size="15" /></button>
      </template>
    </BubbleMenu>

    <!-- Editor Area -->
    <div class="editor-content" @click="handleEditorClick">
      <EditorContent :editor="editor" :class="{ 'is-readonly': readonly }" />
    </div>

    <!-- Hidden file input for image upload -->
    <input ref="fileInputRef" type="file" accept="image/*" multiple hidden @change="handleFileUpload" />

    <!-- Zoom Overlay -->
    <Teleport to="body">
      <Transition name="fade-zoom">
        <div v-if="zoomedImage" class="image-zoom-overlay" @click="closeZoom">
          <div v-if="zoomImages.length > 1" class="zoom-counter" @click.stop>
            {{ zoomedIndex! + 1 }} / {{ zoomImages.length }}
          </div>
          <button v-if="zoomedIndex! > 0" class="zoom-nav-btn zoom-prev-btn" :aria-label="t('editor.prevImage')" @click.stop="stepZoom(-1)">
            <ChevronLeft :size="32" />
          </button>
          <img :src="zoomedImage" class="zoomed-img" alt="" @click.stop />
          <button v-if="zoomedIndex! < zoomImages.length - 1" class="zoom-nav-btn zoom-next-btn" :aria-label="t('editor.nextImage')" @click.stop="stepZoom(1)">
            <ChevronRight :size="32" />
          </button>
          <button class="zoom-close-btn" :aria-label="t('common.close')" @click="closeZoom">
            <X :size="24" />
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
/* ── Editor Wrapper ── */
.rich-editor-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* ── Toolbar ── */
.editor-toolbar {
  position: sticky;
  top: var(--header-height, 56px);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 1rem;
  padding: 4px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
  backdrop-filter: blur(10px);
  overflow-x: auto;
  scrollbar-width: none;
}

.editor-toolbar::-webkit-scrollbar {
  display: none;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
}

.toolbar-group button,
.bubble-menu button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  background: transparent;
  transition: background 120ms ease, color 120ms ease;
}

.toolbar-group button:hover:not(:disabled),
.bubble-menu button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toolbar-group button.active,
.bubble-menu button.active {
  background: var(--accent-subtle);
  color: var(--accent);
}

.toolbar-group button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.toolbar-divider {
  flex-shrink: 0;
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--border-default);
}

@media (min-width: 1024px) {
  .editor-toolbar {
    padding: 5px 6px;
    margin-bottom: 1.5rem;
  }
  .toolbar-group button {
    width: 34px;
    height: 34px;
  }
  .toolbar-divider {
    height: 20px;
    margin: 0 6px;
  }
}

/* ── Bubble menu ── */
.bubble-menu {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 3px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  box-shadow: var(--shadow-lg);
}

.bubble-divider {
  width: 1px;
  height: 18px;
  margin: 0 3px;
  background: var(--border-default);
}

.bubble-link-input {
  width: 15rem;
  height: 30px;
  padding: 0 0.5rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 0.8125rem;
  outline: none;
}

/* ── Editor Content ── */
.editor-content {
  flex: 1;
}

.editor-content .tiptap {
  min-height: 50vh;
  padding: 4px 0 30vh;
  outline: none;
  font-size: 1rem;
  line-height: 1.75;
  color: var(--text-primary);
  caret-color: var(--accent);
  word-break: break-word;
}

.editor-content .tiptap > * + * {
  margin-top: 0.5em;
}

.editor-content .tiptap ::selection {
  background: var(--accent-glow);
}

/* Placeholder on the current empty line (and for an empty document) */
.editor-content .tiptap .is-empty::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: var(--text-disabled);
  pointer-events: none;
}

.editor-content .is-readonly .tiptap {
  min-height: 0;
  padding-bottom: 0;
}

.editor-content .is-readonly .tiptap .is-empty::before {
  content: none;
}

/* Headings */
.editor-content .tiptap h1 {
  margin-top: 1.4em;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
}
.editor-content .tiptap h2 {
  margin-top: 1.25em;
  font-size: 1.375rem;
  font-weight: 650;
  line-height: 1.3;
}
.editor-content .tiptap h3 {
  margin-top: 1.1em;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.4;
}
.editor-content .tiptap > :is(h1, h2, h3):first-child {
  margin-top: 0;
}

/* Inline formatting */
.editor-content .tiptap strong { font-weight: 650; }
.editor-content .tiptap s { text-decoration: line-through; color: var(--text-tertiary); }
.editor-content .tiptap u { text-underline-offset: 3px; }
.editor-content .tiptap mark {
  background: color-mix(in srgb, var(--warning) 32%, transparent);
  color: inherit;
  border-radius: 3px;
  padding: 0 2px;
}
.editor-content .tiptap code {
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 0.85em;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--accent-text, var(--accent));
}
[data-theme='light'] .editor-content .tiptap :not(pre) > code {
  color: var(--accent-hover);
}

/* Links */
.editor-content .tiptap a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--accent) 45%, transparent);
  text-underline-offset: 3px;
  cursor: text;
}
.editor-content .is-readonly .tiptap a {
  cursor: pointer;
}

/* Lists */
.editor-content .tiptap ul,
.editor-content .tiptap ol {
  padding-left: 1.5rem;
}
.editor-content .tiptap ul { list-style: disc; }
.editor-content .tiptap ol { list-style: decimal; }
.editor-content .tiptap li + li { margin-top: 0.2em; }
.editor-content .tiptap li p { margin: 0; }
.editor-content .tiptap li::marker { color: var(--text-tertiary); }

/* Task list */
.editor-content .tiptap ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0.125rem;
}
.editor-content .tiptap ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.editor-content .tiptap ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  margin-top: 0.3em;
  cursor: pointer;
  user-select: none;
}
.editor-content .tiptap ul[data-type="taskList"] li > div {
  flex: 1;
  min-width: 0;
}
.editor-content .tiptap ul[data-type="taskList"] input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}
.editor-content .tiptap ul[data-type="taskList"] li[data-checked="true"] > div {
  color: var(--text-tertiary);
  text-decoration: line-through;
}

/* Blockquote */
.editor-content .tiptap blockquote {
  margin: 0.75em 0;
  padding: 0.25em 0 0.25em 1em;
  border-left: 3px solid var(--accent);
  color: var(--text-secondary);
}

/* Code block */
.editor-content .tiptap pre {
  margin: 0.75em 0;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  overflow-x: auto;
}
.editor-content .tiptap pre code {
  padding: 0;
  border: none;
  background: none;
  color: var(--text-primary);
  font-size: 0.8125rem;
  line-height: 1.6;
}

/* Syntax highlighting (lowlight / highlight.js classes) */
.editor-content .hljs-comment,
.editor-content .hljs-quote { color: var(--text-tertiary); font-style: italic; }
.editor-content .hljs-keyword,
.editor-content .hljs-selector-tag,
.editor-content .hljs-built_in { color: #c792ea; }
.editor-content .hljs-string,
.editor-content .hljs-attr,
.editor-content .hljs-template-variable { color: #8bd49c; }
.editor-content .hljs-number,
.editor-content .hljs-literal { color: #f78c6c; }
.editor-content .hljs-title,
.editor-content .hljs-section,
.editor-content .hljs-name { color: #82aaff; }
.editor-content .hljs-variable,
.editor-content .hljs-params { color: #f07178; }
[data-theme='light'] .editor-content .hljs-keyword,
[data-theme='light'] .editor-content .hljs-built_in { color: #7c3aed; }
[data-theme='light'] .editor-content .hljs-string,
[data-theme='light'] .editor-content .hljs-attr { color: #15803d; }
[data-theme='light'] .editor-content .hljs-number,
[data-theme='light'] .editor-content .hljs-literal { color: #c2410c; }
[data-theme='light'] .editor-content .hljs-title,
[data-theme='light'] .editor-content .hljs-name { color: #1d4ed8; }
[data-theme='light'] .editor-content .hljs-variable,
[data-theme='light'] .editor-content .hljs-params { color: #be123c; }

/* Horizontal rule */
.editor-content .tiptap hr {
  margin: 1.5em 0;
  border: none;
  border-top: 1px solid var(--border-default);
}
.editor-content .tiptap hr.ProseMirror-selectednode {
  border-top-color: var(--accent);
}

/* Images: inline nodes laid out as a grid when several share a paragraph */
.editor-content .tiptap p:has(> .custom-image-wrapper) {
  display: grid;
  gap: 12px;
  align-items: start;
  margin: 0.75em 0;
}
.editor-content .tiptap p:has(> .custom-image-wrapper:nth-child(1):last-child) { grid-template-columns: 1fr; }
.editor-content .tiptap p:has(> .custom-image-wrapper:nth-child(2):last-child) { grid-template-columns: 1fr 1fr; }
.editor-content .tiptap p:has(> .custom-image-wrapper:nth-child(3):last-child) { grid-template-columns: 1fr 1fr 1fr; }
.editor-content .tiptap p:has(> .custom-image-wrapper:nth-child(4):last-child) { grid-template-columns: 1fr 1fr; }
.editor-content .tiptap p:has(> .custom-image-wrapper:nth-child(5)) { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }

.editor-content .tiptap p:has(> .custom-image-wrapper) > .custom-image-wrapper {
  width: 100%;
  margin: 0;
}
.editor-content .tiptap p:has(> .custom-image-wrapper) > .custom-image-wrapper img {
  width: 100%;
  height: auto;
  max-height: 520px;
  object-fit: contain;
  border-radius: var(--radius-md);
  background-color: var(--bg-elevated);
}

/* Drop cursor while dragging blocks or images */
.ProseMirror .ProseMirror-dropcursor,
.tiptap-dropcursor {
  background: var(--accent);
}

/* ── Image Zoom ── */
.image-zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(4px);
  cursor: zoom-out;
}
.zoomed-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  cursor: default;
}
.zoom-close-btn,
.zoom-nav-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: white;
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.2s;
}
.zoom-close-btn:hover,
.zoom-nav-btn:hover {
  background: rgba(255, 255, 255, 0.24);
}
.zoom-close-btn {
  top: 1.5rem;
  right: 1.5rem;
  width: 44px;
  height: 44px;
}
.zoom-nav-btn {
  top: 50%;
  width: 50px;
  height: 50px;
  transform: translateY(-50%);
}
.zoom-prev-btn { left: 1.5rem; }
.zoom-next-btn { right: 1.5rem; }
.zoom-counter {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 0.875rem;
  pointer-events: none;
}
.fade-zoom-enter-active,
.fade-zoom-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-zoom-enter-from,
.fade-zoom-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
