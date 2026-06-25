/**
 * @param {number} startMonth - 1-12
 * @param {Date} date
 * @returns {{ start: Date, end: Date, year: number }}
 */
export function deriveFiscalYear(startMonth, date) {
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  const fyYear = month >= startMonth ? year : year - 1
  const start = new Date(Date.UTC(fyYear, startMonth - 1, 1))
  const end = new Date(Date.UTC(fyYear + 1, startMonth - 1, 0))
  return { start, end, year: fyYear }
}
