'use server'

import { db } from '@mde/db'
import { resolveAppeal, ReviewError } from '@mde/review'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type AppealState = { error?: string; ok?: string }

export async function resolveAppealAction(id: string, _prev: AppealState, form: FormData): Promise<AppealState> {
  const viewer = await requireStaff('staff', `/admin/appeals/${id}`)
  const outcome = form.get('outcome') === 'overturned' ? 'overturned' : 'upheld'
  try {
    await resolveAppeal(db(), viewer.id, id, { outcome, reply: String(form.get('reply') ?? '') })
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message }
    throw e
  }
  revalidatePath(`/admin/appeals/${id}`)
  revalidatePath('/admin/appeals')
  return {
    ok:
      outcome === 'overturned'
        ? 'Overturned. The post is restored and its next view check pays it.'
        : 'Upheld. The creator has your reply.',
  }
}
