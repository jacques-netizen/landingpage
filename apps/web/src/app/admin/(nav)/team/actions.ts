'use server'

import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'
import { addTeamMember, removeTeamRole, TeamError } from '@/server/team'

export type TeamState = { error?: string; ok?: string }

export async function addMemberAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const viewer = await requireStaff('admin', '/admin/team')
  const email = String(form.get('email') ?? '')
  try {
    await addTeamMember(viewer.id, email, String(form.get('role') ?? ''))
  } catch (e) {
    if (e instanceof TeamError) return { error: e.message }
    throw e
  }
  revalidatePath('/admin/team')
  return { ok: `Added. ${email.trim()} can sign in at /staff/sign-in now; we emailed them the link.` }
}

export async function removeRoleAction(userId: string, role: string): Promise<TeamState> {
  const viewer = await requireStaff('admin', '/admin/team')
  try {
    await removeTeamRole(viewer.id, userId, role)
  } catch (e) {
    if (e instanceof TeamError) return { error: e.message }
    throw e
  }
  revalidatePath('/admin/team')
  return { ok: 'Removed.' }
}
