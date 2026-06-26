import { db } from '../lib/db/index.js'
import { tenants, users, leaveTypes, publicHolidays } from '../lib/db/schema.js'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

async function seed() {
  console.log('Seeding database...')

  // Idempotent: check if tenant already exists
  const existingTenants = await db.select().from(tenants).where(eq(tenants.slug, 'acme'))
  let tenant = existingTenants[0]

  if (!tenant) {
    const [inserted] = await db.insert(tenants).values({
      name: 'Acme Corp',
      slug: 'acme',
      timezone: 'UTC',
      fiscal_year_start_month: 1,
      working_week: [1, 2, 3, 4, 5],
      hours_per_workday: 8,
      min_headcount_threshold: 1,
    }).returning()
    tenant = inserted
    console.log('  Created tenant: Acme Corp (slug: acme)')
  } else {
    console.log('  Tenant already exists: Acme Corp (slug: acme)')
  }

  // Idempotent users: upsert by email within tenant
  const adminHash = await bcrypt.hash('admin123', 12)
  const managerHash = await bcrypt.hash('manager123', 12)
  const employeeHash = await bcrypt.hash('employee123', 12)

  // Admin user
  const existingAdmins = await db.select().from(users).where(eq(users.email, 'admin@acme.com'))
  let admin = existingAdmins[0]
  if (!admin) {
    const [inserted] = await db.insert(users).values({
      tenant_id: tenant.id,
      email: 'admin@acme.com',
      password_hash: adminHash,
      name: 'Admin User',
      role: 'admin',
      join_date: '2020-01-01',
    }).returning()
    admin = inserted
    console.log('  Created user: admin@acme.com')
  } else {
    console.log('  User already exists: admin@acme.com')
  }

  // Manager user
  const existingManagers = await db.select().from(users).where(eq(users.email, 'manager@acme.com'))
  let manager = existingManagers[0]
  if (!manager) {
    const [inserted] = await db.insert(users).values({
      tenant_id: tenant.id,
      email: 'manager@acme.com',
      password_hash: managerHash,
      name: 'Jane Manager',
      role: 'manager',
      join_date: '2021-01-01',
      manager_id: admin.id,
    }).returning()
    manager = inserted
    console.log('  Created user: manager@acme.com')
  } else {
    console.log('  User already exists: manager@acme.com')
  }

  // Employee users
  const employeeData = [
    {
      email: 'alice@acme.com',
      name: 'Alice Employee',
      join_date: '2022-06-01',
    },
    {
      email: 'bob@acme.com',
      name: 'Bob Employee',
      join_date: '2023-01-15',
    },
  ]

  for (const emp of employeeData) {
    const existing = await db.select().from(users).where(eq(users.email, emp.email))
    if (!existing[0]) {
      await db.insert(users).values({
        tenant_id: tenant.id,
        email: emp.email,
        password_hash: employeeHash,
        name: emp.name,
        role: 'employee',
        join_date: emp.join_date,
        manager_id: manager.id,
      })
      console.log(`  Created user: ${emp.email}`)
    } else {
      console.log(`  User already exists: ${emp.email}`)
    }
  }

  // Leave types: check by tenant_id + code
  const leaveTypeData = [
    {
      tenant_id: tenant.id, name: 'Annual Leave', code: 'ANNUAL', color: '#10B981',
      paid: true, entitlement_basis: 'FIXED', annual_entitlement_days: '20',
      role_overrides: { manager: 5, admin: 5 }, prorate_on_join: true, proration_rounding: 'FLOOR',
      allow_carry_forward: true, carry_forward_max_days: '5',
      requires_approval: true, allow_half_day: true,
    },
    {
      tenant_id: tenant.id, name: 'Sick Leave', code: 'SICK', color: '#F59E0B',
      paid: true, entitlement_basis: 'FIXED', annual_entitlement_days: '10',
      requires_approval: false, attachment_policy: 'REQUIRED', attachment_required_after_days: 3,
    },
    {
      tenant_id: tenant.id, name: 'Maternity Leave', code: 'PARENTAL_M', color: '#EC4899',
      paid: true, entitlement_basis: 'FIXED', annual_entitlement_days: '90',
      gender_restriction: 'FEMALE', requires_approval: true,
    },
    {
      tenant_id: tenant.id, name: 'Paternity Leave', code: 'PARENTAL_P', color: '#8B5CF6',
      paid: true, entitlement_basis: 'FIXED', annual_entitlement_days: '10',
      gender_restriction: 'MALE', requires_approval: true,
    },
    {
      tenant_id: tenant.id, name: 'Bereavement Leave', code: 'BEREAVEMENT', color: '#6B7280',
      paid: true, entitlement_basis: 'FIXED', annual_entitlement_days: '5',
      requires_approval: false,
    },
    {
      tenant_id: tenant.id, name: 'Unpaid Leave', code: 'UNPAID', color: '#9CA3AF',
      paid: false, entitlement_basis: 'FIXED', annual_entitlement_days: '999',
      requires_approval: true,
    },
    {
      tenant_id: tenant.id, name: 'Time Off in Lieu', code: 'TOIL', color: '#3B82F6',
      paid: true, entitlement_basis: 'ACCRUAL', accrual_rate_per_month: '0',
      allow_carry_forward: true, carry_forward_max_days: '10', carry_forward_expiry_days: 90,
      requires_approval: true,
    },
  ]

  for (const lt of leaveTypeData) {
    const existing = await db.select().from(leaveTypes)
      .where(eq(leaveTypes.code, lt.code))
    const tenantMatch = existing.filter(r => r.tenant_id === tenant.id)
    if (tenantMatch.length === 0) {
      await db.insert(leaveTypes).values(lt)
      console.log(`  Created leave type: ${lt.name} (${lt.code})`)
    } else {
      console.log(`  Leave type already exists: ${lt.name} (${lt.code})`)
    }
  }

  // Public holidays: check by tenant_id + date
  const holidayData = [
    { tenant_id: tenant.id, date: '2026-01-01', name: "New Year's Day", year: 2026 },
    { tenant_id: tenant.id, date: '2026-04-03', name: 'Good Friday', year: 2026 },
    { tenant_id: tenant.id, date: '2026-04-06', name: 'Easter Monday', year: 2026 },
    { tenant_id: tenant.id, date: '2026-05-04', name: 'Early May Bank Holiday', year: 2026 },
    { tenant_id: tenant.id, date: '2026-05-25', name: 'Spring Bank Holiday', year: 2026 },
    { tenant_id: tenant.id, date: '2026-08-31', name: 'Summer Bank Holiday', year: 2026 },
    { tenant_id: tenant.id, date: '2026-12-25', name: 'Christmas Day', year: 2026 },
    { tenant_id: tenant.id, date: '2026-12-26', name: 'Boxing Day', year: 2026 },
    { tenant_id: tenant.id, date: '2026-12-28', name: 'Boxing Day (substitute)', year: 2026 },
  ]

  for (const holiday of holidayData) {
    const existing = await db.select().from(publicHolidays)
      .where(eq(publicHolidays.date, holiday.date))
    const tenantMatch = existing.filter(r => r.tenant_id === tenant.id)
    if (tenantMatch.length === 0) {
      await db.insert(publicHolidays).values(holiday)
      console.log(`  Created holiday: ${holiday.name} (${holiday.date})`)
    } else {
      console.log(`  Holiday already exists: ${holiday.name} (${holiday.date})`)
    }
  }

  console.log('✓ Seed complete')
  console.log('  Tenant slug: acme')
  console.log('  admin@acme.com / admin123')
  console.log('  manager@acme.com / manager123')
  console.log('  alice@acme.com / employee123')
  console.log('  bob@acme.com / employee123')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
