import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { brand, env } from '@mde/config'
import { db, tables } from '@mde/db'
import { and, eq, sql } from 'drizzle-orm'
import NextAuth, { type NextAuthConfig } from 'next-auth'
import Discord from 'next-auth/providers/discord'
import Google from 'next-auth/providers/google'
import type { EmailConfig } from 'next-auth/providers'
import { cookies } from 'next/headers'
import { CONSENT_COOKIE, readConsent } from './server/consent'
import { escapeHtml, sendEmail } from './server/email'

// Sessions last 90 days and renew while used, so people stay signed in (testing report item 8).
const SESSION_MAX_AGE = 90 * 24 * 60 * 60

// Email magic link. Sent through Resend, or written to the dev outbox without an API key.
const emailProvider: EmailConfig = {
  id: 'email',
  type: 'email',
  name: 'Email',
  from: process.env.EMAIL_FROM ?? 'no-reply@localhost',
  maxAge: 24 * 60 * 60,
  options: {},
  async sendVerificationRequest({ identifier, url }) {
    const { name } = brand()
    await sendEmail({
      to: identifier,
      subject: 'Your sign-in link',
      text: `Use this link to sign in to ${name}. It works once and expires in 24 hours.\n\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
      html: `<p style="font:15px/1.5 Archivo,Arial,sans-serif;color:#1A1510">Use this link to sign in to ${escapeHtml(name)}. It works once and expires in 24 hours.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#1A1510;color:#fff;font:500 15px Archivo,Arial,sans-serif;text-decoration:none">Sign in</a></p><p style="font:13px Archivo,Arial,sans-serif;color:#6E675C">If you did not ask for this, you can ignore this email.</p>`,
    })
  },
}

function providers(): NextAuthConfig['providers'] {
  const e = env()
  const list: NextAuthConfig['providers'] = [emailProvider]
  if (e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET)
    list.push(Google({ clientId: e.AUTH_GOOGLE_ID, clientSecret: e.AUTH_GOOGLE_SECRET }))
  if (e.AUTH_DISCORD_ID && e.AUTH_DISCORD_SECRET)
    list.push(Discord({ clientId: e.AUTH_DISCORD_ID, clientSecret: e.AUTH_DISCORD_SECRET }))
  return list
}

/** Which sign-in methods are configured, so the sign-in screens only offer working ones. */
export function enabledProviders() {
  const e = env()
  return {
    google: !!(e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET),
    discord: !!(e.AUTH_DISCORD_ID && e.AUTH_DISCORD_SECRET),
  }
}

async function consentTime() {
  return readConsent((await cookies()).get(CONSENT_COOKIE)?.value)
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  // Sign-in links, Google and Discord always use the app's public address (APP_URL), never an address
  // a proxy forwards (Google showed the Railway address otherwise).
  process.env.AUTH_URL = `${env().APP_URL}/api/auth`
  delete process.env.NEXTAUTH_URL
  return {
    adapter: DrizzleAdapter(db(), {
      usersTable: tables.users,
      accountsTable: tables.authIdentities,
      sessionsTable: tables.sessions,
      verificationTokensTable: tables.verificationTokens,
    } as never),
    providers: providers(),
    secret: env().AUTH_SECRET,
    trustHost: true,
    // Database sessions: a new token on every sign in, expiry after 90 days without use.
    session: { strategy: 'database', maxAge: SESSION_MAX_AGE, updateAge: 24 * 60 * 60 },
    pages: { signIn: '/sign-in', verifyRequest: '/check-email', error: '/auth-error' },
    callbacks: {
      // New accounts need the sign-up terms tick (03_SYSTEMS.md section 13: block sign up without them).
      async signIn({ user, account, email }) {
        const address = (user.email ?? '').trim().toLowerCase()
        const d = db()
        const [existing] = address
          ? await d
              .select({ id: tables.users.id, status: tables.users.status, verified: tables.users.emailVerified })
              .from(tables.users)
              .where(sql`email = ${address}`)
          : []
        // New email sign-ups are signed in before their address is proven. The first time the owner of
        // the inbox uses a link, every earlier session ends, so nobody keeps an address that is not theirs.
        if (existing && !existing.verified && account?.type === 'email' && !email?.verificationRequest) {
          // The password was set before the address was proven, so it goes too, with every trusted device.
          await d.delete(tables.sessions).where(eq(tables.sessions.userId, existing.id))
          await d.delete(tables.trustedDevices).where(eq(tables.trustedDevices.userId, existing.id))
          await d.update(tables.users).set({ passwordHash: null }).where(eq(tables.users.id, existing.id))
        }
        let known: { id: string; status: string } | undefined = existing
        if (!known && account && account.type !== 'email') {
          const [linked] = await d
            .select({ id: tables.users.id, status: tables.users.status })
            .from(tables.authIdentities)
            .innerJoin(tables.users, eq(tables.users.id, tables.authIdentities.userId))
            .where(
              and(
                eq(tables.authIdentities.provider, account.provider),
                eq(tables.authIdentities.providerAccountId, account.providerAccountId),
              ),
            )
          known = linked
        }
        if (known) return known.status !== 'closed'
        // A new OAuth account in the same browser that ticked the boxes on the sign-up page.
        // (Email sign-ups create the account with its consent times when the link is requested.)
        if (account?.type !== 'email' && (await consentTime())) return true
        return '/sign-up?error=consent'
      },
      async session({ session, user }) {
        session.user.id = user.id
        return session
      },
    },
    events: {
      async createUser({ user }) {
        const at = (await consentTime()) ?? new Date()
        const d = db()
        await d.update(tables.users).set({ termsAcceptedAt: at }).where(eq(tables.users.id, user.id!))
        await d.insert(tables.creatorProfiles).values({ userId: user.id! }).onConflictDoNothing()
      },
      // One auth_identities row per way of signing in. OAuth rows are written by the adapter;
      // email sign-ins are recorded here.
      async signIn({ user, account }) {
        if (account?.provider === 'email' && user.id && user.email) {
          await db()
            .insert(tables.authIdentities)
            .values({ userId: user.id, type: 'email', provider: 'email', providerAccountId: user.email.toLowerCase() })
            .onConflictDoNothing()
        }
      },
    },
  }
})
