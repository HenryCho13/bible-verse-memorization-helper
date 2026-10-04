import { describe, expect, it } from 'vitest'
import { mergePersonalVerses, parseImportedVerses } from './importVerses'

describe('personal verse imports', () => {
  it('imports text lists with optional catalog headings and numbering', () => {
    expect(parseImportedVerses('## Hope\n1. John 3:16 — For God so loved the world.\n\nPsalm 23:1 — The LORD is my shepherd.')).toEqual([
      { reference: 'John 3:16', text: 'For God so loved the world.', topic: 'Hope' },
      { reference: 'Psalm 23:1', text: 'The LORD is my shepherd.', topic: 'Hope' },
    ])
  })

  it('validates JSON without trusting imported IDs', () => {
    expect(parseImportedVerses('[{"id":1,"reference":" Psalm 23:1 ","text":" The LORD is my shepherd. "}]')).toEqual([
      { reference: 'Psalm 23:1', text: 'The LORD is my shepherd.', topic: 'Personal memorization' },
    ])
  })

  it.each(['', '[invalid', '{}', '[]', '[null]', '[{"reference":"John 3:16","text":" "}]', 'John 3:16'])('rejects invalid input: %s', (input) => {
    expect(() => parseImportedVerses(input)).toThrow()
  })

  it('deduplicates within and across imports while keeping different translations', () => {
    const entries = parseImportedVerses('Psalm 23:1 — The LORD is my shepherd.\nPsalm 23:1 — The LORD is my shepherd.')
    const first = mergePersonalVerses([], entries)
    expect(first).toHaveLength(1)
    const second = mergePersonalVerses(first, [...entries, { ...entries[0], text: 'A different translation.' }])
    expect(second.map((verse) => verse.id)).toEqual([-1, -2])
    expect(first).toHaveLength(1)
  })
})
