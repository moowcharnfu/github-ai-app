// ── Fetch selection: Tauri plugin (CORS-free) or native browser fetch ──

let _fetch = null

class TimeoutError extends Error {
  constructor(message = '请求超时') {
    super(message)
    this.name = 'TimeoutError'
  }
}

async function resolveFetch() {
  if (_fetch) return _fetch
  try {
    // Tauri plugin-http — runs HTTP from Rust side, bypasses WebView CORS
    const { fetch } = await import('@tauri-apps/plugin-http')
    _fetch = fetch
  } catch {
    // Fallback to native fetch (browser / web dev mode)
    _fetch = globalThis.fetch.bind(globalThis)
  }
  return _fetch
}

export async function sendChatMessage({ apiUrl, apiKey, model, messages, signal, onToken, timeout = 120000 }) {
  const useStream = !!onToken

  if (!model) {
    const err = new Error('模型配置为空')
    err.name = 'InvalidConfigError'
    throw err
  }

  const body = {
    model,
    messages: messages.map(toApiMessage),
    temperature: 1,
    max_tokens: 4096,
    top_p: 1,
    stream: useStream
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }

  const fetch = await resolveFetch()

  // Combine user abort signal with timeout
  const combinedController = new AbortController()
  const onUserAbort = () => combinedController.abort()
  let timedOut = false
  const timeoutId = setTimeout(() => { timedOut = true; combinedController.abort() }, timeout)

  if (signal) {
    if (signal.aborted) {
      combinedController.abort()
    } else {
      signal.addEventListener('abort', onUserAbort, { once: true })
    }
  }

  try {
    if (useStream) {
      return await sendStreamingRequest(fetch, apiUrl, headers, body, combinedController.signal, onToken)
    } else {
      return await sendRegularRequest(fetch, apiUrl, headers, body, combinedController.signal)
    }
  } catch (err) {
    if (timedOut) throw new TimeoutError()
    if (err.name === 'AbortError' && signal?.aborted) throw err
    if (err.name === 'AbortError') throw new TimeoutError()
    throw err
  } finally {
    clearTimeout(timeoutId)
    if (signal) signal.removeEventListener('abort', onUserAbort)
  }
}

// ── Standard streaming ──

async function sendStreamingRequest(fetch, url, headers, body, signal, onToken) {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`API error ${response.status}: ${errText || response.statusText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            onToken(delta, fullContent)
          }
        } catch {
          // skip malformed JSON chunks
        }
      }
    }

    // process remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6)
      if (data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            onToken(delta, fullContent)
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    try { reader.releaseLock() } catch { /* ignore */ }
  }

  return fullContent
}

// ── Non-streaming ──

async function sendRegularRequest(fetch, url, headers, body, signal) {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, stream: false }),
    signal
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`API error ${response.status}: ${errText || response.statusText}`)
  }

  const text = await response.text().catch(() => '')
  if (!text) return ''

  const json = JSON.parse(text)
  return json.choices?.[0]?.message?.content || ''
}

// ── Message format conversion ──

function toApiMessage(m) {
  if (m.role !== 'user' || !m.images || m.images.length === 0) {
    return { role: m.role, content: m.content }
  }
  const parts = [{ type: 'text', text: m.content || '' }]
  for (const img of m.images) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.data}` }
    })
  }
  return { role: m.role, content: parts }
}
