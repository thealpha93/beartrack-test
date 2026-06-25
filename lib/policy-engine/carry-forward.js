/**
 * @param {object[]} ledgerEntries
 * @param {Date} today
 * @returns {number}
 */
export function getCarryForwardAmount(ledgerEntries, today) {
  return ledgerEntries
    .filter(e => e.entry_type === 'CARRY_FORWARD')
    .filter(e => !e.expires_on || new Date(e.expires_on) >= today)
    .reduce((sum, e) => sum + Number(e.days), 0)
}

/**
 * @param {object[]} ledgerEntries
 * @returns {number}
 */
export function getAdjustmentsTotal(ledgerEntries) {
  return ledgerEntries
    .filter(e => e.entry_type === 'MANUAL_ADJUSTMENT')
    .reduce((sum, e) => sum + Number(e.days), 0)
}
