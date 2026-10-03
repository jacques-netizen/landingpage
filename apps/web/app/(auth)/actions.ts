'use server'
import { cookies, headers } from 'next/headers'
import { AuthError } from 'next-auth'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '@mde/db'
import { CONSENT_COOKIE, enabledOAuth, signIn, signOut } from '@/auth'
import { getDb } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

export type AuthFormState = {
  status: 'idle' | 'sent' | 'error'
  email?: string
  message?: string
  fieldErrors?: { email?: string; age?: string; terms?: string }
}

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const WINDOW = 15 * 60 * 1000

async function clientKey() {
  const h = await headers()
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'local').trim()
}

async function limited(email: string): Promise<boolean> {
  const ip = await clientKey()
  return (
    !rateLimit(`auth:ip:${ip}`, 20, WINDOW).ok || !rateLimit(`auth:email:${email}`, 5, WINDOW).ok
  )
}

const TOO_MANY = 'Too many attempts. Wait a few minutes and try again.'

type Intent = 'email' | 'google' | 'discord'
function readIntent(fd: FormData): Intent {
  const v = fd.get('intent')
  return v === 'google' || v === 'discord' ? v : 'email'
}

async function sendLink(email: string): Promise<AuthFormState> {
  try {
    await signIn('email', { email, redirect: false, redirectTo: '/account' })
    return { status: 'sent', email }
  } catch (e) {
    if (e instanceof AuthError)
      return { status: 'error', message: 'We could not send the link. Try again in a moment.' }
    throw e
  }
}

export async function signInAction(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const intent = readIntent(fd)
  if (intent !== 'email') {
    if (!enabledOAuth[intent])
      return { status: 'error', message: 'That sign in method is not available.' }
    await signIn(intent, { redirectTo: '/account' })
    return { status: 'idle' }
  }
  const parsed = emailSchema.safeParse(fd.get('email'))
  if (!parsed.success)
    return {
      status: 'error',
      fieldErrors: { email: 'Enter an email address like name@example.com.' },
    }
  const email = parsed.data
  if (await limited(email)) return { status: 'error', message: TOO_MANY }

  // The same answer whether or not the account exists, so the form does not reveal who has one.
  const [row] = await getDb().select().from(users).where(eq(users.email, email)).limit(1)
  if (!row?.isAdultConfirmed || row.status === 'closed') return { status: 'sent', email }
  return sendLink(email)
}

export async function signUpAction(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const intent = readIntent(fd)
  const fieldErrors: NonNullable<AuthFormState['fieldErrors']> = {}
  const parsed = intent === 'email' ? emailSchema.safeParse(fd.get('email')) : null
  if (parsed && !parsed.success) fieldErrors.email = 'Enter an email address like name@example.com.'
  if (fd.get('age') !== 'on') fieldErrors.age = 'You must be 18 or older to sign up.'
  if (fd.get('terms') !== 'on')
    fieldErrors.terms = 'Accept the terms and the privacy policy to continue.'
  if (Object.keys(fieldErrors).length) return { status: 'error', fieldErrors }

  if (intent !== 'email') {
    if (!enabledOAuth[intent])
      return { status: 'error', message: 'That sign up method is not available.' }
    const ip = await clientKey()
    if (!rateLimit(`auth:ip:${ip}`, 20, WINDOW).ok) return { status: 'error', message: TOO_MANY }
    ;(await cookies()).set(CONSENT_COOKIE, 'ok', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 60,
    })
    await signIn(intent, { redirectTo: '/account' })
    return { status: 'idle' }
  }

  const email = parsed!.data!
  if (await limited(email)) return { status: 'error', message: TOO_MANY }
  const now = new Date()
  const db = getDb()
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!row) {
    await db
      .insert(users)
      .values({ email, isAdultConfirmed: true, adultConfirmedAt: now, termsAcceptedAt: now })
  } else if (!row.isAdultConfirmed) {
    await db
      .update(users)
      .set({ isAdultConfirmed: true, adultConfirmedAt: now, termsAcceptedAt: now })
      .where(eq(users.id, row.id))
  }
  return sendLink(email)
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' })
}
