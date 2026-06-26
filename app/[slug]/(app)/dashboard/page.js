import { getSession } from '@/lib/session'
import { getActiveLeaveTypes } from '@/lib/dal/leave-types.js'
import { getEmployee } from '@/lib/dal/employees.js'
import { getApprovedRequestsForFY, getRequestsByEmployee } from '@/lib/dal/leave-requests.js'
import { getLedgerEntries } from '@/lib/dal/ledger.js'
import { getPublicHolidays } from '@/lib/dal/public-holidays.js'
import { computeAvailableBalance } from '@/lib/policy-engine/index.js'
import { deriveFiscalYear } from '@/lib/fiscal-year.js'
import { getTenantById } from '@/lib/dal/tenants.js'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CancelRequestButton } from './CancelRequestButton'

export default async function DashboardPage({ params }) {
  const { slug } = await params
  const session = await getSession()
  const tenantId = session.tenantId
  const employeeId = session.userId
  const today = new Date()

  const [tenant, employee, leaveTypesList, allRequests] = await Promise.all([
    getTenantById(tenantId),
    getEmployee(tenantId, employeeId),
    getActiveLeaveTypes(tenantId),
    getRequestsByEmployee(tenantId, employeeId),
  ])

  const fiscalYear = deriveFiscalYear(tenant.fiscal_year_start_month, today)
  const holidays = await getPublicHolidays(tenantId, today.getFullYear())

  const balances = await Promise.all(
    leaveTypesList.map(async (lt) => {
      const [approvedRequests, ledgerEntries] = await Promise.all([
        getApprovedRequestsForFY(tenantId, employeeId, lt.id, fiscalYear.start, fiscalYear.end),
        getLedgerEntries(tenantId, employeeId, lt.id),
      ])
      const balance = computeAvailableBalance({
        policy: lt, employee, fiscalYear, approvedRequests, ledgerEntries, today,
      })
      return { leaveType: lt, balance }
    })
  )

  const leaveTypeMap = new Map(leaveTypesList.map(lt => [lt.id, lt.name]))

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Leave</h1>
        <Button asChild>
          <Link href={`/${slug}/requests/new`}>New Request</Link>
        </Button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {balances.map(({ leaveType, balance }) => (
          <Card key={leaveType.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: leaveType.color }} />
                {leaveType.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{balance.available.toFixed(1)}</p>
              <p className="text-xs text-gray-500">{balance.used.toFixed(1)} used of {balance.total.toFixed(1)} days</p>
              <Progress
                value={balance.total > 0 ? (balance.used / balance.total) * 100 : 0}
                className="mt-2 h-1.5"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request history */}
      <div>
        <h2 className="text-lg font-medium mb-4">Request History</h2>
        {allRequests.length === 0 ? (
          <p className="text-gray-500 text-sm">No requests yet.</p>
        ) : (
          <div className="rounded-md border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Dates</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Days</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {allRequests.map(req => (
                  <tr key={req.id}>
                    <td className="px-4 py-3">{leaveTypeMap.get(req.leave_type_id) ?? req.leave_type_id}</td>
                    <td className="px-4 py-3">{req.start_date} – {req.end_date}</td>
                    <td className="px-4 py-3">{req.working_days}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[req.status] ?? ''}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.status === 'pending' && <CancelRequestButton requestId={req.id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
