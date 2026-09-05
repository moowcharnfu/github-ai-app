import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const API_URL = 'https://api.example.com/chat/completions'

function setupFetch(mock) {
  vi.stubGlobal('fetch', vi.fn(mock))
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function loadApi() {
  return await import('../src/utils/api.js')
}

const baseArgs = {
  apiUrl: API_URL,
  apiKey: 'sk-test',
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'hi' }]
}

function sseResponse(chunks) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    }
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

describe('sendChatMessage 非流式', () => {
  it('响应非 JSON 时抛出可读错误', async () => {
    setupFetch(async () => new Response('<html>Bad Gateway</html>', { status: 200 }))
    const { sendChatMessage } = await loadApi()
    await expect(sendChatMessage({ ...baseArgs })).rejects.toThrow('响应格式异常')
  })

  it('正常响应返回消息内容', async () => {
    setupFetch(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] }), { status: 200 }))
    const { sendChatMessage } = await loadApi()
    await expect(sendChatMessage({ ...baseArgs })).resolves.toBe('hello')
  })

  it('apiKey 为空时抛出 InvalidConfigError', async () => {
    setupFetch(async () => new Response('{}', { status: 200 }))
    const { sendChatMessage } = await loadApi()
    await expect(sendChatMessage({ ...baseArgs, apiKey: '' })).rejects.toMatchObject({ name: 'InvalidConfigError' })
  })
})

describe('sendChatMessage 中断与超时', () => {
  it('用户中断时即使 fetch 抛非标准错误也归一化为 AbortError', async () => {
    setupFetch((url, opts) => {
      // 模拟 Tauri plugin-http：abort 时抛出的错误 name 不是 AbortError
      if (opts.signal.aborted) return Promise.reject(new Error('Request aborted'))
      return new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true })
      })
    })
    const { sendChatMessage } = await loadApi()
    const controller = new AbortController()
    const pending = sendChatMessage({ ...baseArgs, signal: controller.signal, timeout: 5000 })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('超时后抛出 TimeoutError', async () => {
    setupFetch((url, opts) => new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
    }))
    const { sendChatMessage } = await loadApi()
    await expect(sendChatMessage({ ...baseArgs, timeout: 50 })).rejects.toMatchObject({ name: 'TimeoutError' })
  })
})

describe('sendChatMessage 流式', () => {
  it('SSE 分块解析并回调 onToken', async () => {
    setupFetch(async () => sseResponse([
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
      'data: [DONE]\n\n'
    ]))
    const { sendChatMessage } = await loadApi()
    const tokens = []
    const result = await sendChatMessage({ ...baseArgs, onToken: (delta, full) => tokens.push(full) })
    expect(result).toBe('你好')
    expect(tokens).toEqual(['你', '你好'])
  })

  it('流式响应 200 + JSON 错误体时抛出真实错误', async () => {
    setupFetch(async () => sseResponse(['data: {"error":{"message":"rate limited"}}\n\n']))
    const { sendChatMessage } = await loadApi()
    await expect(sendChatMessage({ ...baseArgs, onToken: () => {} })).rejects.toThrow('API 错误: rate limited')
  })

  it('非流式响应 200 + JSON 错误体时抛出真实错误', async () => {
    setupFetch(async () => new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), { status: 200 }))
    const { sendChatMessage } = await loadApi()
    await expect(sendChatMessage({ ...baseArgs })).rejects.toThrow('API 错误: quota exceeded')
  })

  it('带图片的用户消息转换为 OpenAI vision 格式', async () => {
    let capturedBody = null
    setupFetch(async (url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
    })
    const { sendChatMessage } = await loadApi()
    await sendChatMessage({
      ...baseArgs,
      messages: [{ role: 'user', content: '看图', images: [{ data: 'aGk=', mimeType: 'image/png' }] }]
    })
    expect(capturedBody.messages[0].content).toEqual([
      { type: 'text', text: '看图' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,aGk=' } }
    ])
  })
})
