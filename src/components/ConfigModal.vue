<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <button class="modal-close" @click="emit('close')" title="关闭">✕</button>
      <div class="modal-left">
        <div class="profile-list-header">配置列表</div>
        <div class="profile-list">
          <div
            v-for="profile in store.profiles"
            :key="profile.id"
            class="profile-item"
            :class="{ active: selectedId === profile.id }"
            @click="selectProfile(profile.id)"
          >
            <span class="profile-name">{{ profile.name }}</span>
            <span v-if="profile.id === currentId" class="current-badge">当前</span>
          </div>
        </div>
      </div>
      <div class="modal-right">
        <div class="form-fields">
          <div class="form-field">
            <label>名称</label>
            <div class="input-inner">
              <input v-model="form.name" type="text" placeholder="配置名称" />
              <button class="input-btn" :class="{ copied: copiedField === 'name' }" @click="copyField('name')" :title="copiedField === 'name' ? '已复制' : '复制'">
                <svg v-if="copiedField !== 'name'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span v-else class="copied-text">已复制</span>
              </button>
            </div>
          </div>
          <div class="form-field">
            <label>API 地址</label>
            <div class="input-inner">
              <input v-model="form.apiUrl" type="text" placeholder="https://models.github.ai/inference/chat/completions" />
              <button class="input-btn" :class="{ copied: copiedField === 'apiUrl' }" @click="copyField('apiUrl')" :title="copiedField === 'apiUrl' ? '已复制' : '复制'">
                <svg v-if="copiedField !== 'apiUrl'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span v-else class="copied-text">已复制</span>
              </button>
            </div>
          </div>
          <div class="form-field">
            <label>密钥（本地持久化保存）</label>
            <span class="security-hint">⚠ 以明文存储于本机，请勿在共享设备使用</span>
            <div class="input-inner">
              <input v-model="form.apiKey" :type="showKey ? 'text' : 'password'" placeholder="Bearer Token" />
              <button class="input-btn" @click="showKey = !showKey" :title="showKey ? '隐藏' : '显示'">
                <svg v-if="showKey" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="input-btn" :class="{ copied: copiedField === 'apiKey' }" @click="copyField('apiKey')" :title="copiedField === 'apiKey' ? '已复制' : '复制'">
                <svg v-if="copiedField !== 'apiKey'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span v-else class="copied-text">已复制</span>
              </button>
            </div>
          </div>
          <div class="form-field">
            <label>模型</label>
            <div class="input-inner">
              <input v-model="form.model" type="text" placeholder="openai/gpt-4o" />
              <button class="input-btn" :class="{ copied: copiedField === 'model' }" @click="copyField('model')" :title="copiedField === 'model' ? '已复制' : '复制'">
                <svg v-if="copiedField !== 'model'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span v-else class="copied-text">已复制</span>
              </button>
            </div>
          </div>
        </div>
        <div v-if="formError" class="form-error">{{ formError }}</div>
        <div class="form-actions">
          <button class="btn btn-save" :class="{ saved: savedFlag }" @click="handleSave">
            {{ savedFlag ? '已保存 ✓' : '保存' }}
          </button>
          <button class="btn btn-new" @click="handleNew">新建</button>
          <button class="btn btn-delete" :class="{ 'btn-delete-confirm': pendingDelete }" @click="handleDelete">{{ pendingDelete ? '确认删除?' : '删除' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useProfileStore } from '../stores/configProfileStore.js'

const pendingDelete = ref(false)
let deleteTimer = null
let copyTimer = null
let saveTimer = null

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['close'])

const store = useProfileStore()
const currentId = computed(() => store.activeProfileId())
const selectedId = ref(store.activeProfileId())
const form = ref({ name: '', apiUrl: '', apiKey: '', model: '' })
const showKey = ref(false)
const copiedField = ref(null)
const formError = ref('')
const savedFlag = ref(false)

function onKeydown(e) {
  if (e.key === 'Escape' && props.visible) emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

watch(() => props.visible, (val) => {
  if (val) {
    selectedId.value = store.activeProfileId()
    loadForm(selectedId.value)
    showKey.value = false
    copiedField.value = null
    pendingDelete.value = false
    savedFlag.value = false
    formError.value = ''
  }
})

function loadForm(id) {
  const profile = store.profiles.find(p => p.id === id)
  if (profile) {
    form.value = { name: profile.name, apiUrl: profile.apiUrl, apiKey: profile.apiKey, model: profile.model }
  }
}

function selectProfile(id) {
  selectedId.value = id
  loadForm(id)
  showKey.value = false
  copiedField.value = null
  pendingDelete.value = false
  savedFlag.value = false
  formError.value = ''
}

function handleSave() {
  const name = form.value.name.trim()
  const apiUrl = form.value.apiUrl.trim()
  const model = form.value.model.trim()
  if (!name) { formError.value = '请填写配置名称'; return }
  if (!apiUrl || !/^https?:\/\//i.test(apiUrl)) { formError.value = '请填写有效的 API 地址'; return }
  if (!model) { formError.value = '请填写模型'; return }
  formError.value = ''
  store.updateProfile(selectedId.value, { name, apiUrl, apiKey: form.value.apiKey, model })
  pendingDelete.value = false
  savedFlag.value = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { savedFlag.value = false }, 1500)
}

function handleNew() {
  const p = store.createProfile('新配置')
  store.switchProfile(p.id)
  selectedId.value = p.id
  loadForm(p.id)
  showKey.value = false
  copiedField.value = null
  pendingDelete.value = false
  savedFlag.value = false
  formError.value = ''
}

function handleDelete() {
  if (store.profiles.length <= 1) return
  if (!pendingDelete.value) {
    pendingDelete.value = true
    clearTimeout(deleteTimer)
    deleteTimer = setTimeout(() => { pendingDelete.value = false }, 3000)
    return
  }
  clearTimeout(deleteTimer)
  deleteTimer = null
  pendingDelete.value = false
  store.deleteProfile(selectedId.value)
  selectedId.value = store.activeProfileId()
  loadForm(selectedId.value)
  showKey.value = false
  copiedField.value = null
  formError.value = ''
  savedFlag.value = false
}

async function copyField(field) {
  const value = form.value[field]
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    copiedField.value = field
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      if (copiedField.value === field) {
        copiedField.value = null
      }
    }, 500)
  } catch {
    // silent fail if clipboard API unavailable
  }
}

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  clearTimeout(deleteTimer)
  clearTimeout(copyTimer)
  clearTimeout(saveTimer)
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-container {
  display: flex;
  width: min(640px, calc(100vw - 24px));
  min-width: min(320px, calc(100vw - 24px));
  max-height: 90vh;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 18px;
  overflow: hidden;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: #888;
  font-size: 14px;
  cursor: pointer;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.15s, color 0.15s;
}

.modal-close:hover {
  background: rgba(255, 74, 74, 0.15);
  color: #ff4a4a;
}

.modal-left {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid #2a2a4a;
  display: flex;
  flex-direction: column;
}

@media (max-width: 560px) {
  .modal-left {
    display: none;
  }
}

.profile-list-header {
  padding: 14px 12px 8px;
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.profile-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.profile-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 2px;
}

.profile-item:hover {
  background: #0f0f23;
}

.profile-item.active {
  background: #1a2a4e;
}

.profile-name {
  color: #ccc;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.current-badge {
  font-size: 10px;
  color: #4a9eff;
  background: #0f2340;
  padding: 1px 6px;
  border-radius: 6px;
  margin-left: 6px;
  flex-shrink: 0;
}

.modal-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.form-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.form-error {
  color: #ff9d9d;
  font-size: 12px;
  padding: 6px 0 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.form-field label {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.security-hint {
  display: block;
  font-size: 10px;
  color: #b8853a;
  margin-top: 2px;
  text-transform: none;
  letter-spacing: 0;
}

.input-inner {
  display: flex;
  align-items: center;
  background: #0f0f23;
  border: 1px solid #2a2a4a;
  border-radius: 10px;
  transition: border-color 0.2s;
}

.input-inner:focus-within {
  border-color: #4a9eff;
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.12);
}

.input-inner input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: #e0e0e0;
  font-size: 13px;
  padding: 8px 10px;
  min-width: 0;
}

.input-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px 6px;
  margin: 2px;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.input-btn:hover {
  color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
}

.input-btn.copied {
  color: #4caf50;
}

.copied-text {
  font-size: 11px;
  white-space: nowrap;
  padding: 0 2px;
}

.form-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #2a2a4a;
}

.btn {
  padding: 8px 18px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: background 0.15s, transform 0.12s, box-shadow 0.2s;
  letter-spacing: 0.2px;
}

.btn:active {
  transform: scale(0.96);
}

.btn-save {
  background: linear-gradient(135deg, #4a9eff, #3a7eef);
  color: #fff;
  box-shadow: 0 2px 6px rgba(74, 158, 255, 0.2);
}

.btn-save:hover {
  background: linear-gradient(135deg, #5aaeff, #4a8eff);
  box-shadow: 0 3px 10px rgba(74, 158, 255, 0.35);
}

.btn-save.saved {
  background: linear-gradient(135deg, #4cc38a, #3aa874);
  box-shadow: 0 3px 10px rgba(76, 195, 138, 0.35);
}

.btn-new {
  background: #2a2a4a;
  color: #aaa;
}

.btn-new:hover {
  background: #3a3a5a;
  color: #ccc;
}

.btn-delete {
  margin-left: auto;
  background: transparent;
  color: #ff4a4a;
  border: 1px solid rgba(255, 74, 74, 0.4);
  transition: background 0.15s, border-color 0.15s, transform 0.12s;
}

.btn-delete:hover {
  background: rgba(255, 74, 74, 0.1);
  border-color: #ff4a4a;
}

.btn-delete-confirm {
  background: #ff4a4a;
  color: #fff;
  border-color: #ff4a4a;
  animation: pulse-red 1s infinite;
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 74, 74, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255, 74, 74, 0); }
}
</style>
