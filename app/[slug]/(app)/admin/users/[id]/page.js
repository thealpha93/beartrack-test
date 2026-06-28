import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getAllUsersByTenant } from '@/lib/dal/employees.js'
import { getActiveRequestsByEmployee } from '@/lib/dal/leave-requests.js'
import { UserEditForm } from '../UserEditForm'

export default async function EditUserPage({ params }) {
  const { slug, id } = await params
  const session = await getSession()

  const [allUsers, pendingRequests] = await Promise.all([
    getAllUsersByTenant(session.tenantId),
    getActiveRequestsByEmployee(session.tenantId, id),
  ])

  const user = allUsers.find(u => u.id === id)
  if (!user) redirect(`/${slug}/admin/users`)

  const activeUsersExcludingSelf = allUsers.filter(u => u.is_active && u.id !== id)
  const pendingCount = pendingRequests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit User</h1>
      <UserEditForm user={user} activeUsers={activeUsersExcludingSelf} pendingRequestCount={pendingCount} />
    </div>
  )
}
