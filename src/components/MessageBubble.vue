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
        <div v-for="(seg, i) in segments" :key="i">
          <pre v-if="seg.type === 'code'" class="code-block"><code>{{ seg.content }}</code></pre>
          <p v-else class="text-block">{{ seg.content }}</p>
        </div>
        <span v-if="streaming && message.content" class="cursor-blink">▍</span>
        <span v-else-if="streaming" class="thinking">
          <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
        </span>
      </div>
      <div v-if="message.role === 'assistant' && message.elapsed" class="elapsed">⚡ {{ message.elapsed }}s</div>
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
import { ref, computed } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
  streaming: { type: Boolean, default: false }
})

const lightboxImg = ref(null)

function openLightbox(img) {
  lightboxImg.value = img
}

function closeLightbox() {
  lightboxImg.value = null
}

const segments = computed(() => {
  const content = props.message.content || ''
  const parts = []
  let lastEnd = 0
  const codeRegex = /```(\w*)\n?([\s\S]*?)```/g
  let match

  while ((match = codeRegex.exec(content)) !== null) {
    if (match.index > lastEnd) {
      parts.push({ type: 'text', content: content.slice(lastEnd, match.index) })
    }
    parts.push({ type: 'code', content: match[2] })
    lastEnd = match.index + match[0].length
  }

  if (lastEnd < content.length) {
    parts.push({ type: 'text', content: content.slice(lastEnd) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }]
})
</script>

<style scoped>
.message {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.message.user .avatar {
  background: #4a9eff;
  color: #fff;
}

.message.assistant .avatar {
  background: #6c5ce7;
  color: #fff;
}

.bubble {
  max-width: 80%;
}

.bubble-content {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
}

.message.user .bubble-content {
  background: #4a9eff;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message.assistant .bubble-content {
  background: #1a1a3e;
  color: #e0e0e0;
  border-bottom-left-radius: 4px;
}

.text-block {
  margin: 0;
  white-space: pre-wrap;
}

.code-block {
  background: #0d0d1f;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

.code-block code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #a0d8a0;
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

.msg-image {
  max-width: 240px;
  max-height: 180px;
  border-radius: 8px;
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
  border-radius: 8px;
  object-fit: contain;
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
  font-size: 11px;
  color: #555;
  text-align: right;
  padding: 4px 2px 0;
  line-height: 1;
}

@keyframes blink {
  50% { opacity: 0; }
}
</style>
