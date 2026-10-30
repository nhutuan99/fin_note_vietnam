import { ref } from 'vue'
import { httpClient } from '@/shared/api/httpClient'

type AiAction = 'summarize' | 'continue' | 'improve' | 'tags' | 'ask' | 'finance' | 'rewrite_note' | 'format_json'

interface AiPayload {
  action: AiAction
  content: string
  title?: string
  question?: string
  imagesBase64?: string[]
}

// ── Non-streaming (for tags which need the full comma-separated result) ──
async function callAi(payload: AiPayload): Promise<string> {
  const data = await httpClient.post<{ data: string }>('/api/ai', payload)
  return data?.data ?? ''
}

export async function streamAi(
  payload: AiPayload,
  onChunk: (chunk: string) => void,
  onDone?: () => void
): Promise<void> {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || ''
  const { AUTH_TOKEN_KEY } = await import('@/constants/auth')
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  const res = await fetch(`${apiBase}/api/ai/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any)?.error || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') { onDone?.(); return }
      try {
        const json = JSON.parse(raw)
        const token = json?.response ?? ''
        if (token) onChunk(token)
      } catch { /* ignore malformed chunks */ }
    }
  }
  onDone?.()
}

export function useAi() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const streamText = ref('')

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      return await fn()
    } catch (e: any) {
      error.value = e.message ?? 'Lỗi không xác định'
      return null
    } finally {
      loading.value = false
    }
  }

  async function runStream(payload: AiPayload): Promise<void> {
    loading.value = true
    error.value = null
    streamText.value = ''
    try {
      await streamAi(
        payload,
        (chunk) => { streamText.value += chunk },
        () => { loading.value = false }
      )
    } catch (e: any) {
      error.value = e.message ?? 'Lỗi không xác định'
      loading.value = false
    }
  }

  // Non-streaming: only used for tags (needs full result to split by comma)
  const suggestTags = async (title: string, content: string): Promise<string[] | null> => {
    const result = await run(() => callAi({ action: 'tags', content, title }))
    if (!result) return null
    return result.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 5)
  }

  const summarize       = (content: string, imagesBase64?: string[]) => runStream({ action: 'summarize', content, imagesBase64 })
  const continueWriting = (content: string, imagesBase64?: string[]) => runStream({ action: 'continue',  content, imagesBase64 })
  const improveWriting  = (content: string, imagesBase64?: string[]) => runStream({ action: 'improve',   content, imagesBase64 })
  const askAbout        = (content: string, question: string, imagesBase64?: string[]) => runStream({ action: 'ask', content, question, imagesBase64 })

  const rewriteNote     = (content: string, imagesBase64?: string[]) => runStream({ action: 'rewrite_note', content, imagesBase64 })
  const formatJson      = (content: string, imagesBase64?: string[]) => runStream({ action: 'format_json', content, imagesBase64 })

  /**
   * Finance Advisor — dedicated action that tells the model it's a finance expert,
   * not a note Q&A bot. `fullPrompt` must embed the finance context + user question.
   */
  const askFinance      = (fullPrompt: string) => runStream({ action: 'finance', content: fullPrompt })

  return {
    loading,
    error,
    streamText,
    summarize,
    continueWriting,
    improveWriting,
    suggestTags,
    askAbout,
    askFinance,
    rewriteNote,
    formatJson
  }
}

// Backward-compat alias
export const useGemini = useAi
