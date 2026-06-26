import { db } from '@/lib/db/index.js'
import { invites } from '@/lib/db/schema.js'
import { eq } from 'drizzle-orm'

export async function findInviteByTokenHash(tokenHash) {
  const [row] = await db.select().from(invites).where(eq(invites.token_hash, tokenHash))
  return row ?? null
}

export async function createInvite({ tenantId, email, role, invitedBy, tokenHash, expiresAt }) {
  const [row] = await db.insert(invites).values({
    tenant_id: tenantId,
    email,
    role,
    invited_by: invitedBy,
    token_hash: tokenHash,
    expires_at: expiresAt,
  }).returning()
  return row
}

export async function markInviteAccepted(inviteId) {
  await db.update(invites).set({ accepted_at: new Date() }).where(eq(invites.id, inviteId))
}
