import { LeaveTypeForm } from '../LeaveTypeForm'

export default function NewLeaveTypePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New Leave Type</h1>
      <LeaveTypeForm mode="create" />
    </div>
  )
}
