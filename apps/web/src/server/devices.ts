import 'server-only'
import { brand, env } from '@mde/config'
import { db, tables } from '@mde/db'
import { and, eq, gt, lt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import crypto from 'node:crypto'
import { escapeHtml, sendEmail } from './email'

// Password sign in on a device we do not know asks for a 6-digit code sent to the account's email
// (owner request, 2026-10-07). A device that passed the code, or created the account, is trusted for
// a year and signs in with the password alone.

const DEVICE_COOKIE = 'mde_device'
const PENDING_COOKIE = 'mde_sign_in_code'
const DEVICE_DAYS = 365
const CODE_MINUTES = 10
export const CODE_ATTEMPTS = 5

const secure = () => env().APP_URL.startsWith('https://')
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('base64url')
const mac = (s: string) => crypto.createHmac('sha256', env().AUTH_SECRET).update(s).digest('base64url')
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

export async function trustThisDevice(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + DEVICE_DAYS * 86_400_000)
  await db()
    .insert(tables.trustedDevices)
    .values({ userId, tokenHash: sha(token), expiresAt: expires })
  ;(await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(),
    path: '/',
    expires,
  })
}

export async function isTrustedDevice(userId: string) {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value
  if (!token) return false
  const [row] = await db()
    .select({ id: tables.trustedDevices.id })
    .from(tables.trustedDevices)
    .where(
      and(
        eq(tables.trustedDevices.tokenHash, sha(token)),
        eq(tables.trustedDevices.userId, userId),
        gt(tables.trustedDevices.expiresAt, new Date()),
      ),
    )
  return !!row
}

/** Emails a new code (replacing any earlier one) and remembers in this browser which sign in it is for. */
export async function sendSignInCode(user: { id: string; email: string }, next: string) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const d = db()
  await d.delete(tables.signInCodes).where(eq(tables.signInCodes.userId, user.id))
  await d.delete(tables.signInCodes).where(lt(tables.signInCodes.expiresAt, new Date()))
  const [row] = await d
    .insert(tables.signInCodes)
    .values({ userId: user.id, codeHash: 'pending', expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) })
    .returning({ id: tables.signInCodes.id })
  await d
    .update(tables.signInCodes)
    .set({ codeHash: mac(`${row!.id}:${code}`) })
    .where(eq(tables.signInCodes.id, row!.id))
  const payload = Buffer.from(JSON.stringify({ id: row!.id, next })).toString('base64url')
  ;(await cookies()).set(PENDING_COOKIE, `${payload}.${mac(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secure(),
    path: '/',
    maxAge: CODE_MINUTES * 60,
  })
  const { name } = brand()
  await sendEmail({
    to: user.email,
    subject: `Your ${name} sign-in code`,
    text: `Your sign-in code is ${code}. It expires in ${CODE_MINUTES} minutes.\n\nSomeone signed in with your password on a new device. If this was not you, change your password on your profile.`,
    html: `<p style="font:15px/1.5 Archivo,Arial,sans-serif;color:#1A1510">Your sign-in code is</p><p style="font:600 28px/1 Archivo,Arial,sans-serif;letter-spacing:6px;color:#1A1510">${code}</p><p style="font:13px/1.5 Archivo,Arial,sans-serif;color:#6E675C">It expires in ${CODE_MINUTES} minutes. Someone signed in with your password on a new device. If this was not you, change your password on your profile at ${escapeHtml(env().APP_URL)}.</p>`,
  })
}

async function pending() {
  const raw = (await cookies()).get(PENDING_COOKIE)?.value
  const [payload, sig] = raw?.split('.') ?? []
  if (!payload || !sig || !same(sig, mac(payload))) return null
  try {
    const v = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { id: string; next: string }
    return typeof v.id === 'string' && typeof v.next === 'string' ? v : null
  } catch {
    return null
  }
}

/** Whether this browser is waiting for a code, and the account's email to show where it went. */
export async function pendingSignIn(): Promise<{ email: string } | null> {
  const p = await pending()
  if (!p) return null
  const [row] = await db()
    .select({ email: tables.users.email, expiresAt: tables.signInCodes.expiresAt })
    .from(tables.signInCodes)
    .innerJoin(tables.users, eq(tables.users.id, tables.signInCodes.userId))
    .where(eq(tables.signInCodes.id, p.id))
  return row && row.expiresAt > new Date() ? { email: row.email } : null
}

export type CodeCheck =
  { ok: true; userId: string; next: string } | { ok: false; reason: 'none' | 'expired' | 'wrong' | 'locked' }

export async function checkSignInCode(code: string): Promise<CodeCheck> {
  const p = await pending()
  if (!p) return { ok: false, reason: 'none' }
  const d = db()
  const [row] = await d.select().from(tables.signInCodes).where(eq(tables.signInCodes.id, p.id))
  if (!row) return { ok: false, reason: 'none' }
  if (row.expiresAt <= new Date()) return { ok: false, reason: 'expired' }
  if (row.attempts >= CODE_ATTEMPTS) return { ok: false, reason: 'locked' }
  if (!/^\d{6}$/.test(code) || !same(mac(`${row.id}:${code}`), row.codeHash)) {
    await d
      .update(tables.signInCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(tables.signInCodes.id, row.id))
    return { ok: false, reason: row.attempts + 1 >= CODE_ATTEMPTS ? 'locked' : 'wrong' }
  }
  await d.delete(tables.signInCodes).where(eq(tables.signInCodes.id, row.id))
  ;(await cookies()).delete(PENDING_COOKIE)
  return { ok: true, userId: row.userId, next: p.next }
}

/** The pending sign in's account, to send a fresh code. */
export async function pendingAccount(): Promise<{ id: string; email: string; next: string } | null> {
  const p = await pending()
  if (!p) return null
  const [row] = await db()
    .select({ id: tables.users.id, email: tables.users.email })
    .from(tables.signInCodes)
    .innerJoin(tables.users, eq(tables.users.id, tables.signInCodes.userId))
    .where(eq(tables.signInCodes.id, p.id))
  return row ? { ...row, next: p.next } : null
}

/** Forget every device and code for an account (its password changed, or its email was just proven). */
export async function forgetDevices(userId: string) {
  await db().delete(tables.trustedDevices).where(eq(tables.trustedDevices.userId, userId))
  await db().delete(tables.signInCodes).where(eq(tables.signInCodes.userId, userId))
}
