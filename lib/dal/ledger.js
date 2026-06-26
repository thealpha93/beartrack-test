import { db } from '@/lib/db/index.js'
import { leaveLedger } from '@/lib/db/schema.js'
import { eq, and } from 'drizzle-orm'

/** @param {string} tenantId @param {string} employeeId @param {string} leaveTypeId @returns {Promise<object[]>} */
export async function getLedgerEntries(tenantId, employeeId, leaveTypeId) {
  return db.select().from(leaveLedger).where(
    and(
      eq(leaveLedger.tenant_id, tenantId),
      eq(leaveLedger.employee_id, employeeId),
      eq(leaveLedger.leave_type_id, leaveTypeId),
    )
  )
}

/** @param {string} tenantId @param {object} data @returns {Promise<object>} */
export async function insertLedgerEntry(tenantId, data) {
  const [inserted] = await db.insert(leaveLedger).values({ ...data, tenant_id: tenantId }).returning()
  return inserted
}
