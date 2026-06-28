import { getSession } from '@/lib/session'
import { getAllUsersByTenant } from '@/lib/dal/employees.js'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default async function AdminUsersPage({ params }) {
  const { slug } = await params
  const session = await getSession()
  const allUsers = await getAllUsersByTenant(session.tenantId)
  const userMap = new Map(allUsers.map(u => [u.id, u]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Link href={`/${slug}/admin/users/invite`} className={buttonVariants()}>
          Invite user
        </Link>
      </div>
      <div className="rounded-md border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Manager</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Join date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {allUsers.map(user => (
              <tr key={user.id} className={user.is_active ? '' : 'opacity-50'}>
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {user.manager_id ? (userMap.get(user.manager_id)?.name ?? '—') : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{user.join_date}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/${slug}/admin/users/${user.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {allUsers.length === 0 && (
          <p className="px-4 py-8 text-center text-gray-500 text-sm">No users.</p>
        )}
      </div>
    </div>
  )
}
