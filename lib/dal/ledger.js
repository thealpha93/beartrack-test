import { db } from '@/lib/db/index.js'
import { leaveLedger } from '@/lib/db/schema.js'
import { eq, and } from 'drizzle-orm'

export async function getLedgerEntries(tenantId, employeeId, leaveTypeId) {
  return db.select().from(leaveLedger).where(
    and(
      eq(leaveLedger.tenant_id, tenantId),
      eq(leaveLedger.employee_id, employeeId),
      eq(leaveLedger.leave_type_id, leaveTypeId),
    )
  )
}

export async function insertLedgerEntry(tenantId, data) {
  const [inserted] = await db.insert(leaveLedger).values({ ...data, tenant_id: tenantId }).returning()
  return inserted
}
