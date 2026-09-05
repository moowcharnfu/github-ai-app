export function generateId(prefix = '') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + (prefix ? '-' + prefix : '') + '-' + Math.random().toString(36).slice(2, 10)
}
