import { getSession } from '@/lib/session'
import { getAllLeaveTypes } from '@/lib/dal/leave-types.js'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default async function AdminLeaveTypesPage({ params }) {
  const { slug } = await params
  const session = await getSession()
  const leaveTypesList = await getAllLeaveTypes(session.tenantId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leave Types</h1>
        <Link href={`/${slug}/admin/leave-types/new`} className={buttonVariants()}>
          New leave type
        </Link>
      </div>
      <div className="rounded-md border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-8" />
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Code</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Entitlement</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Paid</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Approval</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {leaveTypesList.map(lt => (
              <tr key={lt.id} className={lt.active ? '' : 'opacity-50'}>
                <td className="px-4 py-3">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: lt.color }}
                  />
                </td>
                <td className="px-4 py-3 font-medium">{lt.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{lt.code}</td>
                <td className="px-4 py-3">{lt.annual_entitlement_days} days/year</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lt.paid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {lt.paid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {lt.requires_approval ? 'Requires approval' : 'Auto-approved'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lt.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {lt.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/${slug}/admin/leave-types/${lt.id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaveTypesList.length === 0 && (
          <p className="px-4 py-8 text-center text-gray-500 text-sm">No leave types yet.</p>
        )}
      </div>
    </div>
  )
}
