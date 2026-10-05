'use server'

import { brand, env } from '@mde/config'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { signIn, signOut } from '@/auth'
import { accountExists, createEmailAccount } from '@/server/accounts'
import { clientIp } from '@/server/client-ip'
import { makeConsentCookie } from '@/server/consent'
import { escapeHtml, sendEmail } from '@/server/email'
import { rateLimit } from '@/server/rate-limit'

export type AuthFormState = {
  error?: string
  fields?: { email?: string; adult?: string; terms?: string }
  email?: string
}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254))

/** Only same-site relative paths, so a crafted link cannot send people elsewhere after sign in. */
function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === 'string' ? value : ''
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/'
}

const TOO_MANY = 'Too many attempts. Wait an hour and try again.'

export async function authAction(
  mode: 'sign-in' | 'sign-up',
  _prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const intent = String(form.get('intent') ?? 'email')
  const next = safeNext(form.get('next'))
  const rawEmail = String(form.get('email') ?? '')
  const ip = await clientIp()

  if (!(await rateLimit(`auth:ip:${ip}`, 30, 3600))) return { error: TOO_MANY, email: rawEmail }

  let consentAt: Date | null = null
  if (mode === 'sign-up') {
    const fields: AuthFormState['fields'] = {}
    if (form.get('adult') !== 'on') fields.adult = 'You must be 18 or older to join.'
    if (form.get('terms') !== 'on') fields.terms = 'Tick to agree to the terms of use and the privacy policy.'
    if (fields.adult || fields.terms) return { fields, email: rawEmail }
    consentAt = new Date()
    const c = makeConsentCookie(consentAt)
    ;(await cookies()).set(c.name, c.value, c.options)
  }

  if (intent === 'google' || intent === 'discord') {
    await signIn(intent, { redirectTo: next })
    return {}
  }

  const parsed = emailSchema.safeParse(rawEmail)
  if (!parsed.success) return { fields: { email: 'Enter an email address, like name@example.com.' }, email: rawEmail }
  const email = parsed.data
  if (!(await rateLimit(`auth:email:${email}`, 5, 3600))) return { error: TOO_MANY, email: rawEmail }

  if (mode === 'sign-up' && consentAt) {
    await createEmailAccount(email, consentAt)
  } else if (!(await accountExists(email))) {
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

export async function signOutAction() {
  await signOut({ redirectTo: '/' })
}
