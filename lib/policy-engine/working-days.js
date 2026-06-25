/**
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number[]} workingWeek - ISO day numbers (1=Mon, 7=Sun)
 * @param {Date[]} publicHolidays
 * @param {'HALF'|null} [halfDay]
 * @returns {number}
 */
export function countWorkingDays(startDate, endDate, workingWeek, publicHolidays, halfDay = null) {
  if (halfDay === 'HALF') return 0.5

  const holidaySet = new Set(
    publicHolidays.map(d => d instanceof Date ? d.toISOString().slice(0, 10) : d)
  )

  let count = 0
  const current = new Date(startDate)
  while (current <= endDate) {
    const dow = current.getDay() === 0 ? 7 : current.getDay()
    const dateStr = current.toISOString().slice(0, 10)
    if (workingWeek.includes(dow) && !holidaySet.has(dateStr)) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}
