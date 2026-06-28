import { getSession } from '@/lib/session'
import { getTenantById } from '@/lib/dal/tenants.js'
import { TenantSettingsForm } from './TenantSettingsForm'

export default async function AdminSettingsPage() {
  const session = await getSession()
  const tenant = await getTenantById(session.tenantId)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tenant Settings</h1>
      <TenantSettingsForm tenant={tenant} />
    </div>
  )
}
