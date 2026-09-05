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
  // Regular browser / Vite dev has no Tauri bridge, so native fetch works
  if (!globalThis.__TAURI_INTERNALS__) {
    _fetch = globalThis.fetch.bind(globalThis)
    return _fetch
  }
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

export function parseSseDataLine(line) {
  const trimmed = line.trim()
  if (!trimmed || !trimmed.startsWith('data:')) return null
  return trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5)
}

export async function sendChatMessage({
  apiUrl, apiKey, model, messages, signal, onToken,
  timeout = 120000, temperature = 1, maxTokens = 4096, topP = 1
}) {
  const useStream = !!onToken

  if (!model) {
    const err = new Error('模型配置为空')
    err.name = 'InvalidConfigError'
    throw err
  }
  if (!apiKey) {
    const err = new Error('API 密钥为空')
    err.name = 'InvalidConfigError'
    throw err
  }

  const body = {
    model,
    messages: messages.map(toApiMessage),
    temperature,
    max_tokens: maxTokens,
    top_p: topP,
    stream: useStream
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }
  if (useStream) headers['Accept'] = 'text/event-stream'

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
    if (signal?.aborted) {
      // 归一化中断错误：Tauri plugin-http 的 abort 错误名可能不是 AbortError
      if (err.name === 'AbortError') throw err
      const abortErr = new Error(err.message || '请求已中断')
      abortErr.name = 'AbortError'
      throw abortErr
    }
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

  if (!response.body) throw new Error('响应体为空')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''
  let eventData = ''
  let completed = false

  function flushEvent() {
    if (!eventData || eventData === '[DONE]') {
      eventData = ''
      return
    }
    let parsed
    try {
      parsed = JSON.parse(eventData)
    } catch {
      // skip malformed JSON chunks
      eventData = ''
      return
    }
    eventData = ''
    // 部分兼容网关出错时返回 200 + JSON 错误体，需透出真实原因
    if (parsed && typeof parsed === 'object' && parsed.error) {
      throw new Error(`API 错误: ${apiErrorMessage(parsed.error)}`)
    }
    const delta = parsed.choices?.[0]?.delta?.content
    if (delta) {
      fullContent += delta
      onToken(delta, fullContent)
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) { completed = true; break }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim() === '') {
          flushEvent()
          continue
        }
        const data = parseSseDataLine(line)
        if (data !== null) {
          eventData = eventData ? eventData + '\n' + data : data
        }
      }
    }

    // process remaining buffer
    buffer += decoder.decode()  // flush decoder's internal multibyte buffer
    const tailData = parseSseDataLine(buffer)
    if (tailData !== null) {
      eventData = eventData ? eventData + '\n' + tailData : tailData
    }
    flushEvent()
  } finally {
    // On interruption (abort/timeout), cancel the stream to release the connection
    if (!completed) {
      try { await reader.cancel() } catch { /* ignore */ }
    }
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

  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('响应格式异常（非 JSON）')
  }
  if (json && typeof json === 'object' && json.error) {
    throw new Error(`API 错误: ${apiErrorMessage(json.error)}`)
  }
  return json.choices?.[0]?.message?.content || ''
}

function apiErrorMessage(error) {
  if (typeof error === 'string') return error
  return error?.message || '未知错误'
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
