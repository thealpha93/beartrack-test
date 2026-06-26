'use server'

import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db/index.js'
import { users, invites, passwordResetTokens, tenants } from '@/lib/db/schema.js'
import { getUserByEmail } from '@/lib/dal/employees.js'
import { eq, and } from 'drizzle-orm'

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function login(tenantSlug, email, password) {
  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug))
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

    await db.insert(invites).values({
      tenant_id: session.tenantId,
      email,
      role,
      invited_by: session.userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
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
    const [invite] = await db.select().from(invites)
      .where(and(eq(invites.token_hash, tokenHash)))

    if (!invite) return { ok: false, errors: [{ message: 'Invalid or expired invite' }] }
    if (invite.accepted_at) return { ok: false, errors: [{ message: 'Invite already used' }] }
    if (invite.expires_at < new Date()) return { ok: false, errors: [{ message: 'Invite expired' }] }

    const passwordHash = await bcrypt.hash(password, 12)
    const [user] = await db.insert(users).values({
      tenant_id: invite.tenant_id,
      email: invite.email,
      password_hash: passwordHash,
      name,
      role: invite.role,
      join_date: new Date().toISOString().slice(0, 10),
    }).returning()

    await db.update(invites).set({ accepted_at: new Date() }).where(eq(invites.id, invite.id))

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
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug))
    if (!tenant) return { ok: true } // don't leak tenant existence

    const user = await getUserByEmail(tenant.id, email)
    if (!user) return { ok: true } // don't leak user existence

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await db.insert(passwordResetTokens).values({
      user_id: user.id, token_hash: tokenHash, expires_at: expiresAt,
    })

    console.log(`[PASSWORD RESET] ${email} → /reset-password/${token}`)
    return { ok: true }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}

export async function resetPassword(token, newPassword) {
  try {
    const tokenHash = hashToken(token)
    const [record] = await db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token_hash, tokenHash))

    if (!record) return { ok: false, errors: [{ message: 'Invalid or expired link' }] }
    if (record.used_at) return { ok: false, errors: [{ message: 'Link already used' }] }
    if (record.expires_at < new Date()) return { ok: false, errors: [{ message: 'Link expired' }] }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, record.user_id))
    await db.update(passwordResetTokens).set({ used_at: new Date() }).where(eq(passwordResetTokens.id, record.id))

    return { ok: true }
  } catch {
    return { ok: false, errors: [{ message: 'Something went wrong' }] }
  }
}
