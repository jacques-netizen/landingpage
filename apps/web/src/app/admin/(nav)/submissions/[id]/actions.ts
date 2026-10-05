'use server'

import { db } from '@mde/db'
import { approve, clearFlag, reject, requestInfo, ReviewError } from '@mde/review'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type DecisionState = { error?: string; ok?: string }

async function run(id: string, fn: (reviewerId: string) => Promise<unknown>, ok: string): Promise<DecisionState> {
  const viewer = await requireStaff('staff', `/admin/submissions/${id}`)
  try {
    await fn(viewer.id)
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message }
    throw e
  }
  revalidatePath(`/admin/submissions/${id}`)
  return { ok }
}

export async function decideAction(id: string, _prev: DecisionState, form: FormData): Promise<DecisionState> {
  const intent = String(form.get('intent') ?? '')
  const note = String(form.get('note') ?? '')
  const reasonCode = String(form.get('reasonCode') ?? '')
  if (intent === 'approve') return run(id, (r) => approve(db(), r, id, { note }), 'Approved.')
  if (intent === 'info')
    return run(id, (r) => requestInfo(db(), r, id, note), 'Asked the creator for more information.')
  if (intent === 'reject' || intent === 'remove') {
    if (!reasonCode) return { error: 'Choose a reason from the list.' }
    return run(
      id,
      (r) => reject(db(), r, id, { reasonCode, note, outcome: intent }),
      intent === 'remove' ? 'Removed.' : 'Rejected.',
    )
  }
  return { error: 'Choose what to do.' }
}

export async function clearFlagAction(
  id: string,
  flagId: string,
  _prev: DecisionState,
  form: FormData,
): Promise<DecisionState> {
  return run(id, (r) => clearFlag(db(), r, flagId, String(form.get('note') ?? '')), 'Flag cleared.')
}
