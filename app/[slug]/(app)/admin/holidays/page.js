import { getSession } from '@/lib/session'
import { getPublicHolidayRows } from '@/lib/dal/public-holidays.js'
import { HolidaysClient } from './HolidaysClient'

export default async function AdminHolidaysPage({ params, searchParams }) {
  const { slug } = await params
  const sp = await searchParams
  const year = parseInt(sp.year ?? new Date().getFullYear(), 10)
  const session = await getSession()
  const holidays = await getPublicHolidayRows(session.tenantId, year)

  return <HolidaysClient slug={slug} year={year} holidays={holidays} />
}
