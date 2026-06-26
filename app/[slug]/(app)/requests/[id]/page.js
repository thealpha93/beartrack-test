import { getSession } from '@/lib/session'
import { getRequestById } from '@/lib/dal/leave-requests.js'
import { getLeaveType } from '@/lib/dal/leave-types.js'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function RequestDetailPage({ params }) {
  const { id } = await params
  const session = await getSession()
  const req = await getRequestById(session.tenantId, id)
  if (!req || req.employee_id !== session.userId) notFound()
  const lt = await getLeaveType(session.tenantId, req.leave_type_id)

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle>Leave Request</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><span className="font-medium">Type:</span> {lt?.name}</p>
        <p><span className="font-medium">Dates:</span> {req.start_date} – {req.end_date}</p>
        <p><span className="font-medium">Days:</span> {req.working_days}</p>
        <p><span className="font-medium">Status:</span> {req.status}</p>
        {req.note && <p><span className="font-medium">Note:</span> {req.note}</p>}
        {req.review_note && <p><span className="font-medium">Review note:</span> {req.review_note}</p>}
      </CardContent>
    </Card>
  )
}
