import { db } from '@/lib/db/index.js'
import { tenants } from '@/lib/db/schema.js'
import { eq } from 'drizzle-orm'

/** @param {string} slug */
export async function getTenantBySlug(slug) {
  const [tenant] = await db.select().from(tenants)
    .where(eq(tenants.slug, slug))
  return tenant ?? null
}

/** @param {string} id */
export async function getTenantById(id) {
  const [tenant] = await db.select().from(tenants)
    .where(eq(tenants.id, id))
  return tenant ?? null
}
