import rawVerses from '../../english_bible_verses_from_har.txt?raw'
import { describe, expect, it } from 'vitest'
import { parseVerses } from './parseVerses'

describe('parseVerses', () => {
  it('parses the complete supplied catalog', () => {
    const verses = parseVerses(rawVerses)
    expect(verses).toHaveLength(244)
    expect(new Set(verses.map((verse) => verse.topic))).toHaveLength(20)
    expect(verses[0]).toMatchObject({ id: 1, topic: 'Bible', reference: 'Deuteronomy 17:19' })
    expect(verses[214]).toMatchObject({ id: 215, reference: 'I Thessalonians 5:14-15' })
    expect(verses[243]).toMatchObject({ id: 244, reference: 'Revelation 16:15' })
  })

  it('rejects malformed or discontinuous entries', () => {
    expect(() => parseVerses('## Topic\n1. Ref without delimiter')).toThrow('Could not parse')
    expect(() => parseVerses('## Topic\n2. Ref — Text')).toThrow('Expected verse 1')
  })
})
