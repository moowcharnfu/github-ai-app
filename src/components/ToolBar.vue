<template>
  <div class="tool-bar">
    <div class="tool-left">
      <div class="custom-select" ref="dropdownRef">
        <button class="select-trigger" @click="toggleDropdown">
          <span class="select-label">{{ currentProfileName }}</span>
          <svg class="select-arrow" :class="{ open: isOpen }" width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div v-if="isOpen" class="select-dropdown">
          <div
            v-for="profile in store.profiles"
            :key="profile.id"
            class="select-option"
            :class="{ active: profile.id === currentProfileId }"
            @click="selectProfile(profile.id)"
          >
            <span class="option-name">{{ profile.name }}</span>
            <svg v-if="profile.id === currentProfileId" class="option-check" width="14" height="14" viewBox="0 0 14 14">
              <path d="M3 7l3 3 5-5" stroke="#4a9eff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
    <div class="tool-center">
      <span class="model-name">{{ currentModel }}</span>
    </div>
    <div class="tool-right">
      <button class="config-btn" @click="$emit('openConfig')" title="配置管理">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.5 2.5l1.5 1.5M12 12l1.5 1.5M2.5 13.5l1.5-1.5M12 4l1.5-1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useProfileStore } from '../stores/configProfileStore.js'

defineEmits(['openConfig'])

const store = useProfileStore()

const dropdownRef = ref(null)
const isOpen = ref(false)

const currentProfileName = computed(() => {
  return store.activeProfile.value?.name || ''
})

const currentProfileId = computed(() => {
  return store.activeProfileId()
})

const currentModel = computed(() => {
  return store.activeProfile.value?.model || '没有选中模型'
})

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function selectProfile(id) {
  store.switchProfile(id)
  isOpen.value = false
}

function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.tool-bar {
  display: flex;
  align-items: center;
  height: 42px;
  background: #1a1a2e;
  border-bottom: 1px solid #2a2a4a;
  padding: 0 14px;
  gap: 12px;
  flex-shrink: 0;
}

.tool-left {
  display: flex;
  align-items: center;
}

.custom-select {
  position: relative;
}

.select-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #0f0f23;
  color: #e0e0e0;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  min-width: 120px;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
}

.select-trigger:hover {
  border-color: #3a3a5a;
}

.select-trigger:focus-visible {
  border-color: #4a9eff;
  box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.15);
  outline: none;
}

.select-label {
  flex: 1;
  text-align: left;
}

.select-arrow {
  flex-shrink: 0;
  color: #888;
  transition: transform 0.2s;
}

.select-arrow.open {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 160px;
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  padding: 4px;
  z-index: 100;
  animation: dropdownIn 0.12s ease;
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.select-option {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
  gap: 8px;
}

.select-option:hover {
  background: #0f0f23;
}

.select-option.active {
  background: #1a2a4e;
}

.option-name {
  flex: 1;
  color: #ccc;
  font-size: 12px;
}

.option-check {
  flex-shrink: 0;
}

.tool-center {
  flex: 1;
  text-align: center;
}

.model-name {
  color: #777;
  font-size: 12px;
  font-family: monospace;
  background: #0f0f23;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid #2a2a4a;
  margin-right: 6px;
}

.tool-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.config-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s, transform 0.12s;
}

.config-btn:hover {
  color: #4a9eff;
  background: #0f0f23;
  transform: rotate(30deg);
}

.config-btn:active {
  transform: rotate(45deg);
}
</style>
