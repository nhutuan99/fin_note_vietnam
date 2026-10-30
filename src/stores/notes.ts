import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Note, NoteListItem, NoteFilter, NoteSort, ViewMode } from '@/types'
import { httpClient, ApiError } from '@/shared/api/httpClient'
import { useObsidianSync } from '@/composables/useObsidianSync'
import { useAuthStore } from '@/stores/auth'
import { AUTH_TOKEN_KEY } from '@/constants/auth'
import { deriveNoteText, normalizeForSearch } from '@/shared/utils/noteText'

const PREFS_KEY = 'sn_notes_prefs'

interface NotesPrefs {
  viewMode: ViewMode
  sortBy: NoteSort
}

function loadPrefs(): NotesPrefs {
  const defaults: NotesPrefs = { viewMode: 'grid', sortBy: 'updated' }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }
  } catch {
    return defaults
  }
}

export interface UpdateNoteOptions {
  /** `updatedAt` the editor started from; the server rejects with 409 if the note changed since */
  baseUpdatedAt?: string
  /** Overwrite even if the note changed elsewhere */
  force?: boolean
  /** Let the request outlive the page (save on tab close) */
  keepalive?: boolean
}

export const useNotesStore = defineStore('notes', () => {
  const obsidian = useObsidianSync()
  obsidian.init()
  const auth = useAuthStore()

  const notes = ref<NoteListItem[]>([])
  const currentNote = ref<Note | null>(null)
  const loading = ref(false)
  const filter = ref<NoteFilter>('all')
  const searchQuery = ref('')
  const activeTag = ref<string | null>(null)

  const prefs = loadPrefs()
  const viewMode = ref<ViewMode>(prefs.viewMode)
  const sortBy = ref<NoteSort>(prefs.sortBy)
  watch([viewMode, sortBy], () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ viewMode: viewMode.value, sortBy: sortBy.value }))
    } catch {
      // Storage unavailable (private mode) — preferences just won't persist
    }
  })

  /** Signed-in users talk to the worker; guests are served by the localDb mock. */
  function canSync() {
    return !!localStorage.getItem(AUTH_TOKEN_KEY) || auth.isGuest
  }

  // ── Computed ──

  const filteredNotes = computed(() => {
    let result = [...notes.value]

    if (filter.value === 'pinned') {
      result = result.filter((n) => n.pinned)
    } else if (filter.value === 'recent') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      result = result.filter((n) => new Date(n.updatedAt) >= weekAgo)
    }

    if (activeTag.value) {
      const tag = activeTag.value
      result = result.filter((n) => n.tags.includes(tag))
    }

    const q = normalizeForSearch(searchQuery.value.trim())
    if (q) {
      // Every word must appear somewhere in the title, body or tags (order-independent)
      const terms = q.split(/\s+/)
      result = result.filter((n) => {
        const haystack = normalizeForSearch(`${n.title} ${n.text || n.excerpt} ${n.tags.join(' ')}`)
        return terms.every((term) => haystack.includes(term))
      })
    }

    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (sortBy.value === 'title') {
        return (a.title || '').localeCompare(b.title || '', 'vi', { sensitivity: 'base' })
      }
      const key = sortBy.value === 'created' ? 'createdAt' : 'updatedAt'
      return new Date(b[key] || b.updatedAt).getTime() - new Date(a[key] || a.updatedAt).getTime()
    })

    return result
  })

  const pinnedNotes = computed(() => filteredNotes.value.filter((n) => n.pinned))
  const otherNotes = computed(() => filteredNotes.value.filter((n) => !n.pinned))

  const totalNotes = computed(() => notes.value.length)
  const pinnedCount = computed(() => notes.value.filter((n) => n.pinned).length)
  const allTags = computed(() => {
    const counts = new Map<string, number>()
    notes.value.forEach((n) => n.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)))
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }))
  })

  // ── Helpers ──

  function toListItem(note: Note): NoteListItem {
    return {
      id: note.id,
      title: note.title,
      ...deriveNoteText(note.content),
      tags: note.tags,
      pinned: note.pinned,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    }
  }

  function upsertListItem(note: Note) {
    const item = toListItem(note)
    const idx = notes.value.findIndex((n) => n.id === note.id)
    if (idx === -1) notes.value.unshift(item)
    else notes.value[idx] = item
  }

  // ── Actions ──

  async function fetchNotes() {
    if (!canSync()) return
    loading.value = true
    try {
      const data = await httpClient.get<NoteListItem[]>('/api/notes')
      notes.value = data || []
    } catch (err) {
      console.error('Failed to fetch notes:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchNote(id: string) {
    if (!canSync()) return null
    try {
      const data = await httpClient.get<Note>(`/api/notes/${id}`)
      currentNote.value = data || null
      return data
    } catch (err) {
      console.error('Failed to fetch note:', err)
      return null
    }
  }

  async function createNote(note: Partial<Note>): Promise<Note | null> {
    try {
      const data = await httpClient.post<Note>('/api/notes', note)
      if (data) {
        upsertListItem(data)
        await obsidian.syncToVault(data)
      }
      return data || null
    } catch (err) {
      console.error('Failed to create note:', err)
      return null
    }
  }

  /**
   * Saves note fields. Returns the saved note, or null on failure.
   * Throws `ApiError` with status 409 (and the server copy in `data`) when `baseUpdatedAt` is stale.
   */
  async function updateNote(id: string, updates: Partial<Note>, options: UpdateNoteOptions = {}): Promise<Note | null> {
    try {
      const data = await httpClient.put<Note>(
        `/api/notes/${id}`,
        { ...updates, baseUpdatedAt: options.baseUpdatedAt, force: options.force },
        { silent: !!options.baseUpdatedAt, keepalive: options.keepalive }
      )
      if (data) {
        if (currentNote.value?.id === id) currentNote.value = data
        upsertListItem(data)
        await obsidian.syncToVault(data)
      }
      return data || null
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) throw err
      console.error('Failed to update note:', err)
      return null
    }
  }

  async function updateNoteShare(id: string, isPublic: boolean, sharedWith: string[]): Promise<boolean> {
    try {
      const data = await httpClient.post<Note>(`/api/notes/${id}/share`, { isPublic, sharedWith })
      if (data && currentNote.value?.id === id) {
        currentNote.value.isPublic = data.isPublic
        currentNote.value.sharedWith = data.sharedWith
      }
      return true
    } catch (err) {
      console.error('Failed to update share settings:', err)
      return false
    }
  }

  async function deleteNote(id: string): Promise<boolean> {
    try {
      await httpClient.del(`/api/notes/${id}`)
      notes.value = notes.value.filter((n) => n.id !== id)
      if (currentNote.value?.id === id) {
        currentNote.value = null
      }
      await obsidian.deleteFromVault(id)
      return true
    } catch (err) {
      console.error('Failed to delete note:', err)
      return false
    }
  }

  async function togglePin(id: string) {
    const note = notes.value.find((n) => n.id === id)
    if (!note) return
    // Optimistic: flip immediately, roll back if the save fails
    note.pinned = !note.pinned
    const saved = await updateNote(id, { pinned: note.pinned })
    if (!saved) note.pinned = !note.pinned
  }

  return {
    notes,
    currentNote,
    loading,
    filter,
    searchQuery,
    activeTag,
    viewMode,
    sortBy,
    filteredNotes,
    pinnedNotes,
    otherNotes,
    totalNotes,
    pinnedCount,
    allTags,
    fetchNotes,
    fetchNote,
    createNote,
    updateNote,
    updateNoteShare,
    deleteNote,
    togglePin,
    obsidian
  }
})
