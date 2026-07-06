import { getSession } from '@/lib/session'
import { getAllUsersByTenant } from '@/lib/dal/employees.js'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'

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
      {allUsers.length === 0 ? (
        <EmptyState
          label="No users yet."
          action={{ label: 'Invite user', href: `/${slug}/admin/users/invite` }}
        />
      ) : (
        <Table className="rounded-md border bg-white">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Join date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {allUsers.map(user => (
              <TableRow key={user.id} className={user.is_active ? '' : 'opacity-50'}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-gray-600">{user.email}</TableCell>
                <TableCell>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {user.role}
                  </span>
                </TableCell>
                <TableCell className="text-gray-600">
                  {user.manager_id ? (userMap.get(user.manager_id)?.name ?? '—') : '—'}
                </TableCell>
                <TableCell className="text-gray-600">{user.join_date}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/${slug}/admin/users/${user.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
