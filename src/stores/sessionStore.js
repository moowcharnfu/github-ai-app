import { reactive, computed, shallowRef } from 'vue'
import { getItem, setItem } from '../utils/storage.js'

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

const sessions = reactive(
  getItem('chat-sessions') || []
)

const storedActiveId = getItem('active-session-id')
const initialActiveId = storedActiveId && sessions.find(s => s.id === storedActiveId)
  ? storedActiveId
  : (sessions.length > 0 ? sessions[0].id : null)
const activeId = shallowRef(initialActiveId)

function persist() {
  setItem('chat-sessions', sessions.map(s => ({
    ...s,
    // Strip base64 image data to avoid localStorage quota overflow
    messages: s.messages.map(({ images, ...rest }) => images?.length ? { ...rest, hadImages: true } : rest)
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
    setItem('active-session-id', session.id)
    persist()
    return session
  }

  function switchSession(id) {
    activeId.value = id
    setItem('active-session-id', id)
  }

  function deleteSession(id) {
    const idx = sessions.findIndex(s => s.id === id)
    if (idx === -1) return

    sessions.splice(idx, 1)
    if (activeId.value === id) {
      activeId.value = sessions.length > 0 ? sessions[0].id : null
      if (activeId.value) setItem('active-session-id', activeId.value)
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
