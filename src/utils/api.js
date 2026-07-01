export async function sendChatMessage({ apiUrl, apiKey, model, messages, signal, onToken }) {
  const useStream = !!onToken
  const hasImages = messages.some(m => m.images && m.images.length > 0)

  if (isSensenovaUrl(apiUrl) && hasImages) {
    return sendSensenovaImageRequest(apiUrl, apiKey, model, messages, signal)
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

  if (useStream) {
    return sendStreamingRequest(apiUrl, headers, body, signal, onToken)
  } else {
    return sendRegularRequest(apiUrl, headers, body, signal)
  }
}

// ── Sensenova image request ──

function isSensenovaUrl(apiUrl) {
  return apiUrl && apiUrl.toLowerCase().includes('sensenova')
}

async function sendSensenovaImageRequest(apiUrl, apiKey, model, messages, signal) {
  // Find the last user message that has images
  const lastImageMsg = [...messages].reverse().find(m => m.images && m.images.length > 0)
  const prompt = lastImageMsg?.content || ''
  const imageData = lastImageMsg?.images?.[0]?.data || ''

  const body = {
    image: imageData,
    prompt,
    model
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`API error ${response.status}: ${errText || response.statusText}`)
  }

  const text = await response.text()
  return parseSensenovaResponse(text)
}

function parseSensenovaResponse(text) {
  if (!text) return ''
  try {
    const json = JSON.parse(text)
    // Sensenova native format: { response: "..." }
    if (json.response && typeof json.response === 'string') return json.response
    // OpenAI compatible format
    if (json.choices?.[0]?.message?.content) return json.choices[0].message.content
    // Fallback: stringify the whole response
    console.warn('Unknown Sensenova response format:', json)
    return JSON.stringify(json)
  } catch {
    // Not JSON: return raw text
    return text
  }
}

// ── Standard streaming ──

async function sendStreamingRequest(url, headers, body, signal, onToken) {
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

  return fullContent
}

// ── Non-streaming ──

async function sendRegularRequest(url, headers, body, signal) {
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

  const json = await response.json()
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