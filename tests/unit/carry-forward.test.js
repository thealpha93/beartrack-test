import { getCarryForwardAmount, getAdjustmentsTotal } from '@/lib/policy-engine/carry-forward'

describe('getCarryForwardAmount', () => {
  const today = new Date('2026-06-01')

  it('sums non-expired CARRY_FORWARD entries', () => {
    const entries = [
      { entry_type: 'CARRY_FORWARD', days: '5', expires_on: null },
      { entry_type: 'CARRY_FORWARD', days: '3', expires_on: '2026-12-31' },
    ]
    expect(getCarryForwardAmount(entries, today)).toBe(8)
  })

  it('excludes expired CARRY_FORWARD entries', () => {
    const entries = [
      { entry_type: 'CARRY_FORWARD', days: '5', expires_on: '2026-01-01' },
    ]
    expect(getCarryForwardAmount(entries, today)).toBe(0)
  })

  it('ignores MANUAL_ADJUSTMENT entries', () => {
    const entries = [
      { entry_type: 'MANUAL_ADJUSTMENT', days: '2', expires_on: null },
      { entry_type: 'CARRY_FORWARD', days: '3', expires_on: null },
    ]
    expect(getCarryForwardAmount(entries, today)).toBe(3)
  })
})

describe('getAdjustmentsTotal', () => {
  it('sums positive and negative adjustments', () => {
    const entries = [
      { entry_type: 'MANUAL_ADJUSTMENT', days: '3' },
      { entry_type: 'MANUAL_ADJUSTMENT', days: '-1' },
      { entry_type: 'CARRY_FORWARD', days: '5' },
    ]
    expect(getAdjustmentsTotal(entries)).toBe(2)
  })
})
