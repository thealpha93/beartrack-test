
import { vi } from 'vitest'

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))
import { getSession } from '@/lib/session'

import { db } from '@/lib/db/index.js'
import { tenants, users, invites, passwordResetTokens } from '@/lib/db/schema.js'
import bcrypt from 'bcryptjs'
import { login, logout, sendInvite, acceptInvite, requestPasswordReset, resetPassword } from '@/app/actions/auth.js'

let tenant, activeUser, inactiveUser, mockSession

beforeAll(async () => {
  ;[tenant] = await db.insert(tenants).values({
    name: 'Auth Test Co', slug: `auth-${Date.now()}`, timezone: 'UTC',
    fiscal_year_start_month: 1, working_week: [1,2,3,4,5], hours_per_workday: 8, min_headcount_threshold: 1,
  }).returning()

  const hash = await bcrypt.hash('password123', 12)
  ;[activeUser] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'active@test.com', password_hash: hash,
    name: 'Active User', role: 'employee', join_date: '2020-01-01',
  }).returning()
  ;[inactiveUser] = await db.insert(users).values({
    tenant_id: tenant.id, email: 'inactive@test.com', password_hash: hash,
    name: 'Inactive', role: 'employee', join_date: '2020-01-01', is_active: false,
  }).returning()

  mockSession = { userId: null, tenantId: null, role: null, save: vi.fn(), destroy: vi.fn() }
})

afterAll(async () => {
  await db.delete(passwordResetTokens)
  await db.delete(invites)
  await db.delete(users)
  await db.delete(tenants)
})

beforeEach(() => {
  mockSession.userId = null
  mockSession.tenantId = null
  mockSession.role = null
  mockSession.save.mockClear()
  mockSession.destroy.mockClear()
  getSession.mockResolvedValue(mockSession)
})

describe('login', () => {
  it('returns ok and sets session on valid credentials', async () => {
    const result = await login(tenant.slug, 'active@test.com', 'password123')
    expect(result.ok).toBe(true)
    expect(mockSession.save).toHaveBeenCalled()
    expect(mockSession.userId).toBe(activeUser.id)
  })

  it('returns error on wrong password', async () => {
    const result = await login(tenant.slug, 'active@test.com', 'wrongpassword')
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toBe('Invalid credentials')
    expect(mockSession.save).not.toHaveBeenCalled()
  })

  it('returns error for inactive user', async () => {
    const result = await login(tenant.slug, 'inactive@test.com', 'password123')
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toBe('Invalid credentials')
  })

  it('returns error for unknown email', async () => {
    const result = await login(tenant.slug, 'nobody@test.com', 'password123')
    expect(result.ok).toBe(false)
  })

  it('returns error for unknown tenant slug', async () => {
    const result = await login('no-such-tenant', 'active@test.com', 'password123')
    expect(result.ok).toBe(false)
  })
})

describe('logout', () => {
  it('destroys the session', async () => {
    const result = await logout()
    expect(result.ok).toBe(true)
    expect(mockSession.destroy).toHaveBeenCalled()
  })
})

describe('sendInvite', () => {
  it('allows admin to send invite', async () => {
    mockSession.userId = activeUser.id
    mockSession.tenantId = tenant.id
    mockSession.role = 'admin'
    const result = await sendInvite('new@test.com', 'employee')
    expect(result.ok).toBe(true)
    const [invite] = await db.select().from(invites).where(
      (await import('drizzle-orm')).eq(invites.email, 'new@test.com')
    )
    expect(invite).toBeDefined()
  })

  it('blocks employee from sending invite', async () => {
    mockSession.userId = activeUser.id
    mockSession.tenantId = tenant.id
    mockSession.role = 'employee'
    const result = await sendInvite('other@test.com', 'employee')
    expect(result.ok).toBe(false)
  })

  it('blocks unauthenticated request', async () => {
    mockSession.userId = null
    const result = await sendInvite('x@test.com', 'employee')
    expect(result.ok).toBe(false)
  })
})

describe('acceptInvite', () => {
  it('creates user and sets session for valid token', async () => {
    mockSession.userId = activeUser.id
    mockSession.tenantId = tenant.id
    mockSession.role = 'admin'
    const inviteResult = await sendInvite('invited@test.com', 'employee')
    const token = inviteResult.data.token

    mockSession.userId = null
    const result = await acceptInvite(token, 'New Person', 'newpass123')
    expect(result.ok).toBe(true)
    expect(mockSession.save).toHaveBeenCalled()
  })

  it('returns error for expired invite', async () => {
    const crypto = await import('crypto')
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    await db.insert(invites).values({
      tenant_id: tenant.id, email: 'expired@test.com', role: 'employee',
      invited_by: activeUser.id, token_hash: tokenHash,
      expires_at: new Date(Date.now() - 1000),
    })
    const result = await acceptInvite(rawToken, 'Expired', 'pass123')
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toMatch(/expired/i)
  })

  it('returns error for invalid token', async () => {
    const result = await acceptInvite('completely-fake-token', 'Nobody', 'pass')
    expect(result.ok).toBe(false)
  })
})

describe('requestPasswordReset', () => {
  it('returns ok even for unknown email (no leakage)', async () => {
    const result = await requestPasswordReset(tenant.slug, 'nobody@test.com')
    expect(result.ok).toBe(true)
  })

  it('returns ok and creates token for known email', async () => {
    const result = await requestPasswordReset(tenant.slug, 'active@test.com')
    expect(result.ok).toBe(true)
    const [token] = await db.select().from(passwordResetTokens)
    expect(token).toBeDefined()
  })
})

describe('resetPassword', () => {
  it('updates password for valid token', async () => {
    const resetResult = await requestPasswordReset(tenant.slug, 'active@test.com')
    expect(resetResult.ok).toBe(true)
    const { token } = resetResult.data

    const result = await resetPassword(token, 'newpassword456')
    expect(result.ok).toBe(true)

    // Verify the new password works
    const loginResult = await login(tenant.slug, 'active@test.com', 'newpassword456')
    expect(loginResult.ok).toBe(true)

    // Restore old password for other tests
    const bcrypt = await import('bcryptjs')
    const { db: testDb } = await import('@/lib/db/index.js')
    const { users: usersTable } = await import('@/lib/db/schema.js')
    const { eq } = await import('drizzle-orm')
    const hash = await bcrypt.hash('password123', 12)
    await testDb.update(usersTable).set({ password_hash: hash }).where(eq(usersTable.id, activeUser.id))
  })

  it('returns error for already-used token', async () => {
    const crypto = await import('crypto')
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    await db.insert(passwordResetTokens).values({
      user_id: activeUser.id, token_hash: tokenHash,
      expires_at: new Date(Date.now() + 3600000),
      used_at: new Date(),
    })
    const result = await resetPassword(rawToken, 'newpass')
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toMatch(/already used/i)
  })

  it('returns error for expired token', async () => {
    const crypto = await import('crypto')
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    await db.insert(passwordResetTokens).values({
      user_id: activeUser.id, token_hash: tokenHash,
      expires_at: new Date(Date.now() - 1000),
    })
    const result = await resetPassword(rawToken, 'newpass')
    expect(result.ok).toBe(false)
    expect(result.errors[0].message).toMatch(/expired/i)
  })
})
