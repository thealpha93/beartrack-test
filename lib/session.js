import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'beartracks_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  },
}

/**
 * Call from Server Actions and Server Components.
 * @returns {Promise<{ userId: string, tenantId: string, role: string, save: Function, destroy: Function }>}
 */
export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession(cookieStore, sessionOptions)
}
