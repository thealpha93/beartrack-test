import { db } from '@/lib/db/index.js'
import { leaveTypes } from '@/lib/db/schema.js'
import { eq, and } from 'drizzle-orm'

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
