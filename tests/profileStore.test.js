import { describe, it, expect, vi } from 'vitest'

function setupStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  globalThis.localStorage = {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)) },
    removeItem: (key) => { data.delete(key) }
  }
}

describe('profile store', () => {
  it('加载历史配置时保留持久化的 apiKey', async () => {
    vi.resetModules()
    setupStorage({
      'github-ai-chat:config-profiles': JSON.stringify([
        { id: 'p1', name: '默认配置', apiUrl: 'https://api.example.com', apiKey: 'sk-stored', model: 'gpt-4o' }
      ]),
      'github-ai-chat:active-profile-id': JSON.stringify('p1')
    })

    const { useProfileStore } = await import('../src/stores/configProfileStore.js')
    const store = useProfileStore()

    expect(store.profiles[0].apiKey).toBe('sk-stored')
  })

  it('apiKey 更新后写入存储持久化保存', async () => {
    vi.resetModules()
    setupStorage({
      'github-ai-chat:config-profiles': JSON.stringify([
        { id: 'p1', name: '默认配置', apiUrl: 'https://api.example.com', model: 'gpt-4o' }
      ]),
      'github-ai-chat:active-profile-id': JSON.stringify('p1')
    })

    const { useProfileStore } = await import('../src/stores/configProfileStore.js')
    const store = useProfileStore()

    store.updateProfile('p1', { apiKey: 'sk-live' })
    expect(store.profiles[0].apiKey).toBe('sk-live')

    const persisted = JSON.parse(localStorage.getItem('github-ai-chat:config-profiles'))
    expect(persisted[0].apiKey).toBe('sk-live')
    expect(JSON.stringify(persisted)).toContain('sk-live')
  })
})
