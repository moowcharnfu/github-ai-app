<template>
  <div class="title-bar" data-tauri-drag-region>
    <div class="title-bar-left">
      <span class="app-icon">&#9670;</span>
      <span class="app-name">GitHub AI Chat</span>
    </div>
    <div class="title-bar-right">
      <button class="window-btn" title="最小化" @click="minimize">&#9472;</button>
      <button class="window-btn" title="最大化" @click="toggleMaximize">&#9634;</button>
      <button class="window-btn window-close" title="关闭" @click="closeWindow">&#10005;</button>
    </div>
  </div>
</template>

<script setup>
import { getCurrentWindow } from '@tauri-apps/api/window'

async function minimize() {
  try { await getCurrentWindow().minimize() } catch {}
}

async function toggleMaximize() {
  try { await getCurrentWindow().toggleMaximize() } catch {}
}

async function closeWindow() {
  try { await getCurrentWindow().close() } catch {}
}
</script>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  background: #0a0a1a;
  border-bottom: 1px solid #2a2a4a;
  user-select: none;
  flex-shrink: 0;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 16px;
}

.app-icon {
  color: #4a9eff;
  font-size: 15px;
}

.app-name {
  color: #bbb;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.title-bar-right {
  display: flex;
  align-items: center;
  height: 100%;
}

.window-btn {
  width: 48px;
  height: 100%;
  background: none;
  border: none;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
  border-radius: 0;
}

.window-btn:hover {
  background: #1a1a3e;
  color: #ddd;
}

.window-close:hover {
  background: #e81123;
  color: #fff;
}
</style>
