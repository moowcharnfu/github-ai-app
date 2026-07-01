<template>
  <div class="chat-area">
    <div v-if="!activeSession" class="welcome">
      <div class="welcome-content">
        <h1>GitHub AI Chat</h1>
        <p>点击「+」新建会话开始对话</p>
      </div>
    </div>

    <template v-else>
      <div class="messages" ref="messagesRef" @scroll="onScroll">
        <MessageBubble
          v-for="msg in activeSession.messages"
          :key="msg.id"
          :message="msg"
          :streaming="false"
        />
        <MessageBubble
          v-if="currentReply"
          :message="currentReply"
          :streaming="isStreaming"
        />
      </div>

      <div class="input-bar">
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
            v-if="isStreaming"
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
import { ref, nextTick, watch } from 'vue'
import { useSessionStore } from '../stores/sessionStore.js'
import { useConfig } from '../stores/configStore.js'
import { sendChatMessage } from '../utils/api.js'
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
let isAutoScroll = true

const activeSession = store.activeSession

function autoResize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 150) + 'px'
}

function scrollToBottom(smooth = true) {
  nextTick(() => {
    const el = messagesRef.value
    if (el && isAutoScroll) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  })
}

function onScroll() {
  const el = messagesRef.value
  if (!el) return
  const threshold = 50
  isAutoScroll = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

async function pickImage() {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readFile } = await import('@tauri-apps/plugin-fs')

  const selected = await open({
    multiple: false,
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg'] }]
  })
  if (!selected) return

  try {
    const bytes = await readFile(selected)
    const base64 = arrayToBase64(new Uint8Array(bytes))
    const mimeType = selected.match(/\.png$/i) ? 'image/png' : 'image/jpeg'
    pendingImage.value = { data: base64, mimeType }
  } catch (e) {
    console.warn('读取图片失败:', e)
  }
}

function arrayToBase64(arr) {
  const chunkSize = 8192
  let result = ''
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.subarray(i, i + chunkSize)
    result += String.fromCharCode(...chunk)
  }
  return btoa(result)
}

function removeImage() {
  pendingImage.value = null
}

async function send() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  const session = store.ensureActiveSession()
  if (!session) return

  if (!config.apiKey) {
    alert('请先在顶部配置 API 密钥')
    return
  }
  if (!config.apiUrl) {
    alert('请配置 API 地址')
    return
  }

  inputText.value = ''

  const msgData = { id: Date.now().toString(36) + '-user', role: 'user', content: text, timestamp: Date.now() }
  if (pendingImage.value) {
    msgData.images = [pendingImage.value]
  }
  store.addMessage(session.id, msgData)
  pendingImage.value = null

  const messages = session.messages.map(m => ({
    role: m.role,
    content: m.content,
    images: m.images
  }))

  const replyId = Date.now().toString(36) + '-assistant'
  const replyMsg = {
    id: replyId,
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  }
  currentReply.value = replyMsg
  isLoading.value = true
  isStreaming.value = true

  abortController = new AbortController()
  const requestStart = Date.now()

  try {
    await sendChatMessage({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: messages.concat([{ role: 'user', content: text }]),
      signal: abortController.signal,
      onToken: (delta, fullContent) => {
        requestAnimationFrame(() => {
          replyMsg.content = fullContent
          scrollToBottom()
        })
      }
    })

    store.addMessage(session.id, {
      id: replyId,
      role: 'assistant',
      content: replyMsg.content,
      timestamp: Date.now(),
      elapsed: ((Date.now() - requestStart) / 1000).toFixed(1)
    })
    currentReply.value = null
  } catch (err) {
    if (err.name === 'AbortError') {
      if (replyMsg.content) {
        store.addMessage(session.id, {
          id: replyId,
          role: 'assistant',
          content: replyMsg.content,
          timestamp: Date.now(),
          elapsed: ((Date.now() - requestStart) / 1000).toFixed(1)
        })
      }
      currentReply.value = null
    } else {
      console.warn('Streaming failed, trying non-streaming:', err)
      try {
        const result = await sendChatMessage({
          apiUrl: config.apiUrl,
          apiKey: config.apiKey,
          model: config.model,
          messages: messages.concat([{ role: 'user', content: text }]),
          signal: abortController.signal,
          onToken: null
        })
        replyMsg.content = result
        store.addMessage(session.id, {
          id: replyId,
          role: 'assistant',
          content: result,
          timestamp: Date.now(),
          elapsed: ((Date.now() - requestStart) / 1000).toFixed(1)
        })
        currentReply.value = null
      } catch (fallbackErr) {
        if (fallbackErr.name !== 'AbortError') {
          replyMsg.content = `错误: ${fallbackErr.message}`
        }
        store.addMessage(session.id, {
          id: replyId,
          role: 'assistant',
          content: replyMsg.content,
          timestamp: Date.now(),
          elapsed: ((Date.now() - requestStart) / 1000).toFixed(1)
        })
        currentReply.value = null
      }
    }
  }

  isLoading.value = false
  isStreaming.value = false
  abortController = null
  scrollToBottom()
  nextTick(() => inputRef.value?.focus())
}

function stopGeneration() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

// Auto-scroll and auto-focus when switching sessions
watch(activeSession, () => {
  nextTick(() => {
    scrollToBottom(false)
    inputRef.value?.focus()
  })
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
}

.welcome-content h1 {
  font-size: 24px;
  color: #4a9eff;
  margin: 0 0 8px;
}

.welcome-content p {
  color: #666;
  font-size: 14px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.input-bar {
  padding: 14px 18px;
  border-top: 1px solid #2a2a4a;
  background: #0f0f23;
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
  border-radius: 8px;
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
  width: 20px;
  height: 20px;
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
  border-radius: 14px;
  padding: 10px 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-wrapper:focus-within {
  border-color: #4a9eff;
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.1);
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
  padding: 4px;
  margin-bottom: 2px;
  border-radius: 6px;
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
  padding: 8px 20px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s, transform 0.12s, box-shadow 0.2s;
  white-space: nowrap;
  letter-spacing: 0.3px;
  min-height: 34px;
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
