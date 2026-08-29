<template>
  <div class="message" :class="message.role">
    <div class="avatar">{{ message.role === 'user' ? 'U' : 'AI' }}</div>
    <div class="bubble">
      <div class="bubble-content">
        <div v-if="message.images && message.images.length" class="image-gallery">
          <img
            v-for="(img, i) in message.images"
            :key="i"
            :src="`data:${img.mimeType};base64,${img.data}`"
            class="msg-image"
            @click="openLightbox(img)"
          />
        </div>
        <div v-else-if="message.hadImages" class="image-placeholder">📷 图片（刷新后不可用）</div>
        <div v-for="(seg, i) in segments" :key="i">
          <pre v-if="seg.type === 'code'" class="code-block"><div v-if="seg.language" class="code-lang">{{ seg.language }}</div><code>{{ seg.content }}</code></pre>
          <p v-else class="text-block">{{ seg.content }}</p>
        </div>
        <span v-if="streaming && message.content" class="cursor-blink">▍</span>
        <span v-else-if="streaming" class="thinking">
          <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
        </span>
      </div>
      <div v-if="message.role === 'assistant' && message.elapsed" class="elapsed">⚡ {{ message.elapsed }}s</div>
      <button
        class="copy-btn"
        :class="{ copied }"
        @click="copyMessage"
        :title="copied ? '已复制' : '复制消息'"
      >
        <svg v-if="!copied" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </button>
      <Transition name="fade">
        <div v-if="lightboxImg" class="lightbox-overlay" @click.self="closeLightbox">
          <img :src="`data:${lightboxImg.mimeType};base64,${lightboxImg.data}`" class="lightbox-image" />
          <button class="lightbox-close" @click="closeLightbox">✕</button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
  streaming: { type: Boolean, default: false }
})

const lightboxImg = ref(null)
const copied = ref(false)
let copyTimer = null

async function copyMessage() {
  const text = props.message.content || ''
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 1600)
  } catch { /* ignore */ }
}

function openLightbox(img) {
  lightboxImg.value = img
}

function closeLightbox() {
  lightboxImg.value = null
}

function onKeydown(e) {
  if (e.key === 'Escape' && lightboxImg.value) {
    closeLightbox()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  clearTimeout(copyTimer)
})

const segments = computed(() => {
  const content = (props.message.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!content) return [{ type: 'text', content: '' }]

  // Lightweight single-pass split on ```, avoids O(n) backtracking regex on every streaming token
  const parts = []
  const chunks = content.split('```')
  for (let i = 0; i < chunks.length; i++) {
    if (i % 2 === 0) {
      if (chunks[i]) parts.push({ type: 'text', content: chunks[i] })
    } else {
      // Code block — first line may be language tag
      let codeContent = chunks[i]
      let language = ''
      const nlIdx = codeContent.indexOf('\n')
      if (nlIdx !== -1) {
        const firstLine = codeContent.slice(0, nlIdx).trim()
        if (/^\w+$/.test(firstLine)) {
          language = firstLine
          codeContent = codeContent.slice(nlIdx + 1)
        }
      }
      parts.push({ type: 'code', content: codeContent, language })
    }
  }
  return parts.length > 0 ? parts : [{ type: 'text', content }]
})
</script>

<style scoped>
.message {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
  margin-top: 2px;
}

.message.user .avatar {
  background: linear-gradient(135deg, #4a9eff, #2f7cef);
  color: #fff;
  box-shadow: 0 2px 10px rgba(74, 158, 255, 0.3);
}

.message.assistant .avatar {
  background: linear-gradient(135deg, #6c5ce7, #8a5cf6);
  color: #fff;
  box-shadow: 0 2px 10px rgba(108, 92, 231, 0.3);
}

.bubble {
  max-width: 80%;
  min-width: 0;
  overflow-wrap: break-word;
  position: relative;
}

.bubble-content {
  padding: 12px 16px;
  border-radius: 20px;
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
  transition: box-shadow 0.2s ease;
}

.message:hover .bubble-content {
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
}

.message.user .bubble-content {
  background: linear-gradient(135deg, #4a9eff, #3585f0);
  color: #fff;
  border-bottom-right-radius: 6px;
}

.message.assistant .bubble-content {
  background: #1b1b3a;
  color: #e0e0e0;
  border: 1px solid #26264c;
  border-bottom-left-radius: 6px;
}

.copy-btn {
  position: absolute;
  top: -10px;
  right: -6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #2c2c52;
  border-radius: 10px;
  background: #202044;
  color: #9aa0c0;
  cursor: pointer;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.15s, transform 0.15s, color 0.15s, background 0.15s;
}

.message:hover .copy-btn {
  opacity: 1;
  transform: translateY(0);
}

.copy-btn:hover {
  background: #2a2a54;
  color: #6fb4ff;
}

.copy-btn.copied {
  opacity: 1;
  color: #6ee7a0;
  border-color: #2f6a4a;
}

@media (pointer: coarse) {
  .copy-btn {
    opacity: 0.8;
    transform: translateY(0);
  }
}

.text-block {
  margin: 0;
  white-space: pre-wrap;
}

.code-block {
  background: #0d0d1f;
  border: 1px solid #2a2a4a;
  border-radius: 14px;
  padding: 12px;
  margin: 10px 0;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

.code-block code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #a0d8a0;
}

.code-lang {
  font-size: 11px;
  color: #888;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cursor-blink {
  animation: blink 0.8s step-end infinite;
  color: #4a9eff;
}

.thinking {
  color: #888;
  font-size: 18px;
  letter-spacing: 2px;
}

.dot {
  animation: dotPulse 1.4s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}

.image-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.image-placeholder {
  margin-bottom: 8px;
  padding: 8px 12px;
  color: #666;
  font-size: 13px;
  background: #0f0f1f;
  border: 1px dashed #2a2a4a;
  border-radius: 12px;
}

.msg-image {
  max-width: 240px;
  max-height: 180px;
  border-radius: 16px;
  border: 1px solid #2a2a4a;
  cursor: zoom-in;
  transition: transform 0.15s, box-shadow 0.15s;
  object-fit: cover;
}

.msg-image:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}

.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  cursor: zoom-out;
}

.lightbox-image {
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 20px;
  object-fit: contain;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

.lightbox-close {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #555;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.lightbox-close:hover {
  background: rgba(255,74,74,0.7);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.elapsed {
  display: inline-block;
  font-size: 11px;
  color: #7a7aa5;
  text-align: right;
  margin-top: 7px;
  padding: 3px 9px;
  background: #151531;
  border: 1px solid #25254a;
  border-radius: 999px;
  line-height: 1;
}

@keyframes blink {
  50% { opacity: 0; }
}
</style>
