import { getSession } from '@/lib/session'
import { getActiveLeaveTypes } from '@/lib/dal/leave-types.js'
import { getPublicHolidays } from '@/lib/dal/public-holidays.js'
import { getTenantById } from '@/lib/dal/tenants.js'
import { NewRequestForm } from './NewRequestForm'

export default async function NewRequestPage({ params }) {
  const { slug } = await params
  const session = await getSession()
  const [tenant, leaveTypes, holidays] = await Promise.all([
    getTenantById(session.tenantId),
    getActiveLeaveTypes(session.tenantId),
    getPublicHolidays(session.tenantId, new Date().getFullYear()),
  ])

  return (
    <NewRequestForm
      slug={slug}
      leaveTypes={leaveTypes}
      holidays={holidays.map(d => d.toISOString().slice(0, 10))}
      workingWeek={tenant.working_week}
      employeeId={session.userId}
    />
  )
}
