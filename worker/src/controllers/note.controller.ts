import { Env, UserData, NoteData } from '../types'
import { errorResponse, jsonResponse } from '../utils/response'
import { generateId } from '../utils/crypto'
import { getJSON, putJSON } from '../services/kv.service'

// ====== Note Handlers ======

export async function handleListNotes(userId: string, env: Env): Promise<Response> {
  const index = await getJSON<{ notes: any[] }>(
    env.SMART_NOTE_KV,
    `users/${userId}/notes/_index`
  )
  return jsonResponse({ success: true, data: index?.notes || [] })
}

export async function handleGetNote(userId: string, noteId: string, env: Env): Promise<Response> {
  const note = await getJSON<NoteData>(env.SMART_NOTE_KV, `users/${userId}/notes/${noteId}`)
  if (!note) return errorResponse('Note not found', 404)
  return jsonResponse({ success: true, data: note })
}

export async function handleCreateNote(userId: string, request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as any
  const id = generateId()
  const now = new Date().toISOString()
  const note: NoteData = {
    id,
    title: body.title || 'Untitled',
    content: body.content || '',
    tags: body.tags || [],
    pinned: body.pinned || false,
    createdAt: now,
    updatedAt: now
  }

  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notes/${id}`, note)

  const index = (await getJSON<{ notes: any[] }>(
    env.SMART_NOTE_KV,
    `users/${userId}/notes/_index`
  )) || { notes: [] }
  index.notes.push({
    id: note.id,
    title: note.title,
    excerpt: note.content.substring(0, 120),
    tags: note.tags,
    pinned: note.pinned,
    updatedAt: note.updatedAt
  })
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notes/_index`, index)

  return jsonResponse({ success: true, data: note }, 201)
}

export async function handleUpdateNote(
  userId: string,
  noteId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const existing = await getJSON<NoteData>(
    env.SMART_NOTE_KV,
    `users/${userId}/notes/${noteId}`
  )
  if (!existing) return errorResponse('Note not found', 404)

  const body = (await request.json()) as any
  // Whitelist editable fields only — prevent id/createdAt overwrite
  const updated: NoteData = {
    ...existing,
    title: body.title !== undefined ? body.title : existing.title,
    content: body.content !== undefined ? body.content : existing.content,
    tags: Array.isArray(body.tags) ? body.tags : existing.tags,
    pinned: typeof body.pinned === 'boolean' ? body.pinned : existing.pinned,
    updatedAt: new Date().toISOString()
  }

  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notes/${noteId}`, updated)

  const index = (await getJSON<{ notes: any[] }>(
    env.SMART_NOTE_KV,
    `users/${userId}/notes/_index`
  )) || { notes: [] }
  const idx = index.notes.findIndex((n: any) => n.id === noteId)
  if (idx !== -1) {
    index.notes[idx] = {
      id: updated.id,
      title: updated.title,
      excerpt: updated.content.substring(0, 120),
      tags: updated.tags,
      pinned: updated.pinned,
      updatedAt: updated.updatedAt
    }
    await putJSON(env.SMART_NOTE_KV, `users/${userId}/notes/_index`, index)
  }

  return jsonResponse({ success: true, data: updated })
}

export async function handleDeleteNote(userId: string, noteId: string, env: Env): Promise<Response> {
  await env.SMART_NOTE_KV.delete(`users/${userId}/notes/${noteId}`)

  const index = (await getJSON<{ notes: any[] }>(
    env.SMART_NOTE_KV,
    `users/${userId}/notes/_index`
  )) || { notes: [] }
  index.notes = index.notes.filter((n: any) => n.id !== noteId)
  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notes/_index`, index)

  return jsonResponse({ success: true })
}

export async function handleUpdateNoteShare(
  userId: string,
  noteId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const existing = await getJSON<NoteData>(
    env.SMART_NOTE_KV,
    `users/${userId}/notes/${noteId}`
  )
  if (!existing) return errorResponse('Note not found', 404)

  const body = (await request.json()) as any
  const isPublic = !!body.isPublic
  const sharedWith = Array.isArray(body.sharedWith) ? body.sharedWith : []

  const updated: NoteData = {
    ...existing,
    isPublic,
    sharedWith,
    updatedAt: new Date().toISOString()
  }

  await putJSON(env.SMART_NOTE_KV, `users/${userId}/notes/${noteId}`, updated)

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

  const note = await getJSON<NoteData>(env.SMART_NOTE_KV, `users/${shareMeta.ownerId}/notes/${noteId}`)
  if (!note) return errorResponse('Note not found', 404)

  // Omit some sensitive info if needed, but it's just a note.
  return jsonResponse({ success: true, data: note })
}
