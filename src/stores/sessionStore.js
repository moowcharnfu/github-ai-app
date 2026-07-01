import { reactive, computed, shallowRef } from 'vue'
import { getItem, setItem } from '../utils/storage.js'

let nextId = 1

function generateId() {
  return Date.now().toString(36) + '-' + (nextId++).toString(36)
}

const sessions = reactive(
  getItem('chat-sessions') || []
)

const activeId = shallowRef(sessions.length > 0 ? sessions[0].id : null)

function persist() {
  setItem('chat-sessions', sessions.map(s => ({
    ...s,
    messages: s.messages
  })))
}

export function useSessionStore() {
  const activeSession = computed(() => {
    return sessions.find(s => s.id === activeId.value) || null
  })

  function createSession() {
    const session = {
      id: generateId(),
      title: '新会话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    sessions.unshift(session)
    activeId.value = session.id
    persist()
    return session
  }

  function switchSession(id) {
    activeId.value = id
  }

  function deleteSession(id) {
    const idx = sessions.findIndex(s => s.id === id)
    if (idx === -1) return

    sessions.splice(idx, 1)
    if (activeId.value === id) {
      activeId.value = sessions.length > 0 ? sessions[0].id : null
    }
    persist()
  }

  function addMessage(sessionId, message) {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    session.messages.push(message)
    session.updatedAt = Date.now()

    // Auto-title: use first user message (truncated to 20 chars)
    if (session.title === '新会话' && message.role === 'user') {
      const hasImages = message.images && message.images.length > 0
      const txt = message.content.trim()
      session.title = txt
        ? txt.slice(0, 20) + (txt.length > 20 ? '...' : '')
        : hasImages
          ? '📷 图片'
          : '消息'
    }
    persist()
  }

  function updateLastMessage(sessionId, content) {
    const session = sessions.find(s => s.id === sessionId)
    if (!session || session.messages.length === 0) return

    const last = session.messages[session.messages.length - 1]
    if (last.role === 'assistant') {
      last.content = content
      last.timestamp = Date.now()
      session.updatedAt = Date.now()
      persist()
    }
  }

  function ensureActiveSession() {
    if (!activeId.value) {
      createSession()
    }
    return activeSession.value
  }

  return {
    sessions,
    activeId: computed(() => activeSession.value?.id || null),
    activeSession,
    createSession,
    switchSession,
    deleteSession,
    addMessage,
    updateLastMessage,
    ensureActiveSession
  }
}
