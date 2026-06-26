/**
 * @param {{ working_days: number, start_date: string, end_date: string }} request
 * @param {{ available: number }} balance
 * @param {object} policy
 * @param {{ today: Date, blackoutPeriods: object[], teamApprovedRequests: object[], teamSize: number, minHeadcount: number }} context
 * @returns {Array<{ ok: boolean, reason?: string, blocking?: boolean }>}
 */
export function validateRequest(request, balance, policy, context) {
  return [
    checkBalance(request, balance, policy),
    checkBlackout(request, context.blackoutPeriods),
    checkNotice(request, policy, context.today),
    checkConsecutive(request, policy),
    checkHeadcount(request, context.teamApprovedRequests, context.teamSize, context.minHeadcount),
  ]
}

/**
 * @param {{ working_days: number }} request
 * @param {{ available: number }} balance
 * @param {{ allow_negative_balance: boolean, max_negative_days: string|number|null }} policy
 * @returns {{ ok: boolean, reason?: string, blocking?: boolean }}
 */
function checkBalance(request, balance, policy) {
  const days = Number(request.working_days)
  if (!policy.allow_negative_balance) {
    if (balance.available < days) {
      return { ok: false, reason: `Insufficient balance. Available: ${balance.available}, requested: ${days}`, blocking: true }
    }
  } else {
    const afterRequest = balance.available - days
    const limit = policy.max_negative_days !== null && policy.max_negative_days !== undefined
      ? -Number(policy.max_negative_days)
      : -Infinity
    if (afterRequest < limit) {
      return { ok: false, reason: `Would exceed maximum negative balance of ${policy.max_negative_days} days`, blocking: true }
    }
  }
  return { ok: true }
}

/**
 * @param {{ start_date: string, end_date: string }} request
 * @param {Array<{ start: string, end: string, label: string }>} blackoutPeriods
 * @returns {{ ok: boolean, reason?: string, blocking?: boolean }}
 */
function checkBlackout(request, blackoutPeriods) {
  const start = new Date(request.start_date)
  const end = new Date(request.end_date)
  for (const period of blackoutPeriods) {
    if (start <= new Date(period.end) && end >= new Date(period.start)) {
      return { ok: false, reason: `Dates fall within a blackout period: ${period.label}`, blocking: true }
    }
  }
  return { ok: true }
}

/**
 * @param {{ start_date: string }} request
 * @param {{ min_notice_days: number }} policy
 * @param {Date} today
 * @returns {{ ok: boolean, reason?: string, blocking?: boolean }}
 */
function checkNotice(request, policy, today) {
  if (!policy.min_notice_days) return { ok: true }
  const minStart = new Date(today)
  minStart.setDate(minStart.getDate() + policy.min_notice_days)
  if (new Date(request.start_date) < minStart) {
    return { ok: false, reason: `Minimum ${policy.min_notice_days} days notice required`, blocking: true }
  }
  return { ok: true }
}

/**
 * @param {{ working_days: number }} request
 * @param {{ min_consecutive_days: number, max_consecutive_days: number|null }} policy
 * @returns {{ ok: boolean, reason?: string, blocking?: boolean }}
 */
function checkConsecutive(request, policy) {
  const days = Number(request.working_days)
  if (policy.min_consecutive_days > 1 && days < policy.min_consecutive_days) {
    return { ok: false, reason: `Minimum ${policy.min_consecutive_days} consecutive days required`, blocking: true }
  }
  if (policy.max_consecutive_days !== null && policy.max_consecutive_days !== undefined && days > Number(policy.max_consecutive_days)) {
    return { ok: false, reason: `Maximum ${policy.max_consecutive_days} consecutive days allowed`, blocking: true }
  }
  return { ok: true }
}

/**
 * @param {{ start_date: string, end_date: string }} request
 * @param {Array<{ start_date: string, end_date: string }>} teamApprovedRequests
 * @param {number} teamSize
 * @param {number} minHeadcount
 * @returns {{ ok: boolean, reason?: string, blocking?: boolean }}
 */
function checkHeadcount(request, teamApprovedRequests, teamSize, minHeadcount) {
  const start = new Date(request.start_date)
  const end = new Date(request.end_date)
  const current = new Date(start)
  while (current <= end) {
    const out = teamApprovedRequests.filter(r =>
      new Date(r.start_date) <= current && new Date(r.end_date) >= current
    ).length
    const present = teamSize - out - 1 // -1 for the requester
    if (present < minHeadcount) {
      return { ok: false, reason: 'Team may be below minimum headcount during this period', blocking: false }
    }
    current.setDate(current.getDate() + 1)
  }
  return { ok: true }
}
