import { reactive, computed, shallowRef, ref } from 'vue'
import { getItem, setItem, removeItem } from '../utils/storage.js'
import { generateId } from '../utils/id.js'

const SESSIONS_KEY = 'chat-sessions'

function sessionKey(id) {
  return 'chat-session:' + id
}

function stripImages(messages) {
  return messages.map(({ images, ...rest }) => images?.length ? { ...rest, hadImages: true } : rest)
}

function loadSessions() {
  const stored = getItem(SESSIONS_KEY)
  if (!Array.isArray(stored)) return []
  // 旧版单 key 格式：index 内含完整 messages → 迁移为每会话独立 key
  if (stored.length > 0 && Array.isArray(stored[0].messages)) {
    for (const s of stored) {
      setItem(sessionKey(s.id), { messages: stripImages(s.messages || []) })
    }
    const index = stored.map(({ messages, ...meta }) => meta)
    setItem(SESSIONS_KEY, index)
    return stored
  }
  return stored.map(meta => ({
    ...meta,
    messages: getItem(sessionKey(meta.id))?.messages || []
  }))
}

const sessions = reactive(loadSessions())

const storedActiveId = getItem('active-session-id')
const initialActiveId = storedActiveId && sessions.find(s => s.id === storedActiveId)
  ? storedActiveId
  : (sessions.length > 0 ? sessions[0].id : null)
const activeId = shallowRef(initialActiveId)
const persistFailCount = ref(0)
const PERSIST_DEBOUNCE = 300
let persistTimer = null

// 脏会话跟踪：persist 时仅写有变更的会话，避免全量序列化
const dirtySessionIds = new Set()
const removedSessionIds = new Set()

function persist() {
  let ok = setItem(SESSIONS_KEY, sessions.map(({ messages, ...meta }) => meta))
  for (const id of removedSessionIds) {
    if (!removeItem(sessionKey(id))) ok = false
  }
  for (const id of dirtySessionIds) {
    if (removedSessionIds.has(id)) continue
    const session = sessions.find(s => s.id === id)
    if (!session) continue
    if (!setItem(sessionKey(id), { messages: stripImages(session.messages) })) ok = false
  }
  removedSessionIds.clear()
  dirtySessionIds.clear()
  if (!ok) persistFailCount.value++
}

export function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  persist()
}

function schedulePersist() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => { persistTimer = null; persist() }, PERSIST_DEBOUNCE)
}

// Flush pending writes when the app is about to close/hide
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPersist)
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
    dirtySessionIds.add(session.id)
    schedulePersist()
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
    dirtySessionIds.delete(id)
    removedSessionIds.add(id)
    if (activeId.value === id) {
      activeId.value = sessions.length > 0 ? sessions[0].id : null
      if (activeId.value) setItem('active-session-id', activeId.value)
    }
    schedulePersist()
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
    dirtySessionIds.add(sessionId)
    schedulePersist()
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
    persistFailCount: computed(() => persistFailCount.value),
    createSession,
    switchSession,
    deleteSession,
    addMessage,
    ensureActiveSession
  }
}
