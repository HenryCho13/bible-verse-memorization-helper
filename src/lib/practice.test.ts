import { describe, expect, it } from 'vitest'
import { chunksFromBoundaries } from './chunks'
import { createSession, rateCurrent, skipToStage, STAGES, unitsForStage } from './practice'

const text = 'one two three four five six seven eight nine ten eleven twelve'
const boundaries = [3, 6, 9]
const chunks = chunksFromBoundaries(text, boundaries)

describe('practice progression', () => {
  it('skips a stage without recording mastery or losing earlier attempts', () => {
    const session = rateCurrent(createSession('2026-06-21', 1, text, boundaries), chunks, 'again', 0)
    const next = skipToStage(session, chunks)
    expect(next.stageIndex).toBe(1)
    expect(next.skippedStages).toEqual(['chunks'])
    expect(next.repair).toBeUndefined()
    expect(next.attempts).toEqual(session.attempts)
    expect(Object.values(next.progress).every((progress) => !progress.mastered && progress.attempts === 0)).toBe(true)
  })

  it('requires actual full recalls after jumping to the last stage', () => {
    let session = skipToStage(createSession('2026-06-21', 1, text, boundaries), chunks, 5)
    expect(session.skippedStages).toHaveLength(5)
    expect(skipToStage(session, chunks)).toBe(session)
    expect(session.completedAt).toBeUndefined()
    session = rateCurrent(session, chunks, 'got-it')
    expect(session.queue[0]).toBe('full-checkpoint')
    session = rateCurrent(session, chunks, 'got-it')
    expect(session.completedAt).toBeUndefined()
    session = rateCurrent(session, chunks, 'got-it')
    expect(session.completedAt).toBeTruthy()
  })
  it('builds the requested assembly stages', () => {
    expect(unitsForStage('chunks', chunks).map((unit) => unit.chunkIndexes)).toEqual([[0], [1], [2], [3]])
    expect(unitsForStage('pairs', chunks).map((unit) => unit.chunkIndexes)).toEqual([[0, 1], [2, 3]])
    expect(unitsForStage('transitions', chunks)).toHaveLength(3)
    expect(unitsForStage('sections', chunks)[0].chunkIndexes).toEqual([0, 1, 2, 3])
    expect(unitsForStage('starts', chunks).map((unit) => unit.chunkIndexes)).toEqual([[0, 1, 2, 3], [2, 3]])
    expect(unitsForStage('full', chunks)[0].chunkIndexes).toEqual([0, 1, 2, 3])
  })

  it('interleaves retries and resets a failed clean streak', () => {
    let session = createSession('2026-06-21', 1, text, boundaries)
    const first = session.queue[0]
    session = rateCurrent(session, chunks, 'got-it')
    expect(session.queue.at(-1)).toBe(first)
    expect(session.progress[first].streak).toBe(1)
    while (session.queue[0] !== first) session = rateCurrent(session, chunks, 'got-it')
    session = rateCurrent(session, chunks, 'hard', 0)
    expect(session.progress[first].streak).toBe(0)
    expect(session.repair?.chunkIndexes).toEqual([0])
  })

  it('completes all stages with two clean recalls and a full-stage checkpoint', () => {
    let session = createSession('2026-06-21', 1, text, boundaries)
    let guard = 0
    while (!session.completedAt && guard < 200) {
      session = rateCurrent(session, chunks, 'got-it')
      guard += 1
    }
    expect(session.completedAt).toBeTruthy()
    expect(session.stageIndex).toBe(STAGES.length - 1)
    expect(session.attempts.some((attempt) => attempt.unitId === 'full-checkpoint')).toBe(true)
    expect(guard).toBeLessThan(200)
  })
})
