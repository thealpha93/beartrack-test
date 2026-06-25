import { computeBaseEntitlement, applyRoleOverride, applyProration } from '@/lib/policy-engine/entitlement'

const fy2026 = { start: new Date('2026-01-01'), end: new Date('2026-12-31') }

describe('computeBaseEntitlement', () => {
  it('returns annual_entitlement_days for FIXED basis', () => {
    const policy = { entitlement_basis: 'FIXED', annual_entitlement_days: '20', max_accrual_balance: null }
    expect(computeBaseEntitlement(policy, fy2026, new Date('2026-06-01'))).toBe(20)
  })

  it('returns accrued days for ACCRUAL basis (6 months elapsed)', () => {
    const policy = { entitlement_basis: 'ACCRUAL', accrual_rate_per_month: '1.67', max_accrual_balance: null }
    const result = computeBaseEntitlement(policy, fy2026, new Date('2026-07-01'))
    expect(result).toBeCloseTo(10.02, 1)
  })

  it('caps ACCRUAL at max_accrual_balance', () => {
    const policy = { entitlement_basis: 'ACCRUAL', accrual_rate_per_month: '5', max_accrual_balance: '10' }
    const result = computeBaseEntitlement(policy, fy2026, new Date('2026-12-01'))
    expect(result).toBe(10)
  })
})

describe('applyRoleOverride', () => {
  it('adds role override days', () => {
    const policy = { role_overrides: { manager: 5 } }
    expect(applyRoleOverride(20, policy, 'manager')).toBe(25)
  })

  it('returns base unchanged if no override for role', () => {
    const policy = { role_overrides: {} }
    expect(applyRoleOverride(20, policy, 'employee')).toBe(20)
  })
})

describe('applyProration', () => {
  it('returns entitlement unchanged when prorate_on_join is false', () => {
    const policy = { prorate_on_join: false, proration_rounding: 'FLOOR' }
    expect(applyProration(20, policy, new Date('2026-07-01'), fy2026)).toBe(20)
  })

  it('returns entitlement unchanged when join date is before FY start', () => {
    const policy = { prorate_on_join: true, proration_rounding: 'FLOOR' }
    expect(applyProration(20, policy, new Date('2025-12-01'), fy2026)).toBe(20)
  })

  it('prorates for mid-year join with FLOOR rounding', () => {
    // Joins July 1 = 6 months remaining out of 12 = 50% → floor(10) = 10
    const policy = { prorate_on_join: true, proration_rounding: 'FLOOR' }
    const result = applyProration(20, policy, new Date('2026-07-01'), fy2026)
    expect(result).toBe(10)
  })

  it('prorates with CEIL rounding', () => {
    const policy = { prorate_on_join: true, proration_rounding: 'CEIL' }
    // 20 days, join Oct 1 → ~3 months remaining → ceil(20 * 92/365) ≈ ceil(5.04) = 6
    const result = applyProration(20, policy, new Date('2026-10-01'), fy2026)
    expect(result).toBeGreaterThanOrEqual(5)
  })
})
