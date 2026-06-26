import { getAllTenants } from '@/lib/dal/tenants.js'
import { getActiveUsersByTenant } from '@/lib/dal/employees.js'
import { getCarryForwardLeaveTypes } from '@/lib/dal/leave-types.js'
import { getApprovedRequestsForFY } from '@/lib/dal/leave-requests.js'
import { getLedgerEntries, insertLedgerEntry } from '@/lib/dal/ledger.js'
import { computeAvailableBalance } from '@/lib/policy-engine/index.js'
import { deriveFiscalYear } from '@/lib/fiscal-year.js'
import { getToday } from '@/lib/utils/date.js'
import { toZonedTime, format } from 'date-fns-tz'

/**
 * Adapt a DB employee row (snake_case) to the shape expected by the policy engine (camelCase joinDate).
 * @param {object} dbEmployee
 */
function toEmployeeModel(dbEmployee) {
  return { ...dbEmployee, joinDate: dbEmployee.join_date }
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allTenants = await getAllTenants()
  let processed = 0

  for (const tenant of allTenants) {
    // Compare today in tenant's timezone
    const nowInTz = toZonedTime(new Date(), tenant.timezone)
    const todayStr = format(nowInTz, 'MM-dd', { timeZone: tenant.timezone })
    const fyStartStr = String(tenant.fiscal_year_start_month).padStart(2, '0') + '-01'

    if (todayStr !== fyStartStr) continue

    const today = getToday()
    const expiringFY = deriveFiscalYear(
      tenant.fiscal_year_start_month,
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 15)),
    )
    const newFY = deriveFiscalYear(tenant.fiscal_year_start_month, today)

    const [allUsers, allLeaveTypes] = await Promise.all([
      getActiveUsersByTenant(tenant.id),
      getCarryForwardLeaveTypes(tenant.id),
    ])

    for (const user of allUsers) {
      for (const lt of allLeaveTypes) {
        const [approvedRequests, ledgerEntries] = await Promise.all([
          getApprovedRequestsForFY(tenant.id, user.id, lt.id, expiringFY.start, expiringFY.end),
          getLedgerEntries(tenant.id, user.id, lt.id),
        ])

        const closingBalance = computeAvailableBalance({
          policy: lt,
          employee: toEmployeeModel(user),
          fiscalYear: expiringFY,
          approvedRequests,
          ledgerEntries,
          today: expiringFY.end,
        })

        if (closingBalance.available <= 0) continue

        const maxCarry = lt.carry_forward_max_days !== null ? Number(lt.carry_forward_max_days) : Infinity
        const carryAmount = Math.min(closingBalance.available, maxCarry)
        const forfeited = closingBalance.available - carryAmount

        let expiresOn = null
        if (lt.carry_forward_expiry_days) {
          const expiry = new Date(newFY.start)
          expiry.setUTCDate(expiry.getUTCDate() + lt.carry_forward_expiry_days)
          expiresOn = expiry.toISOString().slice(0, 10)
        }

        await insertLedgerEntry(tenant.id, {
          employee_id: user.id,
          leave_type_id: lt.id,
          entry_type: 'CARRY_FORWARD',
          days: String(carryAmount),
          fiscal_year: newFY.year,
          expires_on: expiresOn,
          reason: `Carry-forward from FY${expiringFY.year}`,
        })

        if (forfeited > 0) {
          console.log(`[FY ROLLOVER] ${user.email} forfeited ${forfeited} days of ${lt.code} from FY${expiringFY.year}`)
        }

        processed++
      }
    }
  }

  return Response.json({ ok: true, processed })
}
