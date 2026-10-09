'use server'

import { db } from '@mde/db'
import { approve, deleteSubmission, reject, ReviewError, setPending } from '@mde/review'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type RowResult = { ok: true } | { ok: false; error: string }

// The per-post actions on a campaign's Submissions tab (testing report, 2026-10-08). Approve, deny and
// set to pending are review decisions, open to every staff role like the review queue; deleting a post
// is for admins. Each goes through the review service, which moves the money and writes the audit log.
async function run(campaignId: string, access: 'staff' | 'admin', fn: (staffId: string) => Promise<unknown>) {
  const viewer = await requireStaff(access, `/admin/campaigns/${campaignId}`)
  try {
    await fn(viewer.id)
  } catch (e) {
    if (e instanceof ReviewError) return { ok: false, error: e.message } satisfies RowResult
    throw e
  }
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return { ok: true } satisfies RowResult
}

export async function approvePostAction(campaignId: string, id: string, note: string): Promise<RowResult> {
  return run(campaignId, 'staff', (staffId) => approve(db(), staffId, id, { note }))
}

export async function denyPostAction(
  campaignId: string,
  id: string,
  reasonCode: string,
  note: string,
): Promise<RowResult> {
  return run(campaignId, 'staff', (staffId) => reject(db(), staffId, id, { reasonCode, note }))
}

export async function pendingPostAction(campaignId: string, id: string): Promise<RowResult> {
  return run(campaignId, 'staff', (staffId) => setPending(db(), staffId, id))
}

export async function deletePostAction(campaignId: string, id: string): Promise<RowResult> {
  return run(campaignId, 'admin', (staffId) => deleteSubmission(db(), staffId, id))
}
