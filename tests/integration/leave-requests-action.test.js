process.env.DATABASE_URL = process.env.DATABASE_URL_TEST

import { vi } from 'vitest'
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))
import { getSession } from '@/lib/session'

import { db } from '@/lib/db/index.js'
import { tenants, users, leaveTypes, leaveRequests } from '@/lib/db/schema.js'
import {
  submitLeaveRequest, approveRequest, rejectRequest, cancelRequest,
} from '@/app/actions/leave-requests.js'
import { getEmployeeBalance } from '@/app/actions/balances.js'

let tenant, manager, otherManager, employee, annualLeave, autoApprovedLeave, mockSession

beforeAll(async () => {
  ;[tenant] = await db.insert(tenants).values({
    name: 'LR Test Co', slug: `lr-${Date.now()}`, timezone: 'UTC',
    fiscal_year_start_month: 1, working_week: [1,2,3,4,5], hours_per_workday: 8, min_headcount_threshold: 1,
  }).returning()
  ;[manager] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'mgr@lr.com', password_hash: 'x',
    name: 'Manager', role: 'manager', join_date: '2020-01-01',
  }).returning()
  ;[otherManager] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'other-mgr@lr.com', password_hash: 'x',
    name: 'Other Manager', role: 'manager', join_date: '2020-01-01',
  }).returning()
  ;[employee] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'emp@lr.com', password_hash: 'x',
    name: 'Employee', role: 'employee', join_date: '2020-01-01', manager_id: manager.id,
  }).returning()
  ;[annualLeave] = await db.insert(leaveTypes).values({
    tenant_id: tenant.id, name: 'Annual', code: 'ANNUAL',
    annual_entitlement_days: '20', role_overrides: {}, requires_approval: true,
    allow_negative_balance: false,
  }).returning()
  ;[autoApprovedLeave] = await db.insert(leaveTypes).values({
    tenant_id: tenant.id, name: 'Bereavement', code: 'BEREAVEMENT',
    annual_entitlement_days: '5', role_overrides: {}, requires_approval: false,
    allow_negative_balance: false,
  }).returning()

  mockSession = { userId: null, tenantId: null, role: null, save: vi.fn(), destroy: vi.fn() }
})

afterAll(async () => {
  await db.delete(leaveRequests)
  await db.delete(leaveTypes)
  await db.delete(users)
  await db.delete(tenants)
})

beforeEach(() => {
  mockSession.userId = employee.id
  mockSession.tenantId = tenant.id
  mockSession.role = 'employee'
  getSession.mockResolvedValue(mockSession)
})

describe('getEmployeeBalance', () => {
  it('returns balance for an employee', async () => {
    const result = await getEmployeeBalance(employee.id, annualLeave.id)
    expect(result.ok).toBe(true)
    expect(result.data.total).toBe(20)
    expect(result.data.used).toBe(0)
    expect(result.data.available).toBe(20)
  })
})

describe('submitLeaveRequest', () => {
  it('creates a pending request when balance is sufficient', async () => {
    const result = await submitLeaveRequest({
      leaveTypeId: annualLeave.id,
      startDate: '2026-08-03', endDate: '2026-08-07', dayType: 'FULL',
    })
    expect(result.ok).toBe(true)
    expect(result.data.requestId).toBeDefined()
    const req = await db.select().from(leaveRequests)
      .where((await import('drizzle-orm')).eq(leaveRequests.id, result.data.requestId))
    expect(req[0].status).toBe('pending')
  })

  it('auto-approves when requires_approval is false', async () => {
    const result = await submitLeaveRequest({
      leaveTypeId: autoApprovedLeave.id,
      startDate: '2026-08-10', endDate: '2026-08-11', dayType: 'FULL',
    })
    expect(result.ok).toBe(true)
    const req = await db.select().from(leaveRequests)
      .where((await import('drizzle-orm')).eq(leaveRequests.id, result.data.requestId))
    expect(req[0].status).toBe('approved')
  })

  it('blocks submission when balance is insufficient', async () => {
    const result = await submitLeaveRequest({
      leaveTypeId: annualLeave.id,
      startDate: '2026-09-01', endDate: '2026-10-30', dayType: 'FULL',
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0].blocking).toBe(true)
  })

  it('counts half-day as 0.5 working days', async () => {
    const result = await submitLeaveRequest({
      leaveTypeId: annualLeave.id,
      startDate: '2026-08-17', endDate: '2026-08-17', dayType: 'HALF_AM',
    })
    expect(result.ok).toBe(true)
    const req = await db.select().from(leaveRequests)
      .where((await import('drizzle-orm')).eq(leaveRequests.id, result.data.requestId))
    expect(Number(req[0].working_days)).toBe(0.5)
  })
})

describe('approveRequest', () => {
  let pendingRequestId

  beforeEach(async () => {
    mockSession.userId = employee.id
    mockSession.tenantId = tenant.id
    mockSession.role = 'employee'
    const result = await submitLeaveRequest({
      leaveTypeId: annualLeave.id,
      startDate: '2026-11-02', endDate: '2026-11-04', dayType: 'FULL',
    })
    pendingRequestId = result.data.requestId
  })

  it('allows manager to approve own direct report request', async () => {
    mockSession.userId = manager.id
    mockSession.role = 'manager'
    const result = await approveRequest(pendingRequestId, 'Approved!')
    expect(result.ok).toBe(true)
    const [req] = await db.select().from(leaveRequests)
      .where((await import('drizzle-orm')).eq(leaveRequests.id, pendingRequestId))
    expect(req.status).toBe('approved')
    expect(req.review_note).toBe('Approved!')
  })

  it("blocks manager from approving another manager's direct report", async () => {
    mockSession.userId = otherManager.id
    mockSession.role = 'manager'
    const result = await approveRequest(pendingRequestId)
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toMatch(/unauthorized/i)
  })

  it('allows admin to approve any request', async () => {
    mockSession.userId = manager.id
    mockSession.role = 'admin'
    const result = await approveRequest(pendingRequestId)
    expect(result.ok).toBe(true)
  })

  it('returns error when request is not pending', async () => {
    mockSession.userId = manager.id
    mockSession.role = 'manager'
    await approveRequest(pendingRequestId)
    const result = await approveRequest(pendingRequestId)
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toMatch(/not pending/i)
  })
})

describe('rejectRequest', () => {
  it('allows manager to reject own direct report request', async () => {
    mockSession.userId = employee.id; mockSession.role = 'employee'
    const { data } = await submitLeaveRequest({
      leaveTypeId: annualLeave.id, startDate: '2026-12-01', endDate: '2026-12-02', dayType: 'FULL',
    })
    mockSession.userId = manager.id; mockSession.role = 'manager'
    const result = await rejectRequest(data.requestId, 'Too busy')
    expect(result.ok).toBe(true)
    const [req] = await db.select().from(leaveRequests)
      .where((await import('drizzle-orm')).eq(leaveRequests.id, data.requestId))
    expect(req.status).toBe('rejected')
    expect(req.review_note).toBe('Too busy')
  })

  it("blocks manager from rejecting another manager's direct report", async () => {
    mockSession.userId = employee.id; mockSession.role = 'employee'
    const { data } = await submitLeaveRequest({
      leaveTypeId: annualLeave.id, startDate: '2026-12-08', endDate: '2026-12-09', dayType: 'FULL',
    })
    mockSession.userId = otherManager.id; mockSession.role = 'manager'
    const result = await rejectRequest(data.requestId)
    expect(result.ok).toBe(false)
  })
})

describe('cancelRequest', () => {
  it('allows employee to cancel own pending request', async () => {
    mockSession.userId = employee.id; mockSession.role = 'employee'
    const { data } = await submitLeaveRequest({
      leaveTypeId: annualLeave.id, startDate: '2026-12-15', endDate: '2026-12-16', dayType: 'FULL',
    })
    const result = await cancelRequest(data.requestId)
    expect(result.ok).toBe(true)
    const [req] = await db.select().from(leaveRequests)
      .where((await import('drizzle-orm')).eq(leaveRequests.id, data.requestId))
    expect(req.status).toBe('cancelled')
  })

  it("blocks employee from cancelling another employee's request", async () => {
    mockSession.userId = employee.id; mockSession.role = 'employee'
    const { data } = await submitLeaveRequest({
      leaveTypeId: annualLeave.id, startDate: '2026-12-22', endDate: '2026-12-23', dayType: 'FULL',
    })
    mockSession.userId = otherManager.id; mockSession.role = 'manager'
    const result = await cancelRequest(data.requestId)
    expect(result.ok).toBe(false)
  })

  it('blocks cancellation of non-pending request', async () => {
    mockSession.userId = employee.id; mockSession.role = 'employee'
    const { data } = await submitLeaveRequest({
      leaveTypeId: autoApprovedLeave.id, startDate: '2026-12-29', endDate: '2026-12-30', dayType: 'FULL',
    })
    // auto-approved, so status is 'approved' not 'pending'
    const result = await cancelRequest(data.requestId)
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toMatch(/pending/i)
  })
})
