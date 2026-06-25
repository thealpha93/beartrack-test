/**
 * @param {object} policy
 * @param {{ start: Date, end: Date }} fiscalYear
 * @param {Date} today
 * @returns {number}
 */
export function computeBaseEntitlement(policy, fiscalYear, today) {
  if (policy.entitlement_basis === 'FIXED') {
    return Number(policy.annual_entitlement_days)
  }
  const months = monthsBetween(fiscalYear.start, today)
  const accrued = Number(policy.accrual_rate_per_month) * months
  const cap = policy.max_accrual_balance !== null && policy.max_accrual_balance !== undefined
    ? Number(policy.max_accrual_balance)
    : Infinity
  return Math.min(accrued, cap)
}

function monthsBetween(start, end) {
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  return Math.max(0, months)
}

/**
 * @param {number} base
 * @param {object} policy
 * @param {string} role
 * @returns {number}
 */
export function applyRoleOverride(base, policy, role) {
  const overrides = policy.role_overrides ?? {}
  return base + (Number(overrides[role] ?? 0))
}

/**
 * @param {number} entitlement
 * @param {object} policy
 * @param {Date} joinDate
 * @param {{ start: Date, end: Date }} fiscalYear
 * @returns {number}
 */
export function applyProration(entitlement, policy, joinDate, fiscalYear) {
  if (!policy.prorate_on_join || joinDate <= fiscalYear.start) {
    return entitlement
  }
  const totalMs = fiscalYear.end - fiscalYear.start
  const remainingMs = fiscalYear.end - joinDate
  const ratio = remainingMs / totalMs
  return roundValue(entitlement * ratio, policy.proration_rounding)
}

function roundValue(value, mode) {
  if (mode === 'CEIL') return Math.ceil(value)
  if (mode === 'HALF_UP') return Math.floor(value + 0.5)
  return Math.floor(value) // FLOOR is default
}
