import { reactive } from 'vue'
import { useProfileStore } from './configProfileStore.js'

const store = useProfileStore()

let _configInstance = null

export function useConfig() {
  if (_configInstance) return _configInstance
  _configInstance = reactive({
    get apiUrl() { return store.activeProfile.value?.apiUrl || '' },
    get apiKey() { return store.activeProfile.value?.apiKey || '' },
    get model() { return store.activeProfile.value?.model || '' }
  })
  return _configInstance
}
