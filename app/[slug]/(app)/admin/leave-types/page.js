import { getSession } from '@/lib/session'
import { getAllLeaveTypes } from '@/lib/dal/leave-types.js'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

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
      <Table className="rounded-md border bg-white">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Entitlement</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaveTypesList.map(lt => (
            <TableRow key={lt.id} className={lt.active ? '' : 'opacity-50'}>
              <TableCell>
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: lt.color }} />
              </TableCell>
              <TableCell className="font-medium">{lt.name}</TableCell>
              <TableCell className="font-mono text-xs text-gray-600">{lt.code}</TableCell>
              <TableCell>{lt.annual_entitlement_days} days/year</TableCell>
              <TableCell>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lt.paid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {lt.paid ? 'Paid' : 'Unpaid'}
                </span>
              </TableCell>
              <TableCell>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {lt.requires_approval ? 'Requires approval' : 'Auto-approved'}
                </span>
              </TableCell>
              <TableCell>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lt.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {lt.active ? 'Active' : 'Inactive'}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/${slug}/admin/leave-types/${lt.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Edit
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
