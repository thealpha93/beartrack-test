import { db } from '@/lib/db/index.js'
import { publicHolidays } from '@/lib/db/schema.js'
import { eq, and } from 'drizzle-orm'

export async function getPublicHolidays(tenantId, year) {
  const rows = await db.select().from(publicHolidays)
    .where(and(eq(publicHolidays.tenant_id, tenantId), eq(publicHolidays.year, year)))
  return rows.map(r => new Date(r.date))
}
