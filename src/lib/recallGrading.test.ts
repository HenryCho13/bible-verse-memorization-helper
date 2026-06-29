import { describe, expect, it } from 'vitest'
import { gradeTypedRecall, normalizeRecallText } from './recallGrading'

describe('typed recall grading', () => {
  it('ignores capitalization, whitespace, and Unicode punctuation', () => {
    expect(normalizeRecallText('  The LORD’s   moth-eaten garment!  ')).toEqual(['the', 'lords', 'motheaten', 'garment'])

    const result = gradeTypedRecall('“The LORD’s word,” he said.', 'the lords word he said')
    expect(result.rating).toBe('got-it')
    expect(result.editDistance).toBe(0)
  })

  it('uses the strict exact match and fifteen-percent Hard cutoff', () => {
    const expected = 'one two three four five six seven eight nine ten'
    const hard = gradeTypedRecall(expected, 'one too three four five six seven eight nine tin')
    const again = gradeTypedRecall(expected, 'one too three four five sick seven eight nein tin')

    expect(hard.hardErrorAllowance).toBe(2)
    expect(hard.editDistance).toBe(2)
    expect(hard.rating).toBe('hard')
    expect(again.editDistance).toBe(4)
    expect(again.rating).toBe('again')
  })

  it('aligns missing, substituted, and extra words and locates the first trouble word', () => {
    const result = gradeTypedRecall('alpha beta gamma delta', 'alpha better delta extra')

    expect(result.alignment.map((token) => token.kind)).toEqual(['match', 'substitution', 'missing', 'match', 'extra'])
    expect(result.troubleExpectedWordIndex).toBe(1)
  })

  it('grades a blank answer as Again', () => {
    const result = gradeTypedRecall('one two three', '')
    expect(result.rating).toBe('again')
    expect(result.editDistance).toBe(3)
    expect(result.troubleExpectedWordIndex).toBe(0)
  })
})
