import type { Rating } from '../types'

export type RecallDiffKind = 'match' | 'substitution' | 'missing' | 'extra'

export interface RecallDiffToken {
  kind: RecallDiffKind
  expected?: string
  actual?: string
  expectedIndex?: number
}

export interface TypedRecallGrade {
  rating: Rating
  editDistance: number
  hardErrorAllowance: number
  alignment: RecallDiffToken[]
  troubleExpectedWordIndex?: number
}

interface RecallWord {
  display: string
  normalized: string
}

const PUNCTUATION = /\p{P}/gu

function recallWords(text: string): RecallWord[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((display) => ({
      display,
      normalized: display.normalize('NFKC').toLowerCase().replace(PUNCTUATION, ''),
    }))
    .filter((word) => word.normalized.length > 0)
}

export function normalizeRecallText(text: string): string[] {
  return recallWords(text).map((word) => word.normalized)
}

function alignWords(expected: RecallWord[], actual: RecallWord[]): { distance: number; alignment: RecallDiffToken[] } {
  const rows = expected.length + 1
  const columns = actual.length + 1
  const distance = Array.from({ length: rows }, () => Array<number>(columns).fill(0))

  for (let row = 0; row < rows; row += 1) distance[row][0] = row
  for (let column = 0; column < columns; column += 1) distance[0][column] = column

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = expected[row - 1].normalized === actual[column - 1].normalized ? 0 : 1
      distance[row][column] = Math.min(
        distance[row - 1][column - 1] + substitutionCost,
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
      )
    }
  }

  const reversed: RecallDiffToken[] = []
  let row = expected.length
  let column = actual.length

  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && expected[row - 1].normalized === actual[column - 1].normalized && distance[row][column] === distance[row - 1][column - 1]) {
      reversed.push({
          kind: 'match',
          expected: expected[row - 1].display,
          actual: actual[column - 1].display,
          expectedIndex: row - 1,
      })
      row -= 1
      column -= 1
      continue
    }

    if (row > 0 && distance[row][column] === distance[row - 1][column] + 1) {
      reversed.push({ kind: 'missing', expected: expected[row - 1].display, expectedIndex: row - 1 })
      row -= 1
      continue
    }

    if (column > 0 && distance[row][column] === distance[row][column - 1] + 1) {
      reversed.push({ kind: 'extra', actual: actual[column - 1].display })
      column -= 1
      continue
    }

    reversed.push({
      kind: 'substitution',
      expected: expected[row - 1].display,
      actual: actual[column - 1].display,
      expectedIndex: row - 1,
    })
    row -= 1
    column -= 1
  }

  return { distance: distance[expected.length][actual.length], alignment: reversed.reverse() }
}

function troubleIndex(alignment: RecallDiffToken[], expectedLength: number): number | undefined {
  const mismatch = alignment.findIndex((token) => token.kind !== 'match')
  if (mismatch < 0 || expectedLength === 0) return undefined
  if (alignment[mismatch].expectedIndex !== undefined) return alignment[mismatch].expectedIndex

  const nextExpected = alignment.slice(mismatch + 1).find((token) => token.expectedIndex !== undefined)?.expectedIndex
  if (nextExpected !== undefined) return nextExpected

  const previousExpected = [...alignment.slice(0, mismatch)].reverse().find((token) => token.expectedIndex !== undefined)?.expectedIndex
  return previousExpected ?? 0
}

export function gradeTypedRecall(expectedText: string, actualText: string): TypedRecallGrade {
  const expected = recallWords(expectedText)
  const actual = recallWords(actualText)
  const { distance, alignment } = alignWords(expected, actual)
  const hardErrorAllowance = expected.length === 0 ? 0 : Math.max(1, Math.round(expected.length * 0.15))
  const rating: Rating = distance === 0 ? 'got-it' : distance <= hardErrorAllowance ? 'hard' : 'again'

  return {
    rating,
    editDistance: distance,
    hardErrorAllowance,
    alignment,
    troubleExpectedWordIndex: troubleIndex(alignment, expected.length),
  }
}
