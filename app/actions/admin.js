'use server'

import { getSession } from '@/lib/session'
import { createLeaveType, updateLeaveType, setLeaveTypeActive } from '@/lib/dal/leave-types.js'
import { updateEmployee, setUserActive } from '@/lib/dal/employees.js'
import { createPublicHoliday, deletePublicHoliday } from '@/lib/dal/public-holidays.js'
import { updateTenant } from '@/lib/dal/tenants.js'

async function requireAdmin() {
  const session = await getSession()
  if (!session.userId || session.role !== 'admin') {
    return { ok: false, errors: [{ message: 'Unauthorized' }], session: null }
  }
  return { ok: true, errors: null, session }
}

export async function createLeaveTypeAction(data) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    await createLeaveType(session.tenantId, data)
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function updateLeaveTypeAction(id, data) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    const updated = await updateLeaveType(session.tenantId, id, data)
    if (!updated) return { ok: false, errors: [{ message: 'Not found' }] }
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function deactivateLeaveTypeAction(id) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    await setLeaveTypeActive(session.tenantId, id, false)
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function reactivateLeaveTypeAction(id) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    await setLeaveTypeActive(session.tenantId, id, true)
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function updateUserAction(id, data) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    const updated = await updateEmployee(session.tenantId, id, data)
    if (!updated) return { ok: false, errors: [{ message: 'Not found' }] }
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function deactivateUserAction(id) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    await setUserActive(session.tenantId, id, false)
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function reactivateUserAction(id) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    await setUserActive(session.tenantId, id, true)
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function addPublicHolidayAction({ date, name }) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    const year = new Date(date).getUTCFullYear()
    await createPublicHoliday(session.tenantId, { date, name, year })
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function deletePublicHolidayAction(id) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    await deletePublicHoliday(session.tenantId, id)
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function updateTenantSettingsAction(data) {
  try {
    const { ok, errors, session } = await requireAdmin()
    if (!ok) return { ok: false, errors }
    await updateTenant(session.tenantId, data)
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}
