import { describe, it, expect, vi, beforeEach } from 'vitest'

function setupStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  globalThis.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)) },
    removeItem: (key) => { data.delete(key) }
  }
}

beforeEach(() => {
  vi.resetModules()
})

async function loadStore() {
  return await import('../src/stores/sessionStore.js')
}

describe('sessionStore 旧格式迁移', () => {
  it('旧版单 key 格式自动拆分为按会话独立 key 并剥离图片', async () => {
    setupStorage({
      'github-ai-chat:chat-sessions': JSON.stringify([
        {
          id: 's1',
          title: '旧会话',
          messages: [{ id: 'm1', role: 'user', content: 'hi', images: [{ data: 'abc', mimeType: 'image/png' }] }],
          createdAt: 1,
          updatedAt: 1
        }
      ])
    })

    const { useSessionStore } = await loadStore()
    const store = useSessionStore()

    expect(store.sessions[0].messages[0].content).toBe('hi')

    const index = JSON.parse(localStorage.getItem('github-ai-chat:chat-sessions'))
    expect(index[0].messages).toBeUndefined()
    expect(index[0].title).toBe('旧会话')

    const persisted = JSON.parse(localStorage.getItem('github-ai-chat:chat-session:s1'))
    expect(persisted.messages[0].hadImages).toBe(true)
    expect(persisted.messages[0].images).toBeUndefined()
  })
})

describe('sessionStore 按会话持久化', () => {
  it('新增消息仅写入对应会话 key', async () => {
    setupStorage({})
    const { useSessionStore, flushPersist } = await loadStore()
    const store = useSessionStore()

    const session = store.createSession()
    store.addMessage(session.id, { id: 'm1', role: 'user', content: 'hello', timestamp: 1 })
    flushPersist()

    const index = JSON.parse(localStorage.getItem('github-ai-chat:chat-sessions'))
    expect(index).toHaveLength(1)
    expect(index[0].title).toBe('hello')
    expect(index[0].messages).toBeUndefined()

    const persisted = JSON.parse(localStorage.getItem('github-ai-chat:chat-session:' + session.id))
    expect(persisted.messages).toHaveLength(1)
    expect(persisted.messages[0].content).toBe('hello')
  })

  it('删除会话后清理对应独立 key', async () => {
    setupStorage({})
    const { useSessionStore, flushPersist } = await loadStore()
    const store = useSessionStore()

    const s1 = store.createSession()
    const s2 = store.createSession()
    flushPersist()

    store.deleteSession(s1.id)
    flushPersist()

    expect(localStorage.getItem('github-ai-chat:chat-session:' + s1.id)).toBeNull()
    expect(JSON.parse(localStorage.getItem('github-ai-chat:chat-session:' + s2.id)).messages).toEqual([])

    const index = JSON.parse(localStorage.getItem('github-ai-chat:chat-sessions'))
    expect(index).toHaveLength(1)
    expect(index[0].id).toBe(s2.id)
  })

  it('持久化失败时递增 persistFailCount', async () => {
    setupStorage({})
    const { useSessionStore, flushPersist } = await loadStore()
    const store = useSessionStore()

    const session = store.createSession()
    localStorage.setItem = () => { throw new Error('quota') }
    store.addMessage(session.id, { id: 'm1', role: 'user', content: 'hello', timestamp: 1 })
    flushPersist()

    expect(store.persistFailCount.value).toBe(1)
  })
})
