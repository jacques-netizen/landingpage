'use server'

import { db, tables } from '@mde/db'
import { sendStaffMessage, StaffMessageError } from '@mde/notifications'
import { eq } from 'drizzle-orm'
import { requireStaff } from '@/server/guard'
import type { MessageState } from '../../_components/message-form'

/** One message to everyone who joined this campaign, without a warning or strike (owner, 2026-11-10). */
export async function messageClippersAction(
  campaignId: string,
  _p: MessageState,
  form: FormData,
): Promise<MessageState> {
  const viewer = await requireStaff('staff', `/admin/campaigns/${campaignId}?tab=clippers`)
  const members = await db()
    .select({ id: tables.campaignMembers.creatorId })
    .from(tables.campaignMembers)
    .where(eq(tables.campaignMembers.campaignId, campaignId))
  try {
    const sent = await sendStaffMessage(
      db(),
      viewer.id,
      members.map((m) => m.id),
      { title: String(form.get('title') ?? ''), body: String(form.get('body') ?? ''), campaignId },
    )
    return { ok: `Message sent to ${sent} ${sent === 1 ? 'clipper' : 'clippers'}.`, sent }
  } catch (e) {
    if (e instanceof StaffMessageError) return { error: e.message }
    throw e
  }
}
