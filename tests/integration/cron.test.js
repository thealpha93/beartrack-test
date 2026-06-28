process.env.CRON_SECRET = 'test-cron-secret'

import { db } from '@/lib/db/index.js'
import { tenants, users, leaveTypes, leaveRequests, leaveLedger, publicHolidays } from '@/lib/db/schema.js'
import { eq, and } from 'drizzle-orm'
import { POST } from '@/app/api/cron/fy-rollover/route.js'

// FY start month 7 = July; we'll fake today as 2026-07-01
// so the cron processes the tenant whose fiscal year starts in July.
const FY_START_MONTH = 7
const FAKE_TODAY = new Date('2026-07-01T00:00:00.000Z')

let tenant, otherTenant, user1, user2, carryLeaveType, noCarryLeaveType

beforeAll(async () => {
  ;[tenant] = await db.insert(tenants).values({
    name: 'Cron Test Co',
    slug: `cron-test-${Date.now()}`,
    timezone: 'UTC',
    fiscal_year_start_month: FY_START_MONTH,
    working_week: [1, 2, 3, 4, 5],
    hours_per_workday: 8,
    min_headcount_threshold: 1,
  }).returning()

  // This tenant has FY start in January — must NOT be processed on 2026-07-01
  ;[otherTenant] = await db.insert(tenants).values({
    name: 'Other Cron Co',
    slug: `cron-other-${Date.now()}`,
    timezone: 'UTC',
    fiscal_year_start_month: 1,
    working_week: [1, 2, 3, 4, 5],
    hours_per_workday: 8,
    min_headcount_threshold: 1,
  }).returning()

  ;[user1] = await db.insert(users).values({
    tenant_id: tenant.id,
    email: 'user1@crontest.com',
    password_hash: 'x',
    name: 'User One',
    role: 'employee',
    join_date: '2020-01-01',
  }).returning()

  ;[user2] = await db.insert(users).values({
    tenant_id: tenant.id,
    email: 'user2@crontest.com',
    password_hash: 'x',
    name: 'User Two',
    role: 'employee',
    join_date: '2020-01-01',
  }).returning()

  // Leave type WITH carry-forward (max 5 days, no expiry)
  ;[carryLeaveType] = await db.insert(leaveTypes).values({
    tenant_id: tenant.id,
    name: 'Annual Carry',
    code: 'ANNUAL-CF',
    annual_entitlement_days: '20',
    role_overrides: {},
    active: true,
    allow_carry_forward: true,
    carry_forward_max_days: '5',
    carry_forward_expiry_days: null,
    prorate_on_join: false,
    proration_rounding: 'FLOOR',
  }).returning()

  // Leave type WITHOUT carry-forward — cron must ignore it
  ;[noCarryLeaveType] = await db.insert(leaveTypes).values({
    tenant_id: tenant.id,
    name: 'Sick No CF',
    code: 'SICK-NCF',
    annual_entitlement_days: '10',
    role_overrides: {},
    active: true,
    allow_carry_forward: false,
    prorate_on_join: false,
    proration_rounding: 'FLOOR',
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

/** Helper: build a minimal Request-like object */
function makeRequest(secret = 'test-cron-secret') {
  return {
    headers: {
      get(key) {
        if (key === 'authorization') return `Bearer ${secret}`
        return null
      },
    },
  }
}

/** Clear per-test transient data */
async function clearLedgerAndRequests() {
  await db.delete(leaveLedger)
  await db.delete(leaveRequests)
}

// ── Auth guard ─────────────────────────────────────────────────────────────

describe('POST /api/cron/fy-rollover — auth', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = { headers: { get: () => null } }
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when secret is wrong', async () => {
    const res = await POST(makeRequest('bad-secret'))
    expect(res.status).toBe(401)
  })

  it('accepts a valid secret and returns 200 (no tenants eligible with real today)', async () => {
    // Real today is 2026-06-26, so neither tenant (Jul or Jan FY start) matches
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.processed).toBe(0)
  })
})

// ── Rollover processing ────────────────────────────────────────────────────

describe('POST /api/cron/fy-rollover — rollover logic (fake date: 2026-07-01)', () => {
  beforeEach(async () => {
    await clearLedgerAndRequests()
    vi.useFakeTimers()
    vi.setSystemTime(FAKE_TODAY)
  })

  afterEach(async () => {
    vi.useRealTimers()
    await clearLedgerAndRequests()
  })

  it('inserts a CARRY_FORWARD entry when user has remaining balance', async () => {
    // user1 used 15 days in FY 2025-07-01 – 2026-06-30
    // Entitlement = 20, available = 5, max carry = 5 → carry = 5
    await db.insert(leaveRequests).values({
      tenant_id: tenant.id,
      employee_id: user1.id,
      leave_type_id: carryLeaveType.id,
      status: 'approved',
      start_date: '2025-08-01',
      end_date: '2025-08-20',
      working_days: '15',
      day_type: 'FULL',
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.processed).toBeGreaterThanOrEqual(1)

    const entries = await db.select().from(leaveLedger)
      .where(and(
        eq(leaveLedger.employee_id, user1.id),
        eq(leaveLedger.leave_type_id, carryLeaveType.id),
        eq(leaveLedger.entry_type, 'CARRY_FORWARD'),
      ))

    expect(entries).toHaveLength(1)
    expect(Number(entries[0].days)).toBe(5)
    expect(entries[0].fiscal_year).toBe(2026) // new FY starts July 2026
    expect(entries[0].reason).toBe('Carry-forward from FY2025')
  })

  it('caps carry-forward at carry_forward_max_days', async () => {
    // user1 used 0 days, available = 20, max carry = 5 → carry = 5
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    const entries = await db.select().from(leaveLedger)
      .where(and(
        eq(leaveLedger.employee_id, user1.id),
        eq(leaveLedger.entry_type, 'CARRY_FORWARD'),
      ))

    expect(entries).toHaveLength(1)
    expect(Number(entries[0].days)).toBe(5)
  })

  it('skips users with zero available balance', async () => {
    // user2 used all 20 days — nothing to carry
    await db.insert(leaveRequests).values({
      tenant_id: tenant.id,
      employee_id: user2.id,
      leave_type_id: carryLeaveType.id,
      status: 'approved',
      start_date: '2025-07-01',
      end_date: '2025-07-25',
      working_days: '20',
      day_type: 'FULL',
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    const entries = await db.select().from(leaveLedger)
      .where(and(
        eq(leaveLedger.employee_id, user2.id),
        eq(leaveLedger.entry_type, 'CARRY_FORWARD'),
      ))
    expect(entries).toHaveLength(0)
  })

  it('does not process leave types without allow_carry_forward', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    const entries = await db.select().from(leaveLedger)
      .where(eq(leaveLedger.leave_type_id, noCarryLeaveType.id))
    expect(entries).toHaveLength(0)
  })

  it('does not process tenants whose FY start does not match today', async () => {
    // otherTenant has FY start = January; today is July 1 → skipped
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    const entries = await db.select().from(leaveLedger)
      .where(eq(leaveLedger.tenant_id, otherTenant.id))
    expect(entries).toHaveLength(0)
  })

  it('sets expires_on when carry_forward_expiry_days is configured', async () => {
    // Set expiry = 90 days from new FY start (2026-07-01 + 90 = 2026-09-29)
    await db.update(leaveTypes)
      .set({ carry_forward_expiry_days: 90 })
      .where(eq(leaveTypes.id, carryLeaveType.id))

    try {
      const res = await POST(makeRequest())
      expect(res.status).toBe(200)

      const entries = await db.select().from(leaveLedger)
        .where(and(
          eq(leaveLedger.employee_id, user1.id),
          eq(leaveLedger.entry_type, 'CARRY_FORWARD'),
        ))

      expect(entries.length).toBeGreaterThan(0)
      expect(entries[0].expires_on).toBe('2026-09-29')
    } finally {
      // Always reset the leave type
      await db.update(leaveTypes)
        .set({ carry_forward_expiry_days: null })
        .where(eq(leaveTypes.id, carryLeaveType.id))
    }
  })

  it('processed count matches number of CARRY_FORWARD entries created', async () => {
    // No prior requests → both user1 and user2 have 20 available, each capped at 5
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    const entries = await db.select().from(leaveLedger)
      .where(eq(leaveLedger.entry_type, 'CARRY_FORWARD'))
    expect(body.processed).toBe(entries.length)
    expect(body.processed).toBe(2) // user1 + user2, one leave type each
  })
})
