import type { Verse } from '../types'

export type ImportedVerse = Omit<Verse, 'id'>

export function parseImportedVerses(raw: string): ImportedVerse[] {
  const source = raw.trim()
  if (!source) throw new Error('Add at least one verse before importing.')
  let entries: unknown
  if (source.startsWith('[') || source.startsWith('{')) {
    try {
      entries = JSON.parse(source)
    } catch {
      throw new Error('This JSON could not be read. Use an array of objects with reference and text fields.')
    }
  } else {
    let topic = 'Personal memorization'
    entries = source.split(/\r?\n/).filter((line) => line.trim()).flatMap((line) => {
      if (line.trim().startsWith('## ')) {
        topic = line.trim().slice(3).trim()
        return []
      }
      const match = line.trim().match(/^(?:\d+\.\s+)?(.+?)\s+—\s+(.+)$/)
      if (!match) throw new Error('Use one verse per line: John 3:16 — For God so loved…')
      return [{ reference: match[1], text: match[2], topic }]
    })
  }
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('Import a non-empty list of verses.')
  return entries.map((entry: unknown, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Verse ${index + 1} needs a reference and text.`)
    const { reference, text, topic } = entry as Record<string, unknown>
    if (typeof reference !== 'string' || !reference.trim() || typeof text !== 'string' || !text.trim()) {
      throw new Error(`Verse ${index + 1} needs a reference and text.`)
    }
    return { reference: reference.trim(), text: text.trim(), topic: typeof topic === 'string' && topic.trim() ? topic.trim() : 'Personal memorization' }
  })
}

export function mergePersonalVerses(existing: Verse[], imported: ImportedVerse[]): Verse[] {
  const identity = (verse: ImportedVerse) => `${verse.reference.trim().toLowerCase()}\n${verse.text.trim().replace(/\s+/g, ' ').toLowerCase()}`
  const seen = new Set(existing.map(identity))
  let nextId = Math.min(0, ...existing.map((verse) => verse.id)) - 1
  const added = imported.filter((verse) => {
    const key = identity(verse)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map((verse) => ({ ...verse, id: nextId-- }))
  return [...existing, ...added]
}
