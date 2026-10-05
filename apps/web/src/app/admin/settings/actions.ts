'use server'

import { db } from '@mde/db'
import { ReasonCodeError, updateReasonCode } from '@mde/submissions'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type ReasonState = { error?: string; ok?: string }

/** Admin only: reword a reason code. Audited in the service. */
export async function saveReasonCodeAction(code: string, _prev: ReasonState, form: FormData): Promise<ReasonState> {
  const viewer = await requireStaff('admin', '/admin/settings')
  try {
    await updateReasonCode(db(), viewer.id, code, {
      label: String(form.get('label') ?? ''),
      creatorMessage: String(form.get('creatorMessage') ?? ''),
    })
  } catch (e) {
    if (e instanceof ReasonCodeError) return { error: e.message }
    throw e
  }
  revalidatePath('/admin/settings')
  return { ok: 'Saved.' }
}
