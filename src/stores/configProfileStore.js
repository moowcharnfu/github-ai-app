import { reactive, computed } from 'vue'
import { getItem, setItem } from '../utils/storage.js'

const DEFAULT_API_URL = 'https://models.github.ai/inference/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4o'

let nextId = 1

function generateId() {
  return Date.now().toString(36) + '-' + (nextId++).toString(36)
}

function loadProfiles() {
  const stored = getItem('config-profiles')
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored
  }

  // Migrate from old config
  const oldConfig = getItem('app-config')
  if (oldConfig && (oldConfig.apiKey || oldConfig.apiUrl)) {
    const defaultProfile = {
      id: generateId(),
      name: '默认配置',
      apiUrl: oldConfig.apiUrl || DEFAULT_API_URL,
      apiKey: oldConfig.apiKey || '',
      model: oldConfig.model || DEFAULT_MODEL,
    }
    const result = [defaultProfile]
    setItem('config-profiles', result)
    setItem('active-profile-id', defaultProfile.id)
    return result
  }

  // First launch: create default
  const defaultProfile = {
    id: generateId(),
    name: '默认配置',
    apiUrl: DEFAULT_API_URL,
    apiKey: '',
    model: DEFAULT_MODEL,
  }
  const result = [defaultProfile]
  setItem('config-profiles', result)
  setItem('active-profile-id', defaultProfile.id)
  return result
}

const profiles = reactive(loadProfiles())

let activeId = getItem('active-profile-id')
if (!activeId || !profiles.find(p => p.id === activeId)) {
  activeId = profiles.length > 0 ? profiles[0].id : null
  if (activeId) setItem('active-profile-id', activeId)
}

function persist() {
  setItem('config-profiles', profiles.slice())
}

export function useProfileStore() {
  const activeProfile = computed(() => {
    return profiles.find(p => p.id === activeId) || null
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
    if (activeId === id) {
      activeId = profiles[0].id
      setItem('active-profile-id', activeId)
    }
    persist()
  }

  function switchProfile(id) {
    if (profiles.find(p => p.id === id)) {
      activeId = id
      setItem('active-profile-id', id)
    }
  }

  return {
    profiles,
    activeProfileId: () => activeId,
    activeProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    switchProfile
  }
}
