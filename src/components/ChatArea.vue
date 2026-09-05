
<template>
  <div class="chat-area">
    <div v-if="!activeSession" class="welcome">
      <div class="welcome-content">
        <div class="welcome-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h1>GitHub AI Chat</h1>
        <p>点击「+」新建会话开始对话</p>
      </div>
    </div>

    <template v-else>
      <div class="messages" ref="messagesRef">
        <MessageBubble
          v-for="msg in activeSession.messages"
          :key="msg.id"
          :message="msg"
          :streaming="false"
        />
        <MessageBubble
          v-if="isViewingReplySession"
          :message="currentReply"
          :streaming="isStreaming"
        />
      </div>

      <div class="input-bar">
        <Transition name="error-fade">
          <div v-if="errorMsg" class="error-toast">{{ errorMsg }}</div>
        </Transition>
        <div v-if="pendingImage" class="image-preview">
          <div class="preview-item">
            <img :src="`data:${pendingImage.mimeType};base64,${pendingImage.data}`" class="preview-thumb" />
            <button class="preview-remove" @click="removeImage" title="移除图片">✕</button>
          </div>
        </div>
        <div class="input-wrapper">
          <button class="img-btn" @click="pickImage" :disabled="isLoading" title="添加图片">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" stroke-width="1.2"/>
              <circle cx="5" cy="6" r="1.5" stroke="currentColor" stroke-width="1.2"/>
              <path d="M1 11l3.5-3 2 2L11 6l4 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <textarea
            ref="inputRef"
            v-model="inputText"
            placeholder="输入消息..."
            rows="1"
            @keydown.enter.exact.prevent="send"
            @input="autoResize"
            :disabled="isLoading"
          />
          <button
            v-if="isStreaming && isViewingReplySession"
            class="stop-btn"
            @click="stopGeneration"
            title="停止生成"
          >
            ⏹
          </button>
          <button
            v-else
            class="send-btn"
            :class="{ loading: isLoading }"
            :disabled="isLoading || (!inputText.trim() && !pendingImage)"
            @click="send"
          >
            <span v-if="isLoading" class="spinner"></span>
            <span v-else>发送</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { useSessionStore } from '../stores/sessionStore.js'
import { useConfig } from '../stores/configStore.js'
import { sendChatMessage } from '../utils/api.js'
import { generateId } from '../utils/id.js'
import MessageBubble from './MessageBubble.vue'

const store = useSessionStore()
const config = useConfig()

const inputText = ref('')
const inputRef = ref(null)
const messagesRef = ref(null)
const isLoading = ref(false)
const isStreaming = ref(false)
const currentReply = ref(null)
const pendingImage = ref(null)
let abortController = null
const MAX_IMAGE_BYTES = 10 * 1024 * 1024


const activeSession = store.activeSession

// 后台生成：切换会话不中断请求，流式气泡仅在生成所属会话中显示
const replySessionId = ref(null)
const isViewingReplySession = computed(() => {
  return !!currentReply.value && replySessionId.value === activeSession.value?.id
})

const errorMsg = ref('')
let errorTimer = null
let latestContent = ''
let streamRaf = null

function showError(msg) {
  errorMsg.value = msg
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => { errorMsg.value = '' }, 3000)
}

let resizeRaf = null
function autoResize(e) {
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  })
}

function scrollToBottom(smooth = true) {
  nextTick(() => {
    const el = messagesRef.value
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  })
}

async function pickImage() {
  if (isLoading.value) return
  if (!globalThis.__TAURI_INTERNALS__) {
    pickImageBrowser()
    return
  }
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readFile } = await import('@tauri-apps/plugin-fs')

  const selected = await open({
    multiple: false,
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg'] }]
  })
  if (!selected) return

  try {
    const bytes = await readFile(selected)
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    if (data.length > MAX_IMAGE_BYTES) {
      showError('图片过大，请选择 10MB 以内的图片')
      return
    }
    const base64 = arrayToBase64(data)
    const mimeType = selected.match(/\.png$/i) ? 'image/png' : 'image/jpeg'
    pendingImage.value = { data: base64, mimeType }
  } catch {
    showError('读取图片失败')
  }
}

function pickImageBrowser() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,image/jpeg'
  input.onchange = () => {
    const file = input.files && input.files[0]
    if (!file) return
    if (file.size > MAX_IMAGE_BYTES) {
      showError('图片过大，请选择 10MB 以内的图片')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') return
      const commaIdx = result.indexOf(',')
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result
      pendingImage.value = { data: base64, mimeType: file.type }
    }
    reader.onerror = () => showError('读取图片失败')
    reader.readAsDataURL(file)
  }
  input.addEventListener('change', () => { input.value = '' }, { once: true })
  input.click()
}

function arrayToBase64(arr) {
  const chunkSize = 8192
  const parts = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, i + chunkSize)
    parts.push(String.fromCharCode(...chunk))
  }
  return btoa(parts.join(''))
}

function removeImage() {
  pendingImage.value = null
}

// 保存 AI 回复并关闭流式气泡
function persistAssistantReply(sessionId, replyId, content, requestStart) {
  store.addMessage(sessionId, {
    id: replyId,
    role: 'assistant',
    content,
    timestamp: Date.now(),
    elapsed: ((Date.now() - requestStart) / 1000).toFixed(1)
  })
  currentReply.value = null
}

function restoreDraft(sessionId, text) {
  if (activeSession.value?.id === sessionId) inputText.value = text
}

// 仅保留最近一条携带图片的用户消息，避免多轮对话重发全部 base64 图片
function buildRequestMessages(session) {
  let imageIdx = -1
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const m = session.messages[i]
    if (m.role === 'user' && m.images?.length) {
      imageIdx = i
      break
    }
  }
  return session.messages.map((m, i) => {
    const msg = { role: m.role, content: m.content }
    if (i === imageIdx) msg.images = m.images
    return msg
  })
}

async function send() {
  const text = inputText.value.trim()
  if ((!text && !pendingImage.value) || isLoading.value) return

  if (!config.apiKey) {
    showError('请先在顶部配置 API 密钥')
    return
  }
  if (!config.apiUrl) {
    showError('请配置 API 地址')
    return
  }

  const session = store.ensureActiveSession()
  if (!session) return

  const draftedText = inputText.value
  const draftedImage = pendingImage.value
  inputText.value = ''

  const msgData = { id: generateId('user'), role: 'user', content: text || '[图片]', timestamp: Date.now() }
  if (draftedImage) {
    msgData.images = [draftedImage]
  }
  store.addMessage(session.id, msgData)

  const requestMessages = buildRequestMessages(session)

  const replyId = generateId('assistant')
  const replyMsg = {
    id: replyId,
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  }
  currentReply.value = replyMsg
  replySessionId.value = session.id
  isLoading.value = true
  isStreaming.value = true

  abortController = new AbortController()
  const requestStart = Date.now()
  latestContent = ''
  let success = false

  // 中断/超时/最终失败时：保存已有部分回复，恢复输入与待发图片
  const saveIfPartial = () => {
    if (latestContent) {
      persistAssistantReply(session.id, replyId, latestContent, requestStart)
    } else {
      currentReply.value = null
    }
    restoreDraft(session.id, draftedText)
  }

  const buildRequest = (onToken, timeout) => ({
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    model: config.model,
    messages: requestMessages,
    signal: abortController.signal,
    onToken,
    timeout
  })

  try {
    await sendChatMessage(buildRequest((delta, fullContent) => {
      latestContent = fullContent
      if (streamRaf) return
      streamRaf = requestAnimationFrame(() => {
        streamRaf = null
        replyMsg.content = latestContent
        // 仅在用户正查看生成会话时滚动，避免干扰其他 Tab 的阅读位置
        if (isViewingReplySession.value) scrollToBottom(false)
      })
    }, 120000))

    if (streamRaf) { cancelAnimationFrame(streamRaf); streamRaf = null }
    replyMsg.content = latestContent
    if (latestContent) {
      persistAssistantReply(session.id, replyId, latestContent, requestStart)
      success = true
    } else {
      showError('收到空回复')
      currentReply.value = null
      restoreDraft(session.id, draftedText)
    }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      if (err.name === 'TimeoutError') showError('请求超时')
      saveIfPartial()
    } else {
      // 流式失败 → 非流式重试；保持停止按钮可用
      showError('流式请求失败，正在重试...')
      isStreaming.value = true
      try {
        const result = await sendChatMessage(buildRequest(null, 30000))
        replyMsg.content = result
        latestContent = result
        if (latestContent) {
          persistAssistantReply(session.id, replyId, latestContent, requestStart)
          success = true
        } else {
          showError('收到空回复')
          currentReply.value = null
          restoreDraft(session.id, draftedText)
        }
      } catch (fallbackErr) {
        if (fallbackErr.name !== 'AbortError') {
          showError(`错误: ${fallbackErr.message}`)
        }
        saveIfPartial()
      }
    }
  }

  isLoading.value = false
  isStreaming.value = false
  abortController = null
  replySessionId.value = null
  // 成功则清空图片，失败则恢复待发送图片（仅仍在生成会话时）
  if (success) {
    pendingImage.value = null
  } else if (draftedImage && activeSession.value?.id === session.id) {
    pendingImage.value = draftedImage
  }
  if (activeSession.value?.id === session.id) {
    scrollToBottom()
    nextTick(() => inputRef.value?.focus())
  }
}

function stopGeneration() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

watch(activeSession, () => {
  nextTick(() => {
    scrollToBottom(false)
    inputRef.value?.focus()
  })
})

// 生成所属会话被删除时终止请求，避免无意义消耗
watch(() => !replySessionId.value || store.sessions.some(s => s.id === replySessionId.value), (alive) => {
  if (!alive && (isLoading.value || isStreaming.value)) {
    stopGeneration()
  }
})

watch(() => store.persistFailCount.value, () => {
  showError('存储空间不足，部分消息可能无法保存')
})

onUnmounted(() => {
  clearTimeout(errorTimer)
  if (streamRaf) cancelAnimationFrame(streamRaf)
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  if (abortController) {
    abortController.abort()
  }
})
</script>

<style scoped>
.chat-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0f0f23;
}

.welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-content {
  text-align: center;
  padding: 44px 60px;
  background: #13132a;
  border: 1px solid #232348;
  border-radius: 28px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(74, 158, 255, 0.06);
}

.welcome-icon {
  width: 54px;
  height: 54px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6fb4ff;
  background: linear-gradient(135deg, #16304f, #1a1a3e);
  border: 1px solid #2c4a75;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(74, 158, 255, 0.18);
}

.welcome-content h1 {
  font-size: 26px;
  color: #4a9eff;
  margin: 0 0 10px;
  letter-spacing: 0;
}

.welcome-content p {
  color: #7a7aa0;
  font-size: 14px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
}

.input-bar {
  padding: 14px 20px 18px;
  border-top: 1px solid #2a2a4a;
  background: linear-gradient(180deg, #11112a, #0f0f23);
  position: relative;
}

.error-toast {
  position: absolute;
  left: 50%;
  bottom: calc(100% - 6px);
  transform: translateX(-50%);
  z-index: 10;
  max-width: 90%;
  padding: 8px 14px;
  background: #3a1620;
  color: #ff9d9d;
  border: 1px solid #7a2e3e;
  border-radius: 14px;
  font-size: 13px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  white-space: normal;
  overflow-wrap: anywhere;
}

.error-fade-enter-active,
.error-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}

.image-preview {
  display: flex;
  gap: 8px;
  padding: 0 0 10px;
}

.preview-item {
  position: relative;
  width: 80px;
  height: 80px;
  border: 1px solid #2a2a4a;
  border-radius: 16px;
  overflow: hidden;
  background: #1a1a2e;
}

.preview-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.7);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.preview-remove:hover {
  background: rgba(255,74,74,0.8);
}

.input-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 22px;
  padding: 8px 8px 8px 20px;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
}

.input-wrapper:hover {
  border-color: #3a3a5e;
}

.input-wrapper:focus-within {
  border-color: #4a9eff;
  box-shadow: 0 0 0 4px rgba(74, 158, 255, 0.14), 0 10px 32px rgba(0, 0, 0, 0.32);
}

.input-wrapper textarea {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: #e0e0e0;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  max-height: 150px;
  line-height: 1.5;
}

.input-wrapper textarea::placeholder {
  color: #555;
}

.img-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  width: 36px;
  height: 36px;
  margin-bottom: 2px;
  border-radius: 12px;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s, transform 0.12s;
}

.img-btn:hover:not(:disabled) {
  color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.img-btn:active:not(:disabled) {
  transform: scale(0.9);
}

.img-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.send-btn, .stop-btn {
  padding: 8px 24px;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s, transform 0.12s, box-shadow 0.2s;
  white-space: nowrap;
  letter-spacing: 0.3px;
  min-height: 36px;
  align-self: center;
}

.send-btn:active, .stop-btn:active {
  transform: scale(0.96);
}

.send-btn {
  background: linear-gradient(135deg, #4a9eff, #3a7eef);
  color: #fff;
  box-shadow: 0 2px 8px rgba(74, 158, 255, 0.2);
}

.send-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #5aaeff, #4a8eff);
  box-shadow: 0 4px 14px rgba(74, 158, 255, 0.35);
  transform: translateY(-1px);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn:hover:not(:disabled):active {
  transform: translateY(-1px) scale(0.96);
}

.stop-btn {
  background: linear-gradient(135deg, #ff4a4a, #e03a3a);
  color: #fff;
  box-shadow: 0 2px 8px rgba(255, 74, 74, 0.2);
}

.stop-btn:hover {
  background: linear-gradient(135deg, #ff5a5a, #f04a4a);
  box-shadow: 0 4px 14px rgba(255, 74, 74, 0.35);
  transform: translateY(-1px);
}

.loading .spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
