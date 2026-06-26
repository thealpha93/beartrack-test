import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getTenantBySlug } from '@/lib/dal/tenants.js'
import { getEmployee } from '@/lib/dal/employees.js'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/actions/auth'

export default async function AppLayout({ children, params }) {
  const { slug } = await params
  const session = await getSession()

  if (!session.userId) {
    redirect(`/${slug}/login`)
  }

  const tenant = await getTenantBySlug(slug)

  if (!tenant) {
    redirect(`/${slug}/login`)
  }

  const user = await getEmployee(tenant.id, session.userId)

  if (!tenant || !user) {
    redirect(`/${slug}/login`)
  }

  const isManager = user.role === 'manager' || user.role === 'admin'

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-900">{tenant.name}</span>
          <Link href={`/${slug}/dashboard`} className="text-sm text-gray-600 hover:text-gray-900">
            My Leave
          </Link>
          {isManager && (
            <Link href={`/${slug}/manager`} className="text-sm text-gray-600 hover:text-gray-900">
              Team
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user.name}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">Sign out</Button>
          </form>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
