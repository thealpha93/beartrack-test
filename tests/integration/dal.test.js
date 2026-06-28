
import { db } from '@/lib/db/index.js'
import { tenants, users, leaveTypes, leaveRequests, leaveLedger, publicHolidays } from '@/lib/db/schema.js'
import { getEmployee, getUserByEmail, getDirectReports } from '@/lib/dal/employees.js'
import { getLeaveType, getActiveLeaveTypes } from '@/lib/dal/leave-types.js'
import {
  getApprovedRequestsForFY, getPendingRequestsForManager,
  getTeamRequestsForDateRange, insertRequest, updateRequestStatus,
  getRequestById, getRequestsByEmployee,
} from '@/lib/dal/leave-requests.js'
import { getLedgerEntries, insertLedgerEntry } from '@/lib/dal/ledger.js'
import { getPublicHolidays } from '@/lib/dal/public-holidays.js'

let tenant, otherTenant, manager, employee, otherEmployee, inactiveEmployee, annualLeave, sickLeave

beforeAll(async () => {
  ;[tenant] = await db.insert(tenants).values({
    name: 'Test Co', slug: `test-${Date.now()}`, timezone: 'UTC',
    fiscal_year_start_month: 1, working_week: [1,2,3,4,5], hours_per_workday: 8, min_headcount_threshold: 1,
  }).returning()
  ;[otherTenant] = await db.insert(tenants).values({
    name: 'Other Co', slug: `other-${Date.now()}`, timezone: 'UTC',
    fiscal_year_start_month: 1, working_week: [1,2,3,4,5], hours_per_workday: 8, min_headcount_threshold: 1,
  }).returning()
  ;[manager] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'mgr@test.com', password_hash: 'x',
    name: 'Manager', role: 'manager', join_date: '2020-01-01',
  }).returning()
  ;[employee] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'emp@test.com', password_hash: 'x',
    name: 'Employee', role: 'employee', join_date: '2020-01-01', manager_id: manager.id,
  }).returning()
  ;[otherEmployee] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'other@test.com', password_hash: 'x',
    name: 'Other', role: 'employee', join_date: '2020-01-01',
  }).returning()
  ;[inactiveEmployee] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'inactive@test.com', password_hash: 'x',
    name: 'Inactive', role: 'employee', join_date: '2020-01-01', is_active: false,
  }).returning()
  ;[annualLeave] = await db.insert(leaveTypes).values({
    tenant_id: tenant.id, name: 'Annual', code: 'ANNUAL', annual_entitlement_days: '20',
    role_overrides: {}, active: true,
  }).returning()
  ;[sickLeave] = await db.insert(leaveTypes).values({
    tenant_id: tenant.id, name: 'Sick', code: 'SICK', annual_entitlement_days: '10',
    role_overrides: {}, active: false,
  }).returning()
})

afterAll(async () => {
  await db.delete(leaveLedger)
  await db.delete(leaveRequests)
  await db.delete(leaveTypes)
  await db.delete(publicHolidays)
  await db.delete(users)
  await db.delete(tenants)
})

// ── employees.js ──────────────────────────────────────────────────────────────

describe('getEmployee', () => {
  it('returns active user', async () => {
    const result = await getEmployee(tenant.id, employee.id)
    expect(result.id).toBe(employee.id)
  })

  it('returns null for unknown id', async () => {
    expect(await getEmployee(tenant.id, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('returns null for inactive user', async () => {
    expect(await getEmployee(tenant.id, inactiveEmployee.id)).toBeNull()
  })

  it('returns null when tenant does not match', async () => {
    expect(await getEmployee(otherTenant.id, employee.id)).toBeNull()
  })
})

describe('getUserByEmail', () => {
  it('returns user by email', async () => {
    const result = await getUserByEmail(tenant.id, 'emp@test.com')
    expect(result.id).toBe(employee.id)
  })

  it('returns null for unknown email', async () => {
    expect(await getUserByEmail(tenant.id, 'nobody@test.com')).toBeNull()
  })

  it('returns null when tenant does not match', async () => {
    expect(await getUserByEmail(otherTenant.id, 'emp@test.com')).toBeNull()
  })
})

describe('getDirectReports', () => {
  it('returns active direct reports', async () => {
    const results = await getDirectReports(tenant.id, manager.id)
    expect(results.map(r => r.id)).toContain(employee.id)
  })

  it('does not return inactive reports', async () => {
    const results = await getDirectReports(tenant.id, manager.id)
    expect(results.map(r => r.id)).not.toContain(inactiveEmployee.id)
  })

  it('does not return employees from other managers', async () => {
    const results = await getDirectReports(tenant.id, employee.id)
    expect(results).toHaveLength(0)
  })
})

// ── leave-types.js ────────────────────────────────────────────────────────────

describe('getLeaveType', () => {
  it('returns leave type by id', async () => {
    const result = await getLeaveType(tenant.id, annualLeave.id)
    expect(result.code).toBe('ANNUAL')
  })

  it('returns null for unknown id', async () => {
    expect(await getLeaveType(tenant.id, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('returns null when tenant does not match', async () => {
    expect(await getLeaveType(otherTenant.id, annualLeave.id)).toBeNull()
  })
})

describe('getActiveLeaveTypes', () => {
  it('returns only active leave types', async () => {
    const results = await getActiveLeaveTypes(tenant.id)
    expect(results.map(r => r.code)).toContain('ANNUAL')
    expect(results.map(r => r.code)).not.toContain('SICK')
  })
})

// ── leave-requests.js ─────────────────────────────────────────────────────────

describe('insertRequest + getRequestById', () => {
  it('inserts and retrieves a request', async () => {
    const inserted = await insertRequest(tenant.id, {
      employee_id: employee.id, leave_type_id: annualLeave.id,
      status: 'pending', start_date: '2026-07-01', end_date: '2026-07-03',
      working_days: '3', day_type: 'FULL',
    })
    expect(inserted.id).toBeDefined()
    const fetched = await getRequestById(tenant.id, inserted.id)
    expect(fetched.status).toBe('pending')
  })

  it('getRequestById returns null for unknown id', async () => {
    expect(await getRequestById(tenant.id, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})

describe('updateRequestStatus', () => {
  it('updates status and review fields', async () => {
    const [req] = await db.insert(leaveRequests).values({
      tenant_id: tenant.id, employee_id: employee.id, leave_type_id: annualLeave.id,
      status: 'pending', start_date: '2026-08-01', end_date: '2026-08-01',
      working_days: '1', day_type: 'FULL',
    }).returning()
    const updated = await updateRequestStatus(tenant.id, req.id, 'approved', {
      reviewed_by: manager.id, reviewed_at: new Date(), review_note: 'Looks good',
    })
    expect(updated.status).toBe('approved')
    expect(updated.reviewed_by).toBe(manager.id)
    expect(updated.review_note).toBe('Looks good')
  })
})

describe('getApprovedRequestsForFY', () => {
  it('returns approved requests within FY dates', async () => {
    await db.insert(leaveRequests).values({
      tenant_id: tenant.id, employee_id: employee.id, leave_type_id: annualLeave.id,
      status: 'approved', start_date: '2026-03-01', end_date: '2026-03-05',
      working_days: '5', day_type: 'FULL',
    })
    const results = await getApprovedRequestsForFY(
      tenant.id, employee.id, annualLeave.id,
      new Date('2026-01-01'), new Date('2026-12-31')
    )
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.status === 'approved')).toBe(true)
  })

  it('excludes requests outside FY', async () => {
    const results = await getApprovedRequestsForFY(
      tenant.id, employee.id, annualLeave.id,
      new Date('2025-01-01'), new Date('2025-12-31')
    )
    expect(results).toHaveLength(0)
  })

  it('excludes pending requests', async () => {
    await db.insert(leaveRequests).values({
      tenant_id: tenant.id, employee_id: employee.id, leave_type_id: annualLeave.id,
      status: 'pending', start_date: '2026-09-01', end_date: '2026-09-03',
      working_days: '3', day_type: 'FULL',
    })
    const results = await getApprovedRequestsForFY(
      tenant.id, employee.id, annualLeave.id,
      new Date('2026-01-01'), new Date('2026-12-31')
    )
    expect(results.every(r => r.status === 'approved')).toBe(true)
  })
})

describe('getPendingRequestsForManager', () => {
  it('returns pending requests for given employee ids', async () => {
    const results = await getPendingRequestsForManager(tenant.id, [employee.id])
    expect(results.every(r => r.status === 'pending')).toBe(true)
  })

  it('returns empty array when no employee ids provided', async () => {
    expect(await getPendingRequestsForManager(tenant.id, [])).toHaveLength(0)
  })
})

describe('getTeamRequestsForDateRange', () => {
  it('returns approved requests overlapping the range', async () => {
    await db.insert(leaveRequests).values({
      tenant_id: tenant.id, employee_id: otherEmployee.id, leave_type_id: annualLeave.id,
      status: 'approved', start_date: '2026-10-01', end_date: '2026-10-05',
      working_days: '5', day_type: 'FULL',
    })
    const results = await getTeamRequestsForDateRange(
      tenant.id, [otherEmployee.id], '2026-10-03', '2026-10-07'
    )
    expect(results.length).toBeGreaterThan(0)
  })

  it('excludes non-overlapping requests', async () => {
    const results = await getTeamRequestsForDateRange(
      tenant.id, [otherEmployee.id], '2026-11-01', '2026-11-05'
    )
    expect(results).toHaveLength(0)
  })
})

describe('getRequestsByEmployee', () => {
  it('returns all requests for employee', async () => {
    const results = await getRequestsByEmployee(tenant.id, employee.id)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.employee_id === employee.id)).toBe(true)
  })

  it('filters by status', async () => {
    const results = await getRequestsByEmployee(tenant.id, employee.id, { status: 'approved' })
    expect(results.every(r => r.status === 'approved')).toBe(true)
  })

  it('does not return requests from other tenants', async () => {
    const results = await getRequestsByEmployee(otherTenant.id, employee.id)
    expect(results).toHaveLength(0)
  })
})

// ── ledger.js ─────────────────────────────────────────────────────────────────

describe('insertLedgerEntry + getLedgerEntries', () => {
  it('inserts and retrieves a ledger entry', async () => {
    await insertLedgerEntry(tenant.id, {
      employee_id: employee.id, leave_type_id: annualLeave.id,
      entry_type: 'CARRY_FORWARD', days: '5', fiscal_year: 2026,
    })
    const entries = await getLedgerEntries(tenant.id, employee.id, annualLeave.id)
    expect(entries.some(e => e.entry_type === 'CARRY_FORWARD' && Number(e.days) === 5)).toBe(true)
  })

  it('does not return entries from other tenants', async () => {
    const entries = await getLedgerEntries(otherTenant.id, employee.id, annualLeave.id)
    expect(entries).toHaveLength(0)
  })
})

// ── public-holidays.js ────────────────────────────────────────────────────────

describe('getPublicHolidays', () => {
  it('returns holidays as Date objects for the correct year', async () => {
    await db.insert(publicHolidays).values({
      tenant_id: tenant.id, date: '2026-01-01', name: "New Year's", year: 2026,
    })
    const results = await getPublicHolidays(tenant.id, 2026)
    expect(results.every(d => d instanceof Date)).toBe(true)
    expect(results.some(d => d.toISOString().slice(0, 10) === '2026-01-01')).toBe(true)
  })

  it('excludes holidays from other years', async () => {
    const results = await getPublicHolidays(tenant.id, 2025)
    expect(results).toHaveLength(0)
  })
})
