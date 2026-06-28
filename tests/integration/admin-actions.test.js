// tests/integration/admin-actions.test.js
import { vi } from 'vitest'
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))
import { getSession } from '@/lib/session'

import { db } from '@/lib/db/index.js'
import { eq, and } from 'drizzle-orm'
import { tenants, users, leaveTypes, publicHolidays } from '@/lib/db/schema.js'
import {
  createLeaveTypeAction, updateLeaveTypeAction, deactivateLeaveTypeAction, reactivateLeaveTypeAction,
  updateUserAction, deactivateUserAction, reactivateUserAction,
  addPublicHolidayAction, deletePublicHolidayAction,
  updateTenantSettingsAction,
} from '@/app/actions/admin.js'

let tenant, adminUser, targetUser, sharedLeaveType, mockSession

beforeAll(async () => {
  ;[tenant] = await db.insert(tenants).values({
    name: 'Admin Test Co', slug: `admin-${Date.now()}`, timezone: 'UTC',
    fiscal_year_start_month: 1, working_week: [1, 2, 3, 4, 5], hours_per_workday: 8, min_headcount_threshold: 1,
  }).returning()
  ;[adminUser] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'admin@admin-test.com', password_hash: 'x',
    name: 'Admin User', role: 'admin', join_date: '2020-01-01',
  }).returning()
  ;[targetUser] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'target@admin-test.com', password_hash: 'x',
    name: 'Target User', role: 'employee', join_date: '2021-06-01',
  }).returning()
  ;[sharedLeaveType] = await db.insert(leaveTypes).values({
    tenant_id: tenant.id, name: 'Shared Leave', code: 'SHARED',
    annual_entitlement_days: '10', role_overrides: {}, requires_approval: true,
    allow_negative_balance: false,
  }).returning()

  mockSession = { userId: adminUser.id, tenantId: tenant.id, role: 'admin', save: vi.fn(), destroy: vi.fn() }
})

afterAll(async () => {
  await db.delete(publicHolidays).where(eq(publicHolidays.tenant_id, tenant.id))
  await db.delete(leaveTypes).where(eq(leaveTypes.tenant_id, tenant.id))
  await db.delete(users).where(eq(users.tenant_id, tenant.id))
  await db.delete(tenants).where(eq(tenants.id, tenant.id))
})

beforeEach(() => {
  getSession.mockResolvedValue({ ...mockSession })
})

describe('createLeaveTypeAction', () => {
  it('creates a leave type when called by admin', async () => {
    const result = await createLeaveTypeAction({
      name: 'Sick Leave', code: 'SICK2', color: '#EF4444',
      paid: true, annual_entitlement_days: 10, prorate_on_join: true,
      requires_approval: false, allow_half_day: false,
      allow_carry_forward: false, carry_forward_max_days: null,
      allow_negative_balance: false,
    })
    expect(result.ok).toBe(true)
    const [row] = await db.select().from(leaveTypes)
      .where(and(eq(leaveTypes.tenant_id, tenant.id), eq(leaveTypes.code, 'SICK2')))
    expect(row).toBeDefined()
    expect(row.name).toBe('Sick Leave')
  })

  it('rejects non-admin', async () => {
    getSession.mockResolvedValue({ ...mockSession, role: 'employee' })
    const result = await createLeaveTypeAction({
      name: 'X', code: 'X2', color: '#000', paid: true, annual_entitlement_days: 1,
      prorate_on_join: false, requires_approval: true, allow_half_day: false,
      allow_carry_forward: false, carry_forward_max_days: null, allow_negative_balance: false,
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toMatch(/unauthorized/i)
  })
})

describe('updateLeaveTypeAction', () => {
  it('updates leave type fields', async () => {
    const result = await updateLeaveTypeAction(sharedLeaveType.id, {
      name: 'Shared Leave Updated', color: '#3B82F6', paid: true,
      annual_entitlement_days: 15, prorate_on_join: true, requires_approval: true,
      allow_half_day: true, allow_carry_forward: true, carry_forward_max_days: 5,
      allow_negative_balance: false,
    })
    expect(result.ok).toBe(true)
    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, sharedLeaveType.id))
    expect(row.name).toBe('Shared Leave Updated')
    expect(Number(row.annual_entitlement_days)).toBe(15)
  })
})

describe('deactivateLeaveTypeAction / reactivateLeaveTypeAction', () => {
  it('deactivates a leave type', async () => {
    const result = await deactivateLeaveTypeAction(sharedLeaveType.id)
    expect(result.ok).toBe(true)
    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, sharedLeaveType.id))
    expect(row.active).toBe(false)
  })

  it('reactivates a leave type', async () => {
    const result = await reactivateLeaveTypeAction(sharedLeaveType.id)
    expect(result.ok).toBe(true)
    const [row] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, sharedLeaveType.id))
    expect(row.active).toBe(true)
  })
})

describe('updateUserAction', () => {
  it('updates user fields', async () => {
    const result = await updateUserAction(targetUser.id, {
      name: 'Target Renamed', role: 'manager', manager_id: null, join_date: '2021-06-01',
    })
    expect(result.ok).toBe(true)
    const [row] = await db.select().from(users).where(eq(users.id, targetUser.id))
    expect(row.name).toBe('Target Renamed')
    expect(row.role).toBe('manager')
  })

  it('rejects non-admin', async () => {
    getSession.mockResolvedValue({ ...mockSession, role: 'employee' })
    const result = await updateUserAction(targetUser.id, {
      name: 'x', role: 'employee', manager_id: null, join_date: '2021-01-01',
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toMatch(/unauthorized/i)
  })
})

describe('deactivateUserAction / reactivateUserAction', () => {
  it('deactivates a user', async () => {
    const result = await deactivateUserAction(targetUser.id)
    expect(result.ok).toBe(true)
    const [row] = await db.select().from(users).where(eq(users.id, targetUser.id))
    expect(row.is_active).toBe(false)
  })

  it('reactivates a user', async () => {
    const result = await reactivateUserAction(targetUser.id)
    expect(result.ok).toBe(true)
    const [row] = await db.select().from(users).where(eq(users.id, targetUser.id))
    expect(row.is_active).toBe(true)
  })
})

describe('addPublicHolidayAction / deletePublicHolidayAction', () => {
  it('adds and then deletes a holiday', async () => {
    const addResult = await addPublicHolidayAction({ date: '2026-12-25', name: 'Christmas Day' })
    expect(addResult.ok).toBe(true)
    const [row] = await db.select().from(publicHolidays)
      .where(and(eq(publicHolidays.tenant_id, tenant.id), eq(publicHolidays.name, 'Christmas Day')))
    expect(row).toBeDefined()
    expect(row.year).toBe(2026)

    const deleteResult = await deletePublicHolidayAction(row.id)
    expect(deleteResult.ok).toBe(true)
    const [deleted] = await db.select().from(publicHolidays).where(eq(publicHolidays.id, row.id))
    expect(deleted).toBeUndefined()
  })
})

describe('updateTenantSettingsAction', () => {
  it('updates tenant settings', async () => {
    const result = await updateTenantSettingsAction({
      name: 'Admin Test Co Updated', timezone: 'Europe/London',
      fiscal_year_start_month: 4, working_week: [1, 2, 3, 4, 5],
      hours_per_workday: 8, min_headcount_threshold: 2,
    })
    expect(result.ok).toBe(true)
    const [row] = await db.select().from(tenants).where(eq(tenants.id, tenant.id))
    expect(row.name).toBe('Admin Test Co Updated')
    expect(row.fiscal_year_start_month).toBe(4)
  })
})
