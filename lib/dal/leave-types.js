import { db } from '@/lib/db/index.js'
import { leaveTypes } from '@/lib/db/schema.js'
import { eq, and, asc } from 'drizzle-orm'

/** @param {string} tenantId @param {string} leaveTypeId */
export async function getLeaveType(tenantId, leaveTypeId) {
  const [lt] = await db.select().from(leaveTypes)
    .where(and(eq(leaveTypes.tenant_id, tenantId), eq(leaveTypes.id, leaveTypeId)))
  return lt ?? null
}

/** @param {string} tenantId */
export async function getActiveLeaveTypes(tenantId) {
  return db.select().from(leaveTypes)
    .where(and(eq(leaveTypes.tenant_id, tenantId), eq(leaveTypes.active, true)))
}

/**
 * @param {string} tenantId - The tenant's UUID
 * @returns {Promise<object[]>} Active leave types that allow carry-forward
 */
export async function getCarryForwardLeaveTypes(tenantId) {
  return db.select().from(leaveTypes)
    .where(and(
      eq(leaveTypes.tenant_id, tenantId),
      eq(leaveTypes.active, true),
      eq(leaveTypes.allow_carry_forward, true),
    ))
}

/** @param {string} tenantId */
export async function getAllLeaveTypes(tenantId) {
  return db.select().from(leaveTypes)
    .where(eq(leaveTypes.tenant_id, tenantId))
    .orderBy(asc(leaveTypes.name))
}

/** @param {string} tenantId @param {object} data */
export async function createLeaveType(tenantId, data) {
  const [row] = await db.insert(leaveTypes).values({
    tenant_id: tenantId,
    name: data.name,
    code: data.code,
    color: data.color,
    paid: data.paid,
    annual_entitlement_days: String(data.annual_entitlement_days),
    prorate_on_join: data.prorate_on_join,
    requires_approval: data.requires_approval,
    allow_half_day: data.allow_half_day,
    allow_carry_forward: data.allow_carry_forward,
    carry_forward_max_days: data.carry_forward_max_days != null ? String(data.carry_forward_max_days) : null,
    allow_negative_balance: data.allow_negative_balance,
    role_overrides: {},
  }).returning()
  return row
}

/** @param {string} tenantId @param {string} id @param {object} data */
export async function updateLeaveType(tenantId, id, data) {
  const [row] = await db.update(leaveTypes)
    .set({
      name: data.name,
      color: data.color,
      paid: data.paid,
      annual_entitlement_days: String(data.annual_entitlement_days),
      prorate_on_join: data.prorate_on_join,
      requires_approval: data.requires_approval,
      allow_half_day: data.allow_half_day,
      allow_carry_forward: data.allow_carry_forward,
      carry_forward_max_days: data.carry_forward_max_days != null ? String(data.carry_forward_max_days) : null,
      allow_negative_balance: data.allow_negative_balance,
      updated_at: new Date(),
    })
    .where(and(eq(leaveTypes.tenant_id, tenantId), eq(leaveTypes.id, id)))
    .returning()
  return row ?? null
}

/** @param {string} tenantId @param {string} id @param {boolean} active */
export async function setLeaveTypeActive(tenantId, id, active) {
  await db.update(leaveTypes)
    .set({ active, updated_at: new Date() })
    .where(and(eq(leaveTypes.tenant_id, tenantId), eq(leaveTypes.id, id)))
}
