import { db } from '../../lib/db/index.js'
import { leaveRequests, tenants } from '../../lib/db/schema.js'
import { eq } from 'drizzle-orm'

export default async function globalSetup() {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, 'acme'))
  if (tenant) {
    await db.delete(leaveRequests).where(eq(leaveRequests.tenant_id, tenant.id))
  }
}
