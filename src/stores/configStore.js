import { reactive } from 'vue'
import { useProfileStore } from './configProfileStore.js'

const store = useProfileStore()

export function useConfig() {
  return reactive({
    get apiUrl() { return store.activeProfile.value?.apiUrl || '' },
    get apiKey() { return store.activeProfile.value?.apiKey || '' },
    get model() { return store.activeProfile.value?.model || '' }
  })
}