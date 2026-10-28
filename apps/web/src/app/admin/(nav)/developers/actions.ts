'use server'

import { db } from '@mde/db'
import { createPartnerKey, revokePartnerKey } from '@mde/partners'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

// Partner API keys (owner decision, 2026-10-28): admins make one for a partner they approve, shown once,
// and revoke it. Both are audited by @mde/partners.

export type KeyResult = { ok: true; key: string; partner: string } | { ok: false; error: string }

export async function createKeyAction(input: {
  partner: string
  mode: 'live' | 'sandbox'
  clientIds: string[]
}): Promise<KeyResult> {
  const viewer = await requireStaff('admin', '/admin/developers')
  const partner = String(input.partner ?? '').trim()
  if (!partner) return { ok: false, error: 'Give the partner a name.' }
  const ids = Array.isArray(input.clientIds) ? input.clientIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)) : []
  const { key } = await createPartnerKey(db(), viewer.id, {
    partner,
    mode: input.mode === 'sandbox' ? 'sandbox' : 'live',
    clientIds: ids.length ? ids : null,
  })
  revalidatePath('/admin/developers')
  return { ok: true, key, partner }
}

export async function revokeKeyAction(id: string): Promise<{ ok: boolean }> {
  const viewer = await requireStaff('admin', '/admin/developers')
  const ok = await revokePartnerKey(db(), viewer.id, String(id))
  revalidatePath('/admin/developers')
  return { ok }
}
