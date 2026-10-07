'use server'

import { brand, env } from '@mde/config'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { signIn, signOut } from '@/auth'
import { accountExists, createPasswordAccount, findAccount, provenEmail, startSessionFor } from '@/server/accounts'
import { clientIp } from '@/server/client-ip'
import { makeConsentCookie } from '@/server/consent'
import {
  CODE_ATTEMPTS,
  checkSignInCode,
  isTrustedDevice,
  pendingAccount,
  sendSignInCode,
  trustThisDevice,
} from '@/server/devices'
import { escapeHtml, sendEmail } from '@/server/email'
import {
  hashPassword,
  normaliseUsername,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_RULE,
  verifyPassword,
} from '@/server/passwords'
import { rateLimit } from '@/server/rate-limit'

type Fields = { email?: string; terms?: string; username?: string; password?: string; discord?: string }

export type AuthFormState = {
  error?: string
  fields?: Fields
  email?: string
  username?: string
  discord?: string
}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254))

/** Only same-site relative paths, so a crafted link cannot send people elsewhere after sign in. */
function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === 'string' ? value : ''
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') && v !== '/' ? v : '/campaigns'
}

const TOO_MANY = 'Too many attempts. Wait an hour and try again.'
const WRONG = 'That username or email and password do not match.'
const str = (form: FormData, k: string) => String(form.get(k) ?? '')

/**
 * sign-up: username, email, password, optional Discord name and the terms tick; signs straight in.
 * sign-in: username or email and password (a code by email on a new device), or an email link.
 * staff: the email link only.
 */
export async function authAction(
  mode: 'sign-in' | 'sign-up' | 'staff',
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const intent = str(form, 'intent') || 'email'
  const next = safeNext(form.get('next'))
  const rawEmail = str(form, 'email')
  const keep = { email: rawEmail, username: str(form, 'username'), discord: str(form, 'discord') }
  const ip = await clientIp()

  if (!(await rateLimit(`auth:ip:${ip}`, 30, 3600))) return { error: TOO_MANY, ...keep }

  if (mode === 'sign-up') {
    if (form.get('terms') !== 'on')
      return { fields: { terms: 'Tick to agree to the terms of use and the privacy policy.' }, ...keep }
    const consentAt = new Date()
    const c = makeConsentCookie(consentAt)
    ;(await cookies()).set(c.name, c.value, c.options)
    if (intent === 'google' || intent === 'discord') {
      await signIn(intent, { redirectTo: next })
      return {}
    }
    return signUp(form, consentAt, next, keep)
  }

  if (intent === 'google' || intent === 'discord') {
    await signIn(intent, { redirectTo: next })
    return {}
  }
  if (mode === 'sign-in' && intent === 'password') return passwordSignIn(form, next, keep)
  return emailLink(mode, rawEmail, next, keep)
}

async function signUp(
  form: FormData,
  consentAt: Date,
  next: string,
  keep: { email: string; username: string; discord: string },
): Promise<AuthFormState> {
  const fields: Fields = {}
  const username = normaliseUsername(keep.username)
  if (!USERNAME_RULE.test(username)) fields.username = 'Use 3 to 20 lowercase letters, numbers, dots or underscores.'
  const email = emailSchema.safeParse(keep.email)
  if (!email.success) fields.email = 'Enter an email address, like name@example.com.'
  const password = str(form, 'password')
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)
    fields.password = `Use at least ${PASSWORD_MIN} characters.`
  const discord = keep.discord.trim().replace(/^@/, '')
  if (discord.length > 40) fields.discord = 'That Discord username is too long.'
  if (Object.keys(fields).length || !email.success) return { fields, ...keep }
  if (!(await rateLimit(`auth:email:${email.data}`, 5, 3600))) return { error: TOO_MANY, ...keep }

  const created = await createPasswordAccount({
    email: email.data,
    username,
    passwordHash: await hashPassword(password),
    discordUsername: discord || null,
    consentAt,
  })
  if ('taken' in created)
    return created.taken === 'username'
      ? { fields: { username: 'That username is taken. Try another.' }, ...keep }
      : {
          fields: { email: 'There is already an account with this email. Sign in instead.' },
          ...keep,
        }
  // The device that created the account is trusted, so the next password sign in here needs no code.
  await trustThisDevice(created.id)
  await startSessionFor(created.id)
  redirect(next)
}

async function passwordSignIn(
  form: FormData,
  next: string,
  keep: { email: string; username: string; discord: string },
): Promise<AuthFormState> {
  const identifier = keep.email.trim().toLowerCase()
  const password = str(form, 'password')
  if (!identifier) return { fields: { email: 'Enter your username or email.' }, ...keep }
  if (!password) return { fields: { password: 'Enter your password.' }, ...keep }
  if (!(await rateLimit(`auth:password:${identifier}`, 10, 3600))) return { error: TOO_MANY, ...keep }
  const account = await findAccount(identifier)
  const ok = await verifyPassword(password, account?.passwordHash)
  if (!account || !ok || account.status === 'closed') {
    if (account && !account.passwordHash)
      return {
        error: 'This account has no password yet. Use "Email me a sign-in link" below, then set one on your profile.',
        ...keep,
      }
    return { error: WRONG, ...keep }
  }
  if (await isTrustedDevice(account.id)) {
    await startSessionFor(account.id)
    redirect(next)
  }
  await sendSignInCode(account, next)
  redirect('/sign-in/code')
}

async function emailLink(
  mode: 'sign-in' | 'staff',
  rawEmail: string,
  next: string,
  keep: { email: string; username: string; discord: string },
): Promise<AuthFormState> {
  // On the creator sign in a username works here too: the link goes to that account's email.
  let value = rawEmail.trim()
  if (mode === 'sign-in' && value && !value.includes('@')) value = (await findAccount(value))?.email ?? ''
  const parsed = emailSchema.safeParse(value)
  if (!parsed.success)
    return {
      fields: {
        email:
          mode === 'sign-in' && rawEmail.trim() && !rawEmail.includes('@')
            ? 'We could not find that username. Enter your email instead.'
            : 'Enter an email address, like name@example.com.',
      },
      ...keep,
    }
  const email = parsed.data
  if (!(await rateLimit(`auth:email:${email}`, 5, 3600))) return { error: TOO_MANY, ...keep }

  if (!(await accountExists(email))) {
    // Do not reveal whether an address has an account. Tell the owner of the inbox instead.
    const { name } = brand()
    const signUpUrl = `${env().APP_URL}/sign-up`
    await sendEmail({
      to: email,
      subject: `Sign in to ${name}`,
      text: `Someone asked to sign in to ${name} with this address, but there is no account for it yet. To create one, go to ${signUpUrl}\n\nIf this was not you, you can ignore this email.`,
      html: `<p style="font:15px/1.5 Archivo,Arial,sans-serif;color:#1A1510">Someone asked to sign in to ${escapeHtml(name)} with this address, but there is no account for it yet.</p><p><a href="${escapeHtml(signUpUrl)}">Create an account</a></p><p style="font:13px Archivo,Arial,sans-serif;color:#6E675C">If this was not you, you can ignore this email.</p>`,
    })
    redirect('/check-email')
  }

  // Called without a redirect so the person always lands on our check-email page.
  await signIn('email', { email, redirectTo: next, redirect: false })
  redirect('/check-email')
}

export type CodeFormState = { error?: string; sent?: boolean }

/** The 6-digit code from the email, on a device signing in with a password for the first time. */
export async function codeAction(_prev: CodeFormState, form: FormData): Promise<CodeFormState> {
  if (str(form, 'intent') === 'resend') {
    const account = await pendingAccount()
    if (!account) redirect('/sign-in')
    if (!(await rateLimit(`auth:code-send:${account.id}`, 5, 3600))) return { error: TOO_MANY }
    await sendSignInCode(account, account.next)
    return { sent: true }
  }
  const ip = await clientIp()
  if (!(await rateLimit(`auth:code:${ip}`, 30, 3600))) return { error: TOO_MANY }
  const r = await checkSignInCode(str(form, 'code').replace(/\s/g, ''))
  if (!r.ok)
    return {
      error:
        r.reason === 'wrong'
          ? 'That code is not right. Check the email and try again.'
          : r.reason === 'locked'
            ? `Too many wrong codes (${CODE_ATTEMPTS}). Send a new code.`
            : r.reason === 'expired'
              ? 'That code has expired. Send a new code.'
              : 'This sign in has expired. Sign in again.',
    }
  // The code proves the inbox, so the address counts as proven from now on.
  await provenEmail(r.userId)
  await trustThisDevice(r.userId)
  await startSessionFor(r.userId)
  redirect(r.next)
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' })
}
