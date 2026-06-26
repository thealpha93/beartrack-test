import { getSession } from '@/lib/session'
import { getDirectReports, getEmployee } from '@/lib/dal/employees.js'
import { getPendingRequestsForManager, getTeamRequestsForDateRange } from '@/lib/dal/leave-requests.js'
import { getLeaveType } from '@/lib/dal/leave-types.js'
import { getTeamBalances } from '@/app/actions/balances'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApprovalActions } from './ApprovalActions'

export default async function ManagerPage({ params }) {
  const { slug } = await params
  const session = await getSession()

  if (!['manager', 'admin'].includes(session.role)) {
    redirect(`/${slug}/dashboard`)
  }

  const tenantId = session.tenantId
  const managerId = session.userId

  const directReports = await getDirectReports(tenantId, managerId)
  const reportIds = directReports.map(r => r.id)

  const [pendingRequests, teamBalancesResult] = await Promise.all([
    getPendingRequestsForManager(tenantId, reportIds),
    getTeamBalances(managerId),
  ])

  // Enrich pending requests with employee name and leave type name
  const enrichedRequests = await Promise.all(
    pendingRequests.map(async req => {
      const [emp, lt] = await Promise.all([
        getEmployee(tenantId, req.employee_id),
        getLeaveType(tenantId, req.leave_type_id),
      ])
      return { ...req, employeeName: emp?.name, leaveTypeName: lt?.name, leaveTypeColor: lt?.color }
    })
  )

  // Team availability this week (Mon–Sun)
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekRequests = await getTeamRequestsForDateRange(
    tenantId, reportIds,
    weekStart.toISOString().slice(0, 10),
    weekEnd.toISOString().slice(0, 10)
  )

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Team Dashboard</h1>

      {/* Pending approvals */}
      <section>
        <h2 className="text-lg font-medium mb-4">
          Pending Approvals
          {pendingRequests.length > 0 && (
            <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </h2>
        {enrichedRequests.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {enrichedRequests.map(req => (
              <Card key={req.id}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{req.employeeName}</p>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: req.leaveTypeColor }} />
                      <span className="text-xs text-gray-500">{req.leaveTypeName}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{req.start_date} – {req.end_date}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{req.working_days} days</span>
                    </div>
                  </div>
                  <ApprovalActions requestId={req.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Team availability this week */}
      <section>
        <h2 className="text-lg font-medium mb-4">Team Availability This Week</h2>
        <div className="rounded-lg border bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-gray-600 font-medium w-32">Employee</th>
                {weekDays.map(d => (
                  <th key={d} className="px-2 py-2 text-center text-gray-600 font-medium">
                    {new Date(d).toLocaleDateString('en', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {directReports.map(emp => (
                <tr key={emp.id}>
                  <td className="px-3 py-2 font-medium text-gray-700">{emp.name}</td>
                  {weekDays.map(day => {
                    const onLeave = weekRequests.some(r =>
                      r.employee_id === emp.id &&
                      r.start_date <= day && r.end_date >= day
                    )
                    return (
                      <td key={day} className="px-2 py-2 text-center">
                        {onLeave
                          ? <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs">Out</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Team balance cards */}
      <section>
        <h2 className="text-lg font-medium mb-4">Team Balances</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teamBalancesResult.ok && teamBalancesResult.data.map(({ employee: emp, balances }) => (
            <Card key={emp.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-2">
                    {emp.name.charAt(0)}
                  </span>
                  {emp.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {balances.map(({ leaveType, balance }) => balance && (
                    <div key={leaveType.id} className="text-center">
                      <p className="text-lg font-bold">{balance.available.toFixed(0)}</p>
                      <p className="text-xs text-gray-500">{leaveType.code}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
