import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getLeaveType } from '@/lib/dal/leave-types.js'
import { getRequestsByLeaveType } from '@/lib/dal/leave-requests.js'
import { LeaveTypeForm } from '../LeaveTypeForm'

export default async function EditLeaveTypePage({ params }) {
  const { slug, id } = await params
  const session = await getSession()

  const [leaveType, activeRequests] = await Promise.all([
    getLeaveType(session.tenantId, id),
    getRequestsByLeaveType(session.tenantId, id, ['pending', 'approved']),
  ])

  if (!leaveType) redirect(`/${slug}/admin/leave-types`)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Leave Type</h1>
      <LeaveTypeForm mode="edit" leaveType={leaveType} activeRequestCount={activeRequests.length} />
    </div>
  )
}
