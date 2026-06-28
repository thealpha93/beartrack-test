import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { AdminSidebar } from './AdminSidebar'

export default async function AdminLayout({ children, params }) {
  const { slug } = await params
  const session = await getSession()

  if (!session.userId || session.role !== 'admin') {
    redirect(`/${slug}/dashboard`)
  }

  return (
    <div className="flex gap-8">
      <AdminSidebar slug={slug} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
