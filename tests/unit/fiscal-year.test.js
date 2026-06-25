import { deriveFiscalYear } from '@/lib/fiscal-year'

describe('deriveFiscalYear', () => {
  it('returns correct FY for Jan-start tenant when date is in same year', () => {
    const fy = deriveFiscalYear(1, new Date('2026-06-15'))
    expect(fy.start).toEqual(new Date('2026-01-01'))
    expect(fy.end).toEqual(new Date('2026-12-31'))
    expect(fy.year).toBe(2026)
  })

  it('returns correct FY for Apr-start tenant when date is before April', () => {
    const fy = deriveFiscalYear(4, new Date('2026-02-10'))
    expect(fy.start).toEqual(new Date('2025-04-01'))
    expect(fy.end).toEqual(new Date('2026-03-31'))
    expect(fy.year).toBe(2025)
  })

  it('returns correct FY for Apr-start tenant when date is in April', () => {
    const fy = deriveFiscalYear(4, new Date('2026-04-01'))
    expect(fy.start).toEqual(new Date('2026-04-01'))
    expect(fy.end).toEqual(new Date('2027-03-31'))
    expect(fy.year).toBe(2026)
  })
})
