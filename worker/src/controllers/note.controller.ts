import { Env, UserData, NoteData, NoteIndexItem } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'

// ====== Note Index Helpers ======

/** Bump when the shape of index items changes; older items are rebuilt on the next list call. */
const NOTE_INDEX_VERSION = 2
const EXCERPT_LENGTH = 160
/** Plain text kept in the index so the client can search note bodies without loading each note. */
const SEARCH_TEXT_LENGTH = 2000
const MAX_TITLE_LENGTH = 300
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 40

const indexKey = (userId: string) => `users/${userId}/notes/_index`
const noteKey = (userId: string, noteId: string) => `users/${userId}/notes/${noteId}`

const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
}

function decodeEntity(match: string, entity: string): string {
  const lower = entity.toLowerCase()
  if (!lower.startsWith('#')) return HTML_ENTITIES[lower] ?? match
  const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10)
  try {
    return String.fromCodePoint(code)
  } catch {
    return match
  }
}

/** Converts editor HTML into whitespace-normalized plain text (images and code markers dropped). */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|pre|blockquote|table|tr|td|th|hr)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, decodeEntity)
    .replace(/\s+/g, ' ')
    .trim()
}

function toIndexItem(note: NoteData): NoteIndexItem {
  const text = htmlToPlainText(note.content)
  return {
    id: note.id,
    title: note.title,
    excerpt: text.substring(0, EXCERPT_LENGTH),
    text: text.substring(0, SEARCH_TEXT_LENGTH),
    wordCount: text ? text.split(' ').length : 0,
    hasImages: /<img[\s>]/i.test(note.content),
    tags: note.tags,
    pinned: note.pinned,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    v: NOTE_INDEX_VERSION
  }
}

export async function upsertNoteIndexItem(userId: string, note: NoteData, env: Env): Promise<void> {
  const index = (await getJSON<{ notes: NoteIndexItem[] }>(env.SMART_NOTE_KV, indexKey(userId))) || { notes: [] }
  const item = toIndexItem(note)
  const idx = index.notes.findIndex((n) => n.id === note.id)
  if (idx === -1) index.notes.push(item)
  else index.notes[idx] = item
  await putJSON(env.SMART_NOTE_KV, indexKey(userId), index)
}

function sanitizeTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.substring(0, MAX_TITLE_LENGTH)
}

function sanitizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const tags = value
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().toLowerCase().substring(0, MAX_TAG_LENGTH))
    .filter(Boolean)
  return Array.from(new Set(tags)).slice(0, MAX_TAGS)
}

// ====== Note Handlers ======

export async function handleListNotes(userId: string, env: Env): Promise<Response> {
  const index = await getJSON<{ notes: NoteIndexItem[] }>(env.SMART_NOTE_KV, indexKey(userId))
  if (!index) return jsonResponse({ success: true, data: [] })

  // One-time migration: rebuild items written by older versions (raw-HTML excerpt, no search text)
  const stale = index.notes.filter((n) => n.v !== NOTE_INDEX_VERSION)
  if (stale.length > 0) {
    const rebuilt = await Promise.all(
      stale.map(async (item) => {
        const note = await getJSON<NoteData>(env.SMART_NOTE_KV, noteKey(userId, item.id))
        return [item.id, note ? toIndexItem(note) : null] as const
      })
    )
    const byId = new Map(rebuilt)
    index.notes = index.notes
      .map((n) => (byId.has(n.id) ? byId.get(n.id) : n))
      .filter((n): n is NoteIndexItem => !!n)
    await putJSON(env.SMART_NOTE_KV, indexKey(userId), index)
  }

  return jsonResponse({ success: true, data: index.notes })
}

export async function handleGetNote(userId: string, noteId: string, env: Env): Promise<Response> {
  const note = await getJSON<NoteData>(env.SMART_NOTE_KV, noteKey(userId, noteId))
  if (!note) return errorResponse('Note not found', 404)
  return jsonResponse({ success: true, data: note })
}

export async function handleCreateNote(userId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>
  const id = generateId()
  const now = new Date().toISOString()
  const note: NoteData = {
    id,
    title: sanitizeTitle(body.title) ?? '',
    content: typeof body.content === 'string' ? body.content : '',
    tags: sanitizeTags(body.tags) ?? [],
    pinned: body.pinned === true,
    createdAt: now,
    updatedAt: now
  }

  await putJSON(env.SMART_NOTE_KV, noteKey(userId, id), note)
  await upsertNoteIndexItem(userId, note, env)

  return jsonResponse({ success: true, data: note }, 201)
}

export async function handleUpdateNote(
  userId: string,
  noteId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const existing = await getJSON<NoteData>(env.SMART_NOTE_KV, noteKey(userId, noteId))
  if (!existing) return errorResponse('Note not found', 404)

  const body = (await request.json()) as Record<string, unknown>

  // Optimistic concurrency: the editor sends the version it started from. If the note changed
  // elsewhere since (another tab/device), reject with the latest copy unless the client forces it.
  if (typeof body.baseUpdatedAt === 'string' && body.force !== true && body.baseUpdatedAt !== existing.updatedAt) {
    return jsonResponse({ success: false, error: 'Note was modified elsewhere', data: existing }, 409)
  }

  // Whitelist editable fields only — prevent id/createdAt overwrite
  const updated: NoteData = {
    ...existing,
    title: sanitizeTitle(body.title) ?? existing.title,
    content: typeof body.content === 'string' ? body.content : existing.content,
    tags: sanitizeTags(body.tags) ?? existing.tags,
    pinned: typeof body.pinned === 'boolean' ? body.pinned : existing.pinned,
    updatedAt: new Date().toISOString()
  }

  await putJSON(env.SMART_NOTE_KV, noteKey(userId, noteId), updated)
  await upsertNoteIndexItem(userId, updated, env)

  return jsonResponse({ success: true, data: updated })
}

export async function handleDeleteNote(userId: string, noteId: string, env: Env): Promise<Response> {
  await env.SMART_NOTE_KV.delete(noteKey(userId, noteId))

  const index = (await getJSON<{ notes: NoteIndexItem[] }>(env.SMART_NOTE_KV, indexKey(userId))) || { notes: [] }
  index.notes = index.notes.filter((n) => n.id !== noteId)
  await putJSON(env.SMART_NOTE_KV, indexKey(userId), index)

  // A deleted note must not stay reachable through its share link
  await env.SMART_NOTE_KV.delete(`shared_notes/${noteId}`)

  return jsonResponse({ success: true })
}

export async function handleUpdateNoteShare(
  userId: string,
  noteId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const existing = await getJSON<NoteData>(env.SMART_NOTE_KV, noteKey(userId, noteId))
  if (!existing) return errorResponse('Note not found', 404)

  const body = (await request.json()) as any
  const isPublic = !!body.isPublic
  const sharedWith = Array.isArray(body.sharedWith) ? body.sharedWith : []

  // Sharing is metadata: keep updatedAt so it does not look like a content edit (or trip conflicts)
  const updated: NoteData = {
    ...existing,
    isPublic,
    sharedWith
  }

  await putJSON(env.SMART_NOTE_KV, noteKey(userId, noteId), updated)

  // Update global mapping
  if (isPublic || sharedWith.length > 0) {
    await putJSON(env.SMART_NOTE_KV, `shared_notes/${noteId}`, { ownerId: userId, isPublic, sharedWith })
  } else {
    await env.SMART_NOTE_KV.delete(`shared_notes/${noteId}`)
  }

  return jsonResponse({ success: true, data: updated })
}

export async function handleGetSharedNote(noteId: string, request: Request, env: Env): Promise<Response> {
  const shareMeta = await getJSON<{ ownerId: string, isPublic: boolean, sharedWith: string[] }>(
    env.SMART_NOTE_KV,
    `shared_notes/${noteId}`
  )
  if (!shareMeta) return errorResponse('Shared note not found', 404)

  if (!shareMeta.isPublic) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return errorResponse('Unauthorized. Login required.', 401)

    const token = authHeader.substring(7)
    const { verifyJWT } = await import('../utils/jwt')
    const payload = await verifyJWT(token, env.JWT_SECRET)
    if (!payload) return errorResponse('Invalid token', 401)

    const user = await getJSON<UserData>(env.SMART_NOTE_KV, `users/${payload.userId}/profile`)
    if (!user || !shareMeta.sharedWith.includes(user.email)) {
       return errorResponse('Forbidden: You do not have access to this note', 403)
    }
  }

  const note = await getJSON<NoteData>(env.SMART_NOTE_KV, noteKey(shareMeta.ownerId, noteId))
  if (!note) return errorResponse('Note not found', 404)

  // Omit some sensitive info if needed, but it's just a note.
  return jsonResponse({ success: true, data: note })
}
