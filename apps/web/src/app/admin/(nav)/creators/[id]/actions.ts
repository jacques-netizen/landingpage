'use server'

import { db } from '@mde/db'
import { issueWarning, ReviewError, setStaffNotes, setSuspended } from '@mde/review'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type CreatorFormState = { error?: string; ok?: string }

const done = (id: string, ok: string): CreatorFormState => {
  revalidatePath(`/admin/creators/${id}`)
  return { ok }
}

async function run(fn: () => Promise<CreatorFormState>): Promise<CreatorFormState> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message }
    throw e
  }
}

export async function warnAction(id: string, _p: CreatorFormState, form: FormData): Promise<CreatorFormState> {
  const viewer = await requireStaff('staff', `/admin/creators/${id}`)
  return run(async () => {
    const r = await issueWarning(db(), viewer.id, id, {
      reasonCode: String(form.get('reasonCode') ?? ''),
      note: String(form.get('note') ?? ''),
    })
    return done(
      id,
      r.suggestSuspension
        ? `Warning sent. ${r.strikes} active strikes: consider suspending this creator.`
        : `Warning sent. ${r.strikes} active ${r.strikes === 1 ? 'strike' : 'strikes'}.`,
    )
  })
}

export async function suspendAction(id: string, _p: CreatorFormState, form: FormData): Promise<CreatorFormState> {
  const viewer = await requireStaff('admin', `/admin/creators/${id}`)
  const suspend = form.get('intent') === 'suspend'
  return run(async () => {
    await setSuspended(db(), viewer.id, id, suspend, String(form.get('reason') ?? ''))
    return done(id, suspend ? 'Suspended. They cannot submit posts or withdraw.' : 'Restored.')
  })
}

export async function notesAction(id: string, _p: CreatorFormState, form: FormData): Promise<CreatorFormState> {
  const viewer = await requireStaff('staff', `/admin/creators/${id}`)
  return run(async () => {
    await setStaffNotes(db(), viewer.id, id, String(form.get('notes') ?? ''))
    return done(id, 'Notes saved.')
  })
}
