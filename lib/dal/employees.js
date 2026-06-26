import { db } from '@/lib/db/index.js'
import { users } from '@/lib/db/schema.js'
import { eq, and } from 'drizzle-orm'

/** @param {string} tenantId @param {string} userId */
export async function getEmployee(tenantId, userId) {
  const [user] = await db.select().from(users)
    .where(and(eq(users.tenant_id, tenantId), eq(users.id, userId), eq(users.is_active, true)))
  return user ?? null
}

/** @param {string} tenantId @param {string} email */
export async function getUserByEmail(tenantId, email) {
  const [user] = await db.select().from(users)
    .where(and(eq(users.tenant_id, tenantId), eq(users.email, email)))
  return user ?? null
}

/** @param {string} tenantId @param {string} managerId */
export async function getDirectReports(tenantId, managerId) {
  return db.select().from(users)
    .where(and(eq(users.tenant_id, tenantId), eq(users.manager_id, managerId), eq(users.is_active, true)))
}
