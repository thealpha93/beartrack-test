import { db } from '@/lib/db/index.js'
import { passwordResetTokens } from '@/lib/db/schema.js'
import { eq } from 'drizzle-orm'

export async function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  const [row] = await db.insert(passwordResetTokens).values({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  }).returning()
  return row
}

export async function findPasswordResetToken(tokenHash) {
  const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token_hash, tokenHash))
  return row ?? null
}

export async function markPasswordResetTokenUsed(tokenId) {
  await db.update(passwordResetTokens).set({ used_at: new Date() }).where(eq(passwordResetTokens.id, tokenId))
}
