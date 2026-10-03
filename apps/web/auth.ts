import NextAuth from 'next-auth'
import Discord from 'next-auth/providers/discord'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { authIdentities, sessions, users, verificationTokens } from '@mde/db'
import { getDb } from '@/lib/db'
import { sendEmail, signInEmail } from '@/lib/email'

export const CONSENT_COOKIE = 'mde_consent'
const THIRTY_DAYS = 30 * 24 * 60 * 60

async function findUser(email: string | null | undefined) {
  if (!email) return null
  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)
  return row ?? null
}

const providers = [
  // Magic link. Stored as provider 'email'. Sends through Resend, or prints to the console in development.
  Resend({
    id: 'email',
    apiKey: process.env.EMAIL_API_KEY ?? 'unset',
    from: process.env.EMAIL_FROM ?? 'dev@localhost',
    maxAge: 15 * 60,
    async sendVerificationRequest({ identifier, url }) {
      await sendEmail(signInEmail(identifier, url))
    },
  }),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
  ...(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET ? [Discord] : []),
]

export const enabledOAuth = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  discord: Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET),
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    // citext is a custom column type, so the adapter's strict table types need a cast. Runtime shape matches.
    usersTable: users as never,
    accountsTable: authIdentities,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  session: { strategy: 'database', maxAge: THIRTY_DAYS, updateAge: 24 * 60 * 60 },
  trustHost: true,
  pages: { signIn: '/sign-in', error: '/sign-in', verifyRequest: '/sign-in/check-email' },
  callbacks: {
    /**
     * Sign in needs an account whose owner confirmed they are 18 or older and accepted the terms.
     * Email accounts are made by the sign up form before the link is sent. Google and Discord
     * accounts need the consent cookie that the sign up form sets.
     */
    async signIn({ user, account }) {
      const existing = await findUser(user.email)
      if (existing?.status === 'closed') return false
      if (existing?.isAdultConfirmed) return true
      if (account?.provider === 'email') return false
      const consent = (await cookies()).get(CONSENT_COOKIE)?.value
      return consent === 'ok'
    },
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return
      const consent = (await cookies()).get(CONSENT_COOKIE)?.value
      if (consent !== 'ok') return
      const now = new Date()
      await getDb()
        .update(users)
        .set({ isAdultConfirmed: true, adultConfirmedAt: now, termsAcceptedAt: now })
        .where(eq(users.id, user.id))
    },
  },
}))
