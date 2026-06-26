import { validateRequest } from '@/lib/policy-engine/validation'

const basePolicy = {
  allow_negative_balance: false,
  max_negative_days: null,
  min_notice_days: 0,
  max_consecutive_days: null,
  min_consecutive_days: 1,
}
const baseContext = {
  today: new Date('2026-06-01'),
  blackoutPeriods: [],
  teamApprovedRequests: [],
  teamSize: 5,
  minHeadcount: 1,
}

describe('validateRequest — balance check', () => {
  it('blocks when insufficient balance and allow_negative_balance is false', () => {
    const request = { working_days: 10, start_date: '2026-06-10', end_date: '2026-06-20' }
    const balance = { available: 5 }
    const results = validateRequest(request, balance, basePolicy, baseContext)
    const balanceCheck = results.find(r => !r.ok && r.blocking)
    expect(balanceCheck).toBeDefined()
    expect(balanceCheck.blocking).toBe(true)
  })

  it('allows when balance is sufficient', () => {
    const request = { working_days: 5, start_date: '2026-06-10', end_date: '2026-06-16' }
    const balance = { available: 10 }
    const results = validateRequest(request, balance, basePolicy, baseContext)
    expect(results.every(r => r.ok)).toBe(true)
  })

  it('allows negative balance up to max when allow_negative_balance is true', () => {
    const policy = { ...basePolicy, allow_negative_balance: true, max_negative_days: '5' }
    const request = { working_days: 8, start_date: '2026-06-10', end_date: '2026-06-19' }
    const balance = { available: 5 }
    const results = validateRequest(request, balance, policy, baseContext)
    // available(5) - requested(8) = -3, which is within -5 limit
    expect(results.every(r => r.ok)).toBe(true)
  })
})

describe('validateRequest — notice check', () => {
  it('blocks when start date is within notice period', () => {
    const policy = { ...basePolicy, min_notice_days: 7 }
    const request = { working_days: 2, start_date: '2026-06-03', end_date: '2026-06-04' }
    const balance = { available: 20 }
    const results = validateRequest(request, balance, policy, baseContext)
    const noticeCheck = results.find(r => !r.ok)
    expect(noticeCheck).toBeDefined()
    expect(noticeCheck.blocking).toBe(true)
  })
})

describe('validateRequest — consecutive days check', () => {
  it('blocks when request exceeds max_consecutive_days', () => {
    const policy = { ...basePolicy, max_consecutive_days: 5 }
    const request = { working_days: 10, start_date: '2026-06-01', end_date: '2026-06-14' }
    const balance = { available: 20 }
    const results = validateRequest(request, balance, policy, baseContext)
    const check = results.find(r => !r.ok)
    expect(check).toBeDefined()
    expect(check.blocking).toBe(true)
  })
})

describe('validateRequest — headcount check', () => {
  it('warns (non-blocking) when team will be below min headcount', () => {
    // teamSize=3, minHeadcount=2, 2 already on leave → only 1 available, below min
    const context = {
      ...baseContext,
      teamSize: 3,
      minHeadcount: 2,
      teamApprovedRequests: [
        { start_date: '2026-06-10', end_date: '2026-06-12' },
        { start_date: '2026-06-10', end_date: '2026-06-12' },
      ],
    }
    const request = { working_days: 3, start_date: '2026-06-10', end_date: '2026-06-12' }
    const balance = { available: 20 }
    const results = validateRequest(request, balance, basePolicy, context)
    const headcountCheck = results.find(r => !r.ok)
    expect(headcountCheck).toBeDefined()
    expect(headcountCheck.blocking).toBe(false)
  })
})
