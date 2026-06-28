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

/** @returns {Promise<object[]>} */
export async function getAllTenants() {
  return db.select().from(tenants)
}

/** @param {string} tenantId @param {object} data */
export async function updateTenant(tenantId, data) {
  const [row] = await db.update(tenants)
    .set({
      name: data.name,
      timezone: data.timezone,
      fiscal_year_start_month: data.fiscal_year_start_month,
      working_week: data.working_week,
      hours_per_workday: data.hours_per_workday,
      min_headcount_threshold: data.min_headcount_threshold,
    })
    .where(eq(tenants.id, tenantId))
    .returning()
  return row ?? null
}
