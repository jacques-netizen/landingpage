'use server'

import { db } from '@mde/db'
import {
  AccountError,
  addBioCodeAccount,
  removeAccount,
  renewBioCode,
  verifyBioCode,
  type Platform,
} from '@mde/platforms'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { providers } from '@/server/providers'
import { rateLimit } from '@/server/rate-limit'
import { getViewer } from '@/server/viewer'

export type AccountState = { error?: string; ok?: string; field?: string }

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube', 'x']

async function me() {
  const viewer = await getViewer()
  if (!viewer) redirect('/sign-in?next=/accounts')
  return viewer
}

async function attempt(fn: () => Promise<AccountState | void>): Promise<AccountState> {
  try {
    const r = await fn()
    revalidatePath('/accounts')
    return r ?? {}
  } catch (e) {
    if (e instanceof AccountError) return { error: e.message }
    throw e
  }
}

export async function addAccountAction(_prev: AccountState, form: FormData): Promise<AccountState> {
  const viewer = await me()
  const platform = String(form.get('platform') ?? '') as Platform
  if (!PLATFORMS.includes(platform)) return { error: 'Choose a platform.', field: 'platform' }
  if (!(await rateLimit(`accounts:add:${viewer.id}`, 20, 3600)))
    return { error: 'Too many tries. Wait an hour and try again.' }
  return attempt(async () => {
    await addBioCodeAccount(db(), viewer.id, { platform, handle: String(form.get('handle') ?? '') })
    return { ok: 'added' }
  })
}

export async function verifyAccountAction(id: string, _prev: AccountState): Promise<AccountState> {
  const viewer = await me()
  // 10 verify attempts an hour per account (03_SYSTEMS.md 2.3).
  if (!(await rateLimit(`accounts:verify:${id}`, 10, 3600)))
    return { error: 'Too many tries for this account. Wait an hour and try again.' }
  return attempt(async () => {
    await verifyBioCode(db(), providers(), viewer.id, id)
    return { ok: 'Verified. You can remove the code from your bio now.' }
  })
}

export async function renewCodeAction(id: string): Promise<AccountState> {
  const viewer = await me()
  return attempt(async () => {
    await renewBioCode(db(), viewer.id, id)
  })
}

export async function removeAccountAction(id: string): Promise<AccountState> {
  const viewer = await me()
  return attempt(async () => {
    await removeAccount(db(), viewer.id, id)
  })
}
