<template>
  <div class="tab-bar">
    <div class="tabs">
      <div
        v-for="session in store.sessions"
        :key="session.id"
        class="tab"
        :class="{ active: session.id === currentId }"
        @click="store.switchSession(session.id)"
      >
        <span class="tab-title">{{ session.title }}</span>
        <button
          class="tab-close"
          :class="{ disabled: store.sessions.length <= 1, confirm: pendingId === session.id }"
          :disabled="store.sessions.length <= 1"
          @click.stop="handleClose(session.id)"
          :title="pendingId === session.id ? '再点一次确认关闭' : '关闭会话'"
        >
          &#10005;
        </button>
      </div>
    </div>
    <button class="tab-add" @click="store.createSession()" title="新建会话" aria-label="新建会话">+</button>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { useSessionStore } from '../stores/sessionStore.js'

const store = useSessionStore()
const currentId = store.activeId
const pendingId = ref(null)
let pendingTimer = null

function handleClose(id) {
  if (store.sessions.length <= 1) return
  if (pendingId.value === id) {
    clearTimeout(pendingTimer)
    pendingTimer = null
    pendingId.value = null
    store.deleteSession(id)
    return
  }
  pendingId.value = id
  clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => { pendingId.value = null }, 3000)
}

onUnmounted(() => {
  clearTimeout(pendingTimer)
})
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  height: 38px;
  background: #0f0f23;
  border-bottom: 1px solid #2a2a4a;
  flex-shrink: 0;
  overflow: hidden;
}

.tabs {
  display: flex;
  align-items: stretch;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 0;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  min-width: 0;
  max-width: 200px;
  height: 100%;
  background: #0f0f23;
  border-right: 1px solid #2a2a4a;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  flex-shrink: 0;
}

.tab:hover {
  background: #1a1a3e;
}

.tab.active {
  background: #1a1a2e;
  border-bottom: 2px solid #4a9eff;
  border-radius: 12px 12px 0 0;
}

.tab-title {
  color: #999;
  font-size: 13px;
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  letter-spacing: 0.2px;
}

.tab.active .tab-title {
  color: #e0e0e0;
  font-weight: 500;
}

.tab-close {
  background: none;
  border: none;
  color: #555;
  font-size: 11px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 8px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background 0.15s, transform 0.1s;
  line-height: 1;
}

.tab:hover .tab-close:not(.disabled) {
  opacity: 0.8;
}

.tab-close:not(.disabled):hover {
  opacity: 1;
  color: #ff4a4a;
  background: #2a1a1a;
  transform: scale(1.1);
}

.tab-close.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tab-close.confirm {
  opacity: 1;
  color: #ff4a4a;
  background: #2a1a1a;
  animation: pulse-red 1s infinite;
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 74, 74, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(255, 74, 74, 0); }
}

@media (pointer: coarse) {
  .tab-close {
    opacity: 0.6;
    padding: 6px 10px;
  }
}

.tab-add {
  width: 34px;
  height: 30px;
  margin: 0 10px 0 6px;
  align-self: center;
  background: #171732;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  color: #888;
  font-size: 20px;
  font-weight: 300;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, color 0.2s ease, transform 0.12s ease;
}

.tab-add:active {
  transform: scale(0.92);
}

.tab-add:hover {
  background: #1f1f46;
  border-color: #3a5a8a;
  color: #4a9eff;
}

.tab-add:active {
  background: #252556;
}
</style>
