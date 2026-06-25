import { countWorkingDays } from '@/lib/policy-engine/working-days'

describe('countWorkingDays', () => {
  const MON_FRI = [1, 2, 3, 4, 5]

  it('counts 5 days for a Mon–Fri work week with no holidays', () => {
    expect(countWorkingDays(
      new Date('2026-06-01'), new Date('2026-06-05'), MON_FRI, []
    )).toBe(5)
  })

  it('excludes weekends', () => {
    expect(countWorkingDays(
      new Date('2026-06-01'), new Date('2026-06-07'), MON_FRI, []
    )).toBe(5)
  })

  it('excludes public holidays', () => {
    expect(countWorkingDays(
      new Date('2026-06-01'), new Date('2026-06-05'), MON_FRI,
      [new Date('2026-06-03')]
    )).toBe(4)
  })

  it('returns 0.5 for a single half-day call (start === end)', () => {
    expect(countWorkingDays(
      new Date('2026-06-01'), new Date('2026-06-01'), MON_FRI, [], 'HALF'
    )).toBe(0.5)
  })

  it('returns 0 for a weekend-only range', () => {
    expect(countWorkingDays(
      new Date('2026-06-06'), new Date('2026-06-07'), MON_FRI, []
    )).toBe(0)
  })
})
