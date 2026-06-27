import { describe, expect, it } from 'vitest'
import type { Verse, WeeklyPlan } from '../types'
import { addWeeks, getWeekKey, verseForWeek, weekOffset } from './schedule'

const verses: Verse[] = [1, 2, 3].map((id) => ({ id, topic: 'Test', reference: `Verse ${id}`, text: `Text ${id}` }))

describe('weekly scheduling', () => {
  it('rolls over exactly Sunday at 3 PM local time', () => {
    expect(new Date(2026, 5, 21).getDay()).toBe(0)
    expect(getWeekKey(new Date(2026, 5, 21, 14, 59, 59))).toBe('2026-06-14')
    expect(getWeekKey(new Date(2026, 5, 21, 15, 0, 0))).toBe('2026-06-21')
  })

  it('adds calendar weeks without DST-sensitive millisecond math', () => {
    expect(addWeeks('2026-03-01', 2)).toBe('2026-03-15')
    expect(weekOffset('2026-03-01', '2026-03-15')).toBe(2)
    expect(weekOffset('2026-03-15', '2026-03-01')).toBe(-2)
  })

  it('moves sequentially in both directions and wraps', () => {
    const plan: WeeklyPlan = { anchorWeekKey: '2026-06-21', anchorVerseId: 3 }
    expect(verseForWeek(plan, '2026-06-21', verses).id).toBe(3)
    expect(verseForWeek(plan, '2026-06-28', verses).id).toBe(1)
    expect(verseForWeek(plan, '2026-06-14', verses).id).toBe(2)
  })
})
