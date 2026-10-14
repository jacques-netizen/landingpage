'use server'

import { db } from '@mde/db'
import { decideViewProof, ReviewError } from '@mde/review'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type ProofDecisionState = { error?: string; ok?: string }

async function run(fn: (reviewerId: string) => Promise<string>): Promise<ProofDecisionState> {
  const viewer = await requireStaff('staff', '/admin/review/proofs')
  try {
    const ok = await fn(viewer.id)
    revalidatePath('/admin/review/proofs')
    return { ok }
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message }
    throw e
  }
}

/** Approve with the views the recording shows. Money moves through the engine from there. */
export async function approveProofAction(id: string, _prev: ProofDecisionState, form: FormData) {
  const views = Number(String(form.get('views') ?? '').replace(/[^0-9]/g, ''))
  const note = String(form.get('note') ?? '')
  return run(async (reviewerId) => {
    const r = await decideViewProof(db(), reviewerId, id, { outcome: 'approve', views, note })
    return `Views set to ${views.toLocaleString('en-US')}.${r.deltaCents ? ` Earnings moved by ${(r.deltaCents / 100).toFixed(2)} USD.` : ''}`
  })
}

export async function rejectProofAction(id: string, _prev: ProofDecisionState, form: FormData) {
  const note = String(form.get('note') ?? '')
  return run(async (reviewerId) => {
    await decideViewProof(db(), reviewerId, id, { outcome: 'reject', note })
    return 'Proof rejected. The creator has been told.'
  })
}
