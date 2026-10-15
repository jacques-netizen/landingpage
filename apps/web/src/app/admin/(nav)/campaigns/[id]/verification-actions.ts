'use server'

import { db } from '@mde/db'
import { decideViewProof, ReviewError } from '@mde/review'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type DecisionResult = { ok: true; message: string } | { ok: false; error: string }

// The Verifications tab of a campaign (owner brief, 2026-10-15): approve at the claimed count, at a
// different one, or reject with a reason. The review service moves the views and the money and
// writes the audit log.
async function run(campaignId: string, fn: (reviewerId: string) => Promise<string>): Promise<DecisionResult> {
  const viewer = await requireStaff('staff', `/admin/campaigns/${campaignId}`)
  try {
    const message = await fn(viewer.id)
    revalidatePath(`/admin/campaigns/${campaignId}`)
    revalidatePath('/admin')
    return { ok: true, message }
  } catch (e) {
    if (e instanceof ReviewError) return { ok: false, error: e.message }
    throw e
  }
}

export async function approveVerificationAction(
  campaignId: string,
  id: string,
  views: number,
  note: string,
): Promise<DecisionResult> {
  return run(campaignId, async (reviewerId) => {
    const r = await decideViewProof(db(), reviewerId, id, { outcome: 'approve', views, note })
    return `${views.toLocaleString('en-US')} views verified.${
      r.deltaCents ? ` Earnings moved by ${(r.deltaCents / 100).toFixed(2)} USD.` : ''
    }`
  })
}

export async function rejectVerificationAction(campaignId: string, id: string, note: string): Promise<DecisionResult> {
  return run(campaignId, async (reviewerId) => {
    const r = await decideViewProof(db(), reviewerId, id, { outcome: 'reject', note })
    return r.blocked
      ? 'Verification rejected. That was the third in this campaign: the clipper is now blocked here.'
      : 'Verification rejected. The clipper has been told.'
  })
}
