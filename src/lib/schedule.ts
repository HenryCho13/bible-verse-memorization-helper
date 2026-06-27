import type { Verse, WeeklyPlan } from '../types'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function dateFromWeekKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 15, 0, 0, 0)
}

export function getWeekKey(now = new Date()): string {
  const boundary = new Date(now)
  boundary.setHours(15, 0, 0, 0)
  boundary.setDate(boundary.getDate() - boundary.getDay())
  if (now.getTime() < boundary.getTime()) boundary.setDate(boundary.getDate() - 7)
  return formatLocalDate(boundary)
}

export function addWeeks(key: string, amount: number): string {
  const date = dateFromWeekKey(key)
  date.setDate(date.getDate() + amount * 7)
  return formatLocalDate(date)
}

export function weekOffset(anchorKey: string, targetKey: string): number {
  const anchor = dateFromWeekKey(anchorKey)
  const target = dateFromWeekKey(targetKey)
  const anchorDay = Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((targetDay - anchorDay) / 604_800_000)
}

export function verseForWeek(plan: WeeklyPlan, weekKey: string, verses: Verse[]): Verse {
  const anchorIndex = verses.findIndex((verse) => verse.id === plan.anchorVerseId)
  if (anchorIndex < 0) throw new Error('The saved weekly verse no longer exists.')
  const rawIndex = anchorIndex + weekOffset(plan.anchorWeekKey, weekKey)
  const index = ((rawIndex % verses.length) + verses.length) % verses.length
  return verses[index]
}

export function nextBoundary(now = new Date()): Date {
  const current = getWeekKey(now)
  return dateFromWeekKey(addWeeks(current, 1))
}

export function formatWeekRange(key: string): string {
  const start = dateFromWeekKey(key)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const format = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  return `${format.format(start)} – ${format.format(end)}`
}
