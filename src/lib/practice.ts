import type { PracticeSession, PracticeUnit, Rating, Repair, StageId } from '../types'
import { chunksFromBoundaries, wordsOf } from './chunks'

export const STAGES: { id: StageId; name: string; description: string }[] = [
  { id: 'chunks', name: 'Learn chunks', description: 'Build each small phrase independently.' },
  { id: 'pairs', name: 'Pair chunks', description: 'Connect neighboring chunks without overusing the opening.' },
  { id: 'transitions', name: 'Train transitions', description: 'Practice what comes immediately before and after each boundary.' },
  { id: 'sections', name: 'Build sections', description: 'Turn groups of four chunks into larger memory units.' },
  { id: 'starts', name: 'Vary starting points', description: 'Enter each section from more than one place.' },
  { id: 'full', name: 'Full recitation', description: 'Recite the entire verse without looking.' },
]

function makeUnit(id: string, label: string, chunks: string[], indexes: number[], requiredStreak = 2): PracticeUnit {
  return { id, label, text: indexes.map((index) => chunks[index]).join(' '), chunkIndexes: indexes, requiredStreak }
}

export function unitsForStage(stage: StageId, chunks: string[]): PracticeUnit[] {
  const allIndexes = chunks.map((_, index) => index)
  if (stage === 'chunks') return chunks.map((_, index) => makeUnit(`chunk-${index}`, `Chunk ${index + 1}`, chunks, [index]))
  if (stage === 'pairs') {
    const units: PracticeUnit[] = []
    for (let index = 0; index < chunks.length; index += 2) {
      const indexes = allIndexes.slice(index, index + 2)
      units.push(makeUnit(`pair-${index}`, indexes.length === 2 ? `Chunks ${index + 1}–${index + 2}` : `Final chunk ${index + 1}`, chunks, indexes))
    }
    return units
  }
  if (stage === 'transitions') {
    if (chunks.length === 1) return [makeUnit('transition-single', 'Single-chunk check', chunks, [0])]
    return chunks.slice(0, -1).map((_, index) => {
      const before = wordsOf(chunks[index]).slice(-3)
      const after = wordsOf(chunks[index + 1]).slice(0, 3)
      return {
        id: `transition-${index}`,
        label: `Transition ${index + 1} → ${index + 2}`,
        text: [...before, ...after].join(' '),
        chunkIndexes: [index, index + 1],
        requiredStreak: 2,
      }
    })
  }
  if (stage === 'sections') {
    const units: PracticeUnit[] = []
    for (let index = 0; index < chunks.length; index += 4) {
      const indexes = allIndexes.slice(index, index + 4)
      units.push(makeUnit(`section-${index}`, `Section ${index + 1}–${index + indexes.length}`, chunks, indexes))
    }
    return units
  }
  if (stage === 'starts') {
    return allIndexes.filter((index) => index % 2 === 0).map((index) => {
      const sectionEnd = Math.min(Math.floor(index / 4) * 4 + 4, chunks.length)
      const indexes = allIndexes.slice(index, sectionEnd)
      return makeUnit(`start-${index}`, `Start at chunk ${index + 1}`, chunks, indexes)
    })
  }
  return [makeUnit('full', 'Full verse', chunks, allIndexes)]
}

function stageState(stageIndex: number, chunks: string[]) {
  const units = unitsForStage(STAGES[stageIndex].id, chunks)
  return {
    units: Object.fromEntries(units.map((unit) => [unit.id, unit])),
    queue: units.map((unit) => unit.id),
    progress: Object.fromEntries(units.map((unit) => [unit.id, { streak: 0, attempts: 0, mastered: false }])),
  }
}

export function createSession(weekKey: string, verseId: number, text: string, boundaries: number[]): PracticeSession {
  const chunks = chunksFromBoundaries(text, boundaries)
  return {
    weekKey,
    verseId,
    boundaries,
    stageIndex: 0,
    ...stageState(0, chunks),
    attempts: [],
  }
}

export function createRepair(chunks: string[], troubleChunk: number, stage: StageId): Repair {
  let indexes: number[]
  if (stage === 'full' || stage === 'sections' || stage === 'starts') {
    const start = Math.floor(troubleChunk / 4) * 4
    indexes = chunks.map((_, index) => index).slice(start, start + 4)
  } else {
    indexes = [...new Set([Math.max(0, troubleChunk - 1), troubleChunk])]
  }
  return {
    label: `Repair around chunk ${troubleChunk + 1}`,
    text: indexes.map((index) => chunks[index]).join(' '),
    chunkIndexes: indexes,
  }
}

function insertAt(queue: string[], unitId: string, distance: number) {
  const next = [...queue]
  next.splice(Math.min(distance, next.length), 0, unitId)
  return next
}

export function rateCurrent(session: PracticeSession, chunks: string[], rating: Rating, troubleChunk?: number): PracticeSession {
  const unitId = session.queue[0]
  if (!unitId) return session
  const unit = session.units[unitId]
  const oldProgress = session.progress[unitId]
  const progress = {
    ...oldProgress,
    attempts: oldProgress.attempts + 1,
    streak: rating === 'got-it' ? oldProgress.streak + 1 : 0,
  }
  progress.mastered = progress.streak >= unit.requiredStreak

  let queue = session.queue.slice(1)
  if (!progress.mastered) queue = insertAt(queue, unitId, rating === 'again' ? 1 : rating === 'hard' ? 2 : queue.length)

  let units = session.units
  let unitProgress = { ...session.progress, [unitId]: progress }

  if (session.stageIndex === STAGES.length - 1 && unitId === 'full' && rating === 'got-it' && progress.streak === 1) {
    const checkpoints = unitsForStage('starts', chunks)
    const source = checkpoints[Math.min(checkpoints.length - 1, session.attempts.length % checkpoints.length)]
    const checkpoint: PracticeUnit = { ...source, id: 'full-checkpoint', label: `Checkpoint: ${source.label}`, requiredStreak: 1, checkpoint: true }
    units = { ...units, [checkpoint.id]: checkpoint }
    unitProgress = { ...unitProgress, [checkpoint.id]: { streak: 0, attempts: 0, mastered: false } }
    queue = [checkpoint.id, ...queue.filter((id) => id !== checkpoint.id)]
  }

  const updated: PracticeSession = {
    ...session,
    units,
    queue,
    progress: unitProgress,
    attempts: [...session.attempts, { unitId, stage: STAGES[session.stageIndex].id, rating, at: new Date().toISOString() }],
    repair: rating !== 'got-it' && troubleChunk !== undefined ? createRepair(chunks, troubleChunk, STAGES[session.stageIndex].id) : undefined,
  }

  if (queue.length > 0) return updated
  if (updated.stageIndex === STAGES.length - 1) return { ...updated, completedAt: new Date().toISOString() }
  return { ...updated, stageIndex: updated.stageIndex + 1, ...stageState(updated.stageIndex + 1, chunks), repair: undefined }
}

export function clearRepair(session: PracticeSession): PracticeSession {
  const next = { ...session }
  delete next.repair
  return next
}
