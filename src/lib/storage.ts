import type { AppStore } from '../types'

export const STORE_KEY = 'verse-memory-v2'

export function emptyStore(): AppStore {
  return { version: 2, chunkPreferences: {}, sessions: {} }
}

export function loadStore(): AppStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<AppStore> | null
    if (!parsed || parsed.version !== 2) return emptyStore()
    return {
      version: 2,
      plan: parsed.plan,
      chunkPreferences: parsed.chunkPreferences && typeof parsed.chunkPreferences === 'object' ? parsed.chunkPreferences : {},
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
    }
  } catch {
    return emptyStore()
  }
}

export function saveStore(store: AppStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}
