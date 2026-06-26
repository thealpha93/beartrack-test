import { db } from '@/lib/db/index.js'
import { users } from '@/lib/db/schema.js'
import { eq, and } from 'drizzle-orm'

/** @param {{ tenantId: string, email: string, passwordHash: string, name: string, role: string, joinDate: string, managerId?: string|null }} params */
export async function createUser({ tenantId, email, passwordHash, name, role, joinDate, managerId }) {
  const [row] = await db.insert(users).values({
    tenant_id: tenantId,
    email,
    password_hash: passwordHash,
    name,
    role,
    join_date: joinDate,
    manager_id: managerId ?? null,
    is_active: true,
  }).returning()
  return row
}

/** @param {string} userId @param {string} passwordHash */
export async function updateUserPassword(userId, passwordHash) {
  await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, userId))
}

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

/**
 * @param {string} tenantId - The tenant's UUID
 * @returns {Promise<object[]>} Active user records for the tenant
 */
export async function getActiveUsersByTenant(tenantId) {
  return db.select().from(users)
    .where(and(eq(users.tenant_id, tenantId), eq(users.is_active, true)))
}
