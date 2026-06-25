import { computeBaseEntitlement, applyRoleOverride, applyProration } from './entitlement.js'
import { getCarryForwardAmount, getAdjustmentsTotal } from './carry-forward.js'

/**
 * @param {{ policy: object, employee: object, fiscalYear: object, approvedRequests: object[], ledgerEntries: object[], today: Date }} inputs
 * @returns {{ available: number, used: number, total: number, carryForward: number, adjustments: number }}
 */
export function computeAvailableBalance({ policy, employee, fiscalYear, approvedRequests, ledgerEntries, today }) {
  let entitlement = computeBaseEntitlement(policy, fiscalYear, today)
  entitlement = applyRoleOverride(entitlement, policy, employee.role)
  entitlement = applyProration(entitlement, policy, new Date(employee.joinDate), fiscalYear)

  const carryForward = getCarryForwardAmount(ledgerEntries, today)
  const adjustments = getAdjustmentsTotal(ledgerEntries)
  const total = entitlement + carryForward + adjustments
  const used = approvedRequests.reduce((sum, r) => sum + Number(r.working_days), 0)

  return { available: total - used, used, total, carryForward, adjustments }
}
