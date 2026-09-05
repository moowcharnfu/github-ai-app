import { reactive, computed, ref } from 'vue'
import { getItem, setItem, removeItem } from '../utils/storage.js'
import { generateId } from '../utils/id.js'

const DEFAULT_API_URL = 'https://models.github.ai/inference/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4o'

function createDefaultProfile(name, apiUrl, apiKey, model) {
  return {
    id: generateId(),
    name: name || '默认配置',
    apiUrl: apiUrl || DEFAULT_API_URL,
    apiKey: apiKey || '',
    model: model || DEFAULT_MODEL,
  }
}

function loadProfiles() {
  const stored = getItem('config-profiles')
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored
  }

  // Migrate from old config
  const oldConfig = getItem('app-config')
  if (oldConfig && (oldConfig.apiKey || oldConfig.apiUrl)) {
    const result = [createDefaultProfile('默认配置', oldConfig.apiUrl, oldConfig.apiKey, oldConfig.model)]
    setItem('config-profiles', result)
    setItem('active-profile-id', result[0].id)
    removeItem('app-config')
    return result
  }

  // First launch: create default
  const result = [createDefaultProfile()]
  setItem('config-profiles', result)
  setItem('active-profile-id', result[0].id)
  return result
}

const profiles = reactive(loadProfiles())

const activeId = ref(getItem('active-profile-id'))
if (!activeId.value || !profiles.find(p => p.id === activeId.value)) {
  activeId.value = profiles.length > 0 ? profiles[0].id : null
  if (activeId.value) setItem('active-profile-id', activeId.value)
}

function persist() {
  setItem('config-profiles', profiles.slice())
}

export function useProfileStore() {
  const activeProfile = computed(() => {
    return profiles.find(p => p.id === activeId.value) || null
  })

  function createProfile(name, apiUrl, apiKey, model) {
    const profile = {
      id: generateId(),
      name: name || '新配置',
      apiUrl: apiUrl || DEFAULT_API_URL,
      apiKey: apiKey || '',
      model: model || DEFAULT_MODEL,
    }
    profiles.push(profile)
    persist()
    return profile
  }

  function updateProfile(id, data) {
    const profile = profiles.find(p => p.id === id)
    if (!profile) return
    Object.assign(profile, data)
    persist()
  }

  function deleteProfile(id) {
    if (profiles.length <= 1) return
    const idx = profiles.findIndex(p => p.id === id)
    if (idx === -1) return
    profiles.splice(idx, 1)
    if (activeId.value === id) {
      activeId.value = profiles[0].id
      setItem('active-profile-id', activeId.value)
    }
    persist()
  }

  function switchProfile(id) {
    if (profiles.find(p => p.id === id)) {
      activeId.value = id
      setItem('active-profile-id', id)
    }
  }

  return {
    profiles,
    activeProfileId: () => activeId.value,
    activeProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    switchProfile
  }
}
