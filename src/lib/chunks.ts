const STRONG_END = /[.!?;:]([”’"']*)$/
const SOFT_END = /[,—–]([”’"']*)$/
const CONJUNCTIONS = new Set(['and', 'but', 'for', 'that', 'who', 'which', 'when', 'because', 'therefore', 'then'])

export function wordsOf(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

export function autoChunkBoundaries(text: string): number[] {
  const words = wordsOf(text)
  if (words.length <= 5) return []
  const boundaries: number[] = []
  let start = 0

  while (words.length - start > 10) {
    const minimum = start + 4
    const maximum = Math.min(start + 10, words.length - 3)
    let end = -1

    for (let i = minimum - 1; i < maximum; i += 1) {
      if (STRONG_END.test(words[i])) { end = i + 1; break }
    }
    if (end < 0) {
      for (let i = maximum - 1; i >= minimum - 1; i -= 1) {
        if (SOFT_END.test(words[i])) { end = i + 1; break }
      }
    }
    if (end < 0) {
      for (let i = maximum - 1; i >= minimum; i -= 1) {
        if (CONJUNCTIONS.has(words[i].replace(/[^a-z]/gi, '').toLowerCase())) { end = i; break }
      }
    }
    if (end < 0) end = Math.min(start + 8, maximum)
    boundaries.push(end)
    start = end
  }

  return boundaries.filter((boundary, index, all) => boundary >= 3 && words.length - boundary >= 3 && boundary !== all[index - 1])
}

export function normalizeBoundaries(text: string, boundaries: number[]): number[] {
  const wordCount = wordsOf(text).length
  return [...new Set(boundaries)]
    .filter((value) => Number.isInteger(value) && value > 0 && value < wordCount)
    .sort((a, b) => a - b)
}

export function chunksFromBoundaries(text: string, boundaries: number[]): string[] {
  const words = wordsOf(text)
  const ends = [...normalizeBoundaries(text, boundaries), words.length]
  let start = 0
  return ends.map((end) => {
    const chunk = words.slice(start, end).join(' ')
    start = end
    return chunk
  })
}

export function toggleBoundary(boundaries: number[], index: number): number[] {
  return boundaries.includes(index)
    ? boundaries.filter((value) => value !== index)
    : [...boundaries, index].sort((a, b) => a - b)
}
