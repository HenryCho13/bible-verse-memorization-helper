import type { Verse } from '../types'

export function parseVerses(raw: string): Verse[] {
  const verses: Verse[] = []
  let topic = ''

  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.trim()
    if (!line) continue

    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      topic = heading[1].trim()
      continue
    }

    const entry = line.match(/^(\d+)\.\s+(.+?)\s+—\s+(.+)$/)
    if (!entry) throw new Error(`Could not parse verse line: ${line.slice(0, 80)}`)
    if (!topic) throw new Error(`Verse ${entry[1]} appears before a topic heading.`)

    verses.push({
      id: Number(entry[1]),
      topic,
      reference: entry[2].trim(),
      text: entry[3].trim(),
    })
  }

  if (!verses.length) throw new Error('No verses were found in the source file.')
  const ids = new Set<number>()
  verses.forEach((verse, index) => {
    if (verse.id !== index + 1) throw new Error(`Expected verse ${index + 1}, found ${verse.id}.`)
    if (ids.has(verse.id)) throw new Error(`Duplicate verse ID ${verse.id}.`)
    ids.add(verse.id)
  })
  return verses
}
