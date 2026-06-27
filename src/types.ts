export interface Verse {
  id: number
  topic: string
  reference: string
  text: string
}

export interface WeeklyPlan {
  anchorWeekKey: string
  anchorVerseId: number
}

export type StageId = 'chunks' | 'pairs' | 'transitions' | 'sections' | 'starts' | 'full'
export type Rating = 'again' | 'hard' | 'got-it'

export interface PracticeUnit {
  id: string
  label: string
  text: string
  chunkIndexes: number[]
  requiredStreak: number
  checkpoint?: boolean
}

export interface UnitProgress {
  streak: number
  attempts: number
  mastered: boolean
}

export interface Attempt {
  unitId: string
  stage: StageId
  rating: Rating
  at: string
}

export interface Repair {
  label: string
  text: string
  chunkIndexes: number[]
}

export interface PracticeSession {
  weekKey: string
  verseId: number
  boundaries: number[]
  stageIndex: number
  units: Record<string, PracticeUnit>
  queue: string[]
  progress: Record<string, UnitProgress>
  attempts: Attempt[]
  repair?: Repair
  completedAt?: string
}

export interface AppStore {
  version: 2
  plan?: WeeklyPlan
  chunkPreferences: Record<string, number[]>
  sessions: Record<string, PracticeSession>
}
