import { describe, expect, it } from 'vitest'
import { autoChunkBoundaries, chunksFromBoundaries, normalizeBoundaries, toggleBoundary, wordsOf } from './chunks'

describe('chunk helpers', () => {
  const text = 'Now we exhort you, brethren, warn those who are unruly, comfort the fainthearted, uphold the weak.'

  it('creates natural, lossless chunks', () => {
    const boundaries = autoChunkBoundaries(text)
    const chunks = chunksFromBoundaries(text, boundaries)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.join(' ')).toBe(text)
    expect(chunks.every((chunk) => wordsOf(chunk).length >= 3)).toBe(true)
  })

  it('normalizes and toggles editable boundaries', () => {
    expect(normalizeBoundaries('one two three four', [3, 0, 3, 9, 1])).toEqual([1, 3])
    expect(toggleBoundary([2], 3)).toEqual([2, 3])
    expect(toggleBoundary([2, 3], 2)).toEqual([3])
  })
})
