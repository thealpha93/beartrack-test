import { db } from '@/lib/db/index.js'
import { publicHolidays } from '@/lib/db/schema.js'
import { eq, and, asc } from 'drizzle-orm'

/** @param {string} tenantId @param {number} year @returns {Promise<Date[]>} */
export async function getPublicHolidays(tenantId, year) {
  const rows = await db.select().from(publicHolidays)
    .where(and(eq(publicHolidays.tenant_id, tenantId), eq(publicHolidays.year, year)))
  return rows.map(r => new Date(r.date))
}

/** @param {string} tenantId @param {number} year @returns {Promise<object[]>} Full rows with id, name, date, year */
export async function getPublicHolidayRows(tenantId, year) {
  return db.select().from(publicHolidays)
    .where(and(eq(publicHolidays.tenant_id, tenantId), eq(publicHolidays.year, year)))
    .orderBy(asc(publicHolidays.date))
}

/** @param {string} tenantId @param {{ date: string, name: string, year: number }} data */
export async function createPublicHoliday(tenantId, { date, name, year }) {
  const [row] = await db.insert(publicHolidays).values({
    tenant_id: tenantId, date, name, year,
  }).returning()
  return row
}

/** @param {string} tenantId @param {string} id */
export async function deletePublicHoliday(tenantId, id) {
  await db.delete(publicHolidays)
    .where(and(eq(publicHolidays.tenant_id, tenantId), eq(publicHolidays.id, id)))
}
