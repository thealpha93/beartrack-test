import { db } from '@/lib/db/index.js'
import { leaveRequests } from '@/lib/db/schema.js'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'

/** @param {string} tenantId @param {string} employeeId @param {string} leaveTypeId @param {Date} fyStart @param {Date} fyEnd @returns {Promise<object[]>} */
export async function getApprovedRequestsForFY(tenantId, employeeId, leaveTypeId, fyStart, fyEnd) {
  return db.select().from(leaveRequests).where(
    and(
      eq(leaveRequests.tenant_id, tenantId),
      eq(leaveRequests.employee_id, employeeId),
      eq(leaveRequests.leave_type_id, leaveTypeId),
      eq(leaveRequests.status, 'approved'),
      gte(leaveRequests.start_date, fyStart.toISOString().slice(0, 10)),
      lte(leaveRequests.end_date, fyEnd.toISOString().slice(0, 10)),
    )
  )
}

/** @param {string} tenantId @param {string[]} directReportIds @returns {Promise<object[]>} */
export async function getPendingRequestsForManager(tenantId, directReportIds) {
  if (directReportIds.length === 0) return []
  return db.select().from(leaveRequests).where(
    and(
      eq(leaveRequests.tenant_id, tenantId),
      eq(leaveRequests.status, 'pending'),
      inArray(leaveRequests.employee_id, directReportIds),
    )
  )
}

/** @param {string} tenantId @param {string[]} employeeIds @param {Date} startDate @param {Date} endDate @returns {Promise<object[]>} */
export async function getTeamRequestsForDateRange(tenantId, employeeIds, startDate, endDate) {
  if (employeeIds.length === 0) return []
  return db.select().from(leaveRequests).where(
    and(
      eq(leaveRequests.tenant_id, tenantId),
      eq(leaveRequests.status, 'approved'),
      inArray(leaveRequests.employee_id, employeeIds),
      lte(leaveRequests.start_date, endDate),
      gte(leaveRequests.end_date, startDate),
    )
  )
}

/** @param {string} tenantId @param {object} data @returns {Promise<object>} */
export async function insertRequest(tenantId, data) {
  const [inserted] = await db.insert(leaveRequests).values({ ...data, tenant_id: tenantId }).returning()
  return inserted
}

/** @param {string} tenantId @param {string} requestId @param {string} status @param {object} reviewData @returns {Promise<object>} */
export async function updateRequestStatus(tenantId, requestId, status, reviewData = {}) {
  const [updated] = await db.update(leaveRequests)
    .set({ status, updated_at: new Date(), ...reviewData })
    .where(and(eq(leaveRequests.tenant_id, tenantId), eq(leaveRequests.id, requestId)))
    .returning()
  return updated
}

/** @param {string} tenantId @param {string} requestId @returns {Promise<object|null>} */
export async function getRequestById(tenantId, requestId) {
  const [req] = await db.select().from(leaveRequests)
    .where(and(eq(leaveRequests.tenant_id, tenantId), eq(leaveRequests.id, requestId)))
  return req ?? null
}

/** @param {string} tenantId @param {string} employeeId @param {object} options @returns {Promise<object[]>} */
export async function getRequestsByEmployee(tenantId, employeeId, { status, leaveTypeId } = {}) {
  const conditions = [
    eq(leaveRequests.tenant_id, tenantId),
    eq(leaveRequests.employee_id, employeeId),
  ]
  if (status) conditions.push(eq(leaveRequests.status, status))
  if (leaveTypeId) conditions.push(eq(leaveRequests.leave_type_id, leaveTypeId))
  return db.select().from(leaveRequests).where(and(...conditions))
}
