'use server'

import { db, tables } from '@mde/db'
import { and, eq, ne, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { forgetDevices, trustThisDevice } from '@/server/devices'
import {
  hashPassword,
  normaliseUsername,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_RULE,
  verifyPassword,
} from '@/server/passwords'
import { rateLimit } from '@/server/rate-limit'
import { getViewer } from '@/server/viewer'

export type ProfileState = {
  ok?: string
  error?: string
  fields?: { username?: string; discord?: string; current?: string; password?: string }
}

export async function saveProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const viewer = await getViewer()
  if (!viewer) return { error: 'Sign in again to continue.' }
  const username = normaliseUsername(String(form.get('username') ?? ''))
  const discord = String(form.get('discord') ?? '')
    .trim()
    .replace(/^@/, '')
  if (!USERNAME_RULE.test(username))
    return { fields: { username: 'Use 3 to 20 lowercase letters, numbers, dots or underscores.' } }
  if (discord.length > 40) return { fields: { discord: 'That Discord username is too long.' } }
  const d = db()
  const [taken] = await d
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(and(sql`username = ${username}`, ne(tables.users.id, viewer.id)))
  if (taken) return { fields: { username: 'That username is taken. Try another.' } }
  await d
    .update(tables.users)
    .set({ username, discordUsername: discord || null, updatedAt: new Date() })
    .where(eq(tables.users.id, viewer.id))
  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { ok: 'Profile saved.' }
}

export async function changePasswordAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const viewer = await getViewer()
  if (!viewer) return { error: 'Sign in again to continue.' }
  if (!(await rateLimit(`password-change:${viewer.id}`, 10, 3600)))
    return { error: 'Too many attempts. Wait an hour and try again.' }
  const [u] = await db()
    .select({ hash: tables.users.passwordHash })
    .from(tables.users)
    .where(eq(tables.users.id, viewer.id))
  const current = String(form.get('current') ?? '')
  const password = String(form.get('password') ?? '')
  if (u?.hash && !(await verifyPassword(current, u.hash)))
    return { fields: { current: 'That is not your current password.' } }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)
    return { fields: { password: `Use at least ${PASSWORD_MIN} characters.` } }
  await db()
    .update(tables.users)
    .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
    .where(eq(tables.users.id, viewer.id))
  // Other devices must prove the email again; this one stays trusted.
  await forgetDevices(viewer.id)
  await trustThisDevice(viewer.id)
  return { ok: u?.hash ? 'Password changed.' : 'Password set. You can now sign in with your username.' }
}
