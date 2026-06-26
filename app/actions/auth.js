'use server'

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getSession } from '@/lib/session'
import { getUserByEmail, createUser, updateUserPassword } from '@/lib/dal/employees.js'
import { getTenantBySlug } from '@/lib/dal/tenants.js'
import { findInviteByTokenHash, createInvite, markInviteAccepted } from '@/lib/dal/invites.js'
import {
  createPasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
} from '@/lib/dal/password-reset-tokens.js'

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function login(tenantSlug, email, password) {
  try {
    const tenant = await getTenantBySlug(tenantSlug)
    if (!tenant) return { ok: false, errors: [{ message: 'Invalid credentials' }] }

    const user = await getUserByEmail(tenant.id, email)
    if (!user || !user.is_active) return { ok: false, errors: [{ message: 'Invalid credentials' }] }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return { ok: false, errors: [{ message: 'Invalid credentials' }] }

    const session = await getSession()
    session.userId = user.id
    session.tenantId = tenant.id
    session.role = user.role
    await session.save()

    return { ok: true, data: { role: user.role, slug: tenantSlug } }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function logout() {
  const session = await getSession()
  await session.destroy()
  return { ok: true }
}

export async function sendInvite(email, role) {
  try {
    const session = await getSession()
    if (!session.userId) return { ok: false, errors: [{ message: 'Unauthorized' }] }
    if (!['admin', 'manager'].includes(session.role)) {
      return { ok: false, errors: [{ message: 'Unauthorized' }] }
    }

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await createInvite({
      tenantId: session.tenantId,
      email,
      role,
      invitedBy: session.userId,
      tokenHash,
      expiresAt,
    })

    // Stub: log invite link to console instead of sending email
    console.log(`[INVITE] ${email} → /invite/${token}`)
    return { ok: true, data: { token } }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function acceptInvite(token, name, password) {
  try {
    const tokenHash = hashToken(token)
    const invite = await findInviteByTokenHash(tokenHash)

    if (!invite) return { ok: false, errors: [{ message: 'Invalid or expired invite' }] }
    if (invite.accepted_at) return { ok: false, errors: [{ message: 'Invite already used' }] }
    if (invite.expires_at < new Date()) return { ok: false, errors: [{ message: 'Invite expired' }] }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await createUser({
      tenantId: invite.tenant_id,
      email: invite.email,
      passwordHash,
      name,
      role: invite.role,
      joinDate: new Date().toISOString().slice(0, 10),
    })

    await markInviteAccepted(invite.id)

    const session = await getSession()
    session.userId = user.id
    session.tenantId = invite.tenant_id
    session.role = user.role
    await session.save()

    return { ok: true, data: { role: user.role } }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function requestPasswordReset(tenantSlug, email) {
  try {
    const tenant = await getTenantBySlug(tenantSlug)
    if (!tenant) return { ok: true, data: null } // don't leak tenant existence

    const user = await getUserByEmail(tenant.id, email)
    if (!user) return { ok: true, data: null } // don't leak user existence

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await createPasswordResetToken({ userId: user.id, tokenHash, expiresAt })

    console.log(`[PASSWORD RESET] ${email} → /reset-password/${token}`)

    if (process.env.NODE_ENV !== 'production') {
      return { ok: true, data: { token } }
    }
    return { ok: true, data: null }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function resetPassword(token, newPassword) {
  try {
    const tokenHash = hashToken(token)
    const record = await findPasswordResetToken(tokenHash)

    if (!record) return { ok: false, errors: [{ message: 'Invalid or expired link' }] }
    if (record.used_at) return { ok: false, errors: [{ message: 'Link already used' }] }
    if (record.expires_at < new Date()) return { ok: false, errors: [{ message: 'Link expired' }] }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await updateUserPassword(record.user_id, passwordHash)
    await markPasswordResetTokenUsed(record.id)

    return { ok: true }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}
