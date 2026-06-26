'use server'

import { getSession } from '@/lib/session'
import { getEmployee, getDirectReports } from '@/lib/dal/employees.js'
import { getLeaveType } from '@/lib/dal/leave-types.js'
import { getPublicHolidays } from '@/lib/dal/public-holidays.js'
import {
  insertRequest, updateRequestStatus, getRequestById,
  getTeamRequestsForDateRange, getRequestsByEmployee,
  getApprovedRequestsForFY,
} from '@/lib/dal/leave-requests.js'
import { getLedgerEntries } from '@/lib/dal/ledger.js'
import { getTenantById } from '@/lib/dal/tenants.js'
import { computeAvailableBalance, validateRequest, countWorkingDays } from '@/lib/policy-engine/index.js'
import { deriveFiscalYear } from '@/lib/fiscal-year.js'
import { db } from '@/lib/db/index.js'
import { leaveRequests } from '@/lib/db/schema.js'

/**
 * Adapt a DB employee row (snake_case) to the shape expected by the policy engine (camelCase joinDate).
 */
function toEmployeeModel(dbEmployee) {
  return { ...dbEmployee, joinDate: dbEmployee.join_date }
}

export async function submitLeaveRequest({ leaveTypeId, startDate, endDate, dayType, hours, note }) {
  try {
    const session = await getSession()
    const { userId: employeeId, tenantId } = session

    const [tenant, employee, policy] = await Promise.all([
      getTenantById(tenantId),
      getEmployee(tenantId, employeeId),
      getLeaveType(tenantId, leaveTypeId),
    ])

    if (!tenant || !employee || !policy) {
      return { ok: false, errors: [{ message: 'Not found' }] }
    }

    const today = new Date()
    const fiscalYear = deriveFiscalYear(tenant.fiscal_year_start_month, today)
    const holidays = await getPublicHolidays(tenantId, today.getFullYear())

    let working_days
    if (dayType === 'HOURLY') {
      working_days = Number(hours) / tenant.hours_per_workday
    } else if (dayType === 'HALF_AM' || dayType === 'HALF_PM') {
      working_days = 0.5
    } else {
      working_days = countWorkingDays(new Date(startDate), new Date(endDate), tenant.working_week, holidays)
    }

    const [approvedRequests, ledgerEntries] = await Promise.all([
      getApprovedRequestsForFY(tenantId, employeeId, leaveTypeId, fiscalYear.start, fiscalYear.end),
      getLedgerEntries(tenantId, employeeId, leaveTypeId),
    ])

    const employeeModel = toEmployeeModel(employee)

    const balance = computeAvailableBalance({
      policy,
      employee: employeeModel,
      fiscalYear,
      approvedRequests,
      ledgerEntries,
      today,
    })

    // Get team peer requests for headcount check
    const directReports = await getDirectReports(tenantId, employee.manager_id ?? employeeId)
    const peerIds = directReports.map(r => r.id).filter(id => id !== employeeId)
    const teamRequests = await getTeamRequestsForDateRange(tenantId, peerIds, startDate, endDate)

    const request = { working_days, start_date: startDate, end_date: endDate, day_type: dayType }
    const context = {
      today,
      blackoutPeriods: [],
      teamApprovedRequests: teamRequests,
      teamSize: peerIds.length + 1,
      minHeadcount: tenant.min_headcount_threshold,
    }

    const validations = validateRequest(request, balance, policy, context)
    const blockingErrors = validations.filter(v => !v.ok && v.blocking)
    if (blockingErrors.length > 0) {
      return { ok: false, errors: blockingErrors.map(e => ({ message: e.reason, blocking: true })) }
    }

    // Re-check balance inside transaction to guard against race conditions
    const inserted = await db.transaction(async (tx) => {
      const freshRequests = await getApprovedRequestsForFY(tenantId, employeeId, leaveTypeId, fiscalYear.start, fiscalYear.end)
      const freshBalance = computeAvailableBalance({
        policy,
        employee: employeeModel,
        fiscalYear,
        approvedRequests: freshRequests,
        ledgerEntries,
        today,
      })
      const freshValidations = validateRequest(request, freshBalance, policy, context)
      const freshBlocking = freshValidations.filter(v => !v.ok && v.blocking)
      if (freshBlocking.length > 0) throw new Error('VALIDATION_FAILED')

      const [row] = await tx.insert(leaveRequests).values({
        tenant_id: tenantId,
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        status: policy.requires_approval ? 'pending' : 'approved',
        start_date: startDate,
        end_date: endDate,
        day_type: dayType,
        hours: hours ?? null,
        working_days: String(working_days),
        note: note ?? null,
      }).returning()
      return row
    })

    const warnings = validations.filter(v => !v.ok && !v.blocking)
    return { ok: true, data: { requestId: inserted.id, warnings } }
  } catch (err) {
    if (err.message === 'VALIDATION_FAILED') {
      return { ok: false, errors: [{ message: 'Balance changed during submission. Please try again.' }] }
    }
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function approveRequest(requestId, reviewNote = '') {
  try {
    const session = await getSession()
    const { userId, tenantId, role } = session

    const req = await getRequestById(tenantId, requestId)
    if (!req) return { ok: false, errors: [{ message: 'Not found' }] }
    if (req.status !== 'pending') return { ok: false, errors: [{ message: 'Request is not pending' }] }

    if (role === 'manager') {
      const reports = await getDirectReports(tenantId, userId)
      const reportIds = reports.map(r => r.id)
      if (!reportIds.includes(req.employee_id)) {
        return { ok: false, errors: [{ message: 'Unauthorized' }] }
      }
    } else if (role !== 'admin') {
      return { ok: false, errors: [{ message: 'Unauthorized' }] }
    }

    await updateRequestStatus(tenantId, requestId, 'approved', {
      reviewed_by: userId,
      reviewed_at: new Date(),
      review_note: reviewNote,
    })

    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function rejectRequest(requestId, reviewNote = '') {
  try {
    const session = await getSession()
    const { userId, tenantId, role } = session

    const req = await getRequestById(tenantId, requestId)
    if (!req) return { ok: false, errors: [{ message: 'Not found' }] }
    if (req.status !== 'pending') return { ok: false, errors: [{ message: 'Request is not pending' }] }

    if (role === 'manager') {
      const reports = await getDirectReports(tenantId, userId)
      if (!reports.map(r => r.id).includes(req.employee_id)) {
        return { ok: false, errors: [{ message: 'Unauthorized' }] }
      }
    } else if (role !== 'admin') {
      return { ok: false, errors: [{ message: 'Unauthorized' }] }
    }

    await updateRequestStatus(tenantId, requestId, 'rejected', {
      reviewed_by: userId,
      reviewed_at: new Date(),
      review_note: reviewNote,
    })

    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function cancelRequest(requestId) {
  try {
    const session = await getSession()
    const { userId, tenantId } = session

    const req = await getRequestById(tenantId, requestId)
    if (!req) return { ok: false, errors: [{ message: 'Not found' }] }
    if (req.employee_id !== userId) return { ok: false, errors: [{ message: 'Unauthorized' }] }
    if (req.status !== 'pending') return { ok: false, errors: [{ message: 'Only pending requests can be cancelled' }] }

    await updateRequestStatus(tenantId, requestId, 'cancelled')
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}
