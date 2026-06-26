'use server'

import { getSession } from '@/lib/session'
import { getEmployee, getDirectReports } from '@/lib/dal/employees.js'
import { getLeaveType, getActiveLeaveTypes } from '@/lib/dal/leave-types.js'
import { getApprovedRequestsForFY } from '@/lib/dal/leave-requests.js'
import { getLedgerEntries } from '@/lib/dal/ledger.js'
import { getTenantById } from '@/lib/dal/tenants.js'
import { computeAvailableBalance } from '@/lib/policy-engine/index.js'
import { deriveFiscalYear } from '@/lib/fiscal-year.js'

/**
 * Adapt a DB employee row (snake_case) to the shape expected by the policy engine (camelCase joinDate).
 */
function toEmployeeModel(dbEmployee) {
  return { ...dbEmployee, joinDate: dbEmployee.join_date }
}

export async function getEmployeeBalance(employeeId, leaveTypeId, date = new Date()) {
  try {
    const session = await getSession()
    const tenantId = session.tenantId

    const [tenant, employee, policy] = await Promise.all([
      getTenantById(tenantId),
      getEmployee(tenantId, employeeId),
      getLeaveType(tenantId, leaveTypeId),
    ])

    if (!tenant || !employee || !policy) {
      return { ok: false, errors: [{ message: 'Not found' }] }
    }

    const fiscalYear = deriveFiscalYear(tenant.fiscal_year_start_month, date)
    const today = date instanceof Date ? date : new Date(date)

    const [approvedRequests, ledgerEntries] = await Promise.all([
      getApprovedRequestsForFY(tenantId, employeeId, leaveTypeId, fiscalYear.start, fiscalYear.end),
      getLedgerEntries(tenantId, employeeId, leaveTypeId),
    ])

    const result = computeAvailableBalance({
      policy,
      employee: toEmployeeModel(employee),
      fiscalYear,
      approvedRequests,
      ledgerEntries,
      today,
    })

    return { ok: true, data: result }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function getTeamBalances(managerId) {
  try {
    const session = await getSession()
    const tenantId = session.tenantId

    const [directReports, leaveTypesList] = await Promise.all([
      getDirectReports(tenantId, managerId),
      getActiveLeaveTypes(tenantId),
    ])

    const priorityCodes = ['ANNUAL', 'SICK', 'TOIL']
    const priorityTypes = leaveTypesList.filter(lt => priorityCodes.includes(lt.code))

    const balances = await Promise.all(
      directReports.map(async emp => {
        const typeBalances = await Promise.all(
          priorityTypes.map(async lt => {
            const res = await getEmployeeBalance(emp.id, lt.id)
            return { leaveType: lt, balance: res.ok ? res.data : null }
          })
        )
        return { employee: emp, balances: typeBalances }
      })
    )

    return { ok: true, data: balances }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}
