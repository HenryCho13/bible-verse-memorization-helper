import { beforeEach, describe, expect, it } from 'vitest'
import { emptyStore, loadStore, saveStore, STORE_KEY } from './storage'

describe('local storage', () => {
  beforeEach(() => localStorage.clear())

  it('round trips the versioned store', () => {
    const store = { ...emptyStore(), plan: { anchorWeekKey: '2026-06-21', anchorVerseId: 10 } }
    saveStore(store)
    expect(loadStore()).toEqual(store)
  })

  it('recovers from corrupt and obsolete data', () => {
    localStorage.setItem(STORE_KEY, '{bad')
    expect(loadStore()).toEqual(emptyStore())
    localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1 }))
    expect(loadStore()).toEqual(emptyStore())
  })
})
