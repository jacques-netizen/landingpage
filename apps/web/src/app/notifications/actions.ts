'use server'

import { db } from '@mde/db'
import { setPreferences, verifyPreferencesToken } from '@mde/notifications'
import { isId } from '@/server/input'
import { limitVisitor, rateLimit } from '@/server/rate-limit'
import { getViewer } from '@/server/viewer'
import type { PrefsState } from './prefs-form'

const read = (form: FormData) => ({
  email: form.get('email') === 'on',
  newCampaigns: form.get('newCampaigns') === 'on',
})

export async function savePreferencesAction(_prev: PrefsState, form: FormData): Promise<PrefsState> {
  const viewer = await getViewer()
  if (!viewer) return { error: 'Sign in again to change your preferences.' }
  if (!(await rateLimit(`prefs:${viewer.id}`, 30, 3600))) return { error: 'Too many changes. Please wait a while.' }
  await setPreferences(db(), viewer.id, read(form))
  return { ok: 'Saved.' }
}

/** From the link in an email: no sign in, the signed token stands in for it. */
export async function saveLinkedPreferencesAction(
  userId: string,
  token: string,
  _prev: PrefsState,
  form: FormData,
): Promise<PrefsState> {
  if (await limitVisitor('prefs-link', 30, 3600)) return { error: 'Too many changes. Please wait a while.' }
  if (!isId(userId) || typeof token !== 'string' || !verifyPreferencesToken(userId, token))
    return { error: 'This link is not valid. Sign in to change preferences.' }
  await setPreferences(db(), userId, read(form))
  return { ok: 'Saved.' }
}
