import { computeAvailableBalance } from '@/lib/policy-engine/balance'

const fy2026 = { start: new Date('2026-01-01'), end: new Date('2026-12-31'), year: 2026 }
const basePolicy = {
  entitlement_basis: 'FIXED',
  annual_entitlement_days: '20',
  max_accrual_balance: null,
  accrual_rate_per_month: null,
  role_overrides: {},
  prorate_on_join: false,
  proration_rounding: 'FLOOR',
}
const baseEmployee = { id: 'emp1', role: 'employee', joinDate: '2020-01-01' }

describe('computeAvailableBalance', () => {
  it('returns full entitlement when no requests or ledger entries', () => {
    const result = computeAvailableBalance({
      policy: basePolicy,
      employee: baseEmployee,
      fiscalYear: fy2026,
      approvedRequests: [],
      ledgerEntries: [],
      today: new Date('2026-06-01'),
    })
    expect(result.total).toBe(20)
    expect(result.used).toBe(0)
    expect(result.available).toBe(20)
  })

  it('subtracts approved request days', () => {
    const result = computeAvailableBalance({
      policy: basePolicy,
      employee: baseEmployee,
      fiscalYear: fy2026,
      approvedRequests: [{ working_days: '5' }, { working_days: '3' }],
      ledgerEntries: [],
      today: new Date('2026-06-01'),
    })
    expect(result.used).toBe(8)
    expect(result.available).toBe(12)
  })

  it('adds carry-forward to total', () => {
    const result = computeAvailableBalance({
      policy: basePolicy,
      employee: baseEmployee,
      fiscalYear: fy2026,
      approvedRequests: [],
      ledgerEntries: [{ entry_type: 'CARRY_FORWARD', days: '5', expires_on: null }],
      today: new Date('2026-06-01'),
    })
    expect(result.carryForward).toBe(5)
    expect(result.total).toBe(25)
    expect(result.available).toBe(25)
  })

  it('applies role override for manager', () => {
    const policy = { ...basePolicy, role_overrides: { manager: 5 } }
    const result = computeAvailableBalance({
      policy,
      employee: { ...baseEmployee, role: 'manager' },
      fiscalYear: fy2026,
      approvedRequests: [],
      ledgerEntries: [],
      today: new Date('2026-06-01'),
    })
    expect(result.total).toBe(25)
  })
})
