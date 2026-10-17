'use server'

import { db, tables, writeAudit } from '@mde/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'
import { issueReportLink, revokeReportLinks } from '@/server/report'

export type ReportLinkResult = { ok: true; url?: string; message: string } | { ok: false; error: string }

// The client's report link (client report brief, 2026-10-12): finance and admins create one or revoke
// them all. Both are audited by the server module.
export async function createReportLinkAction(campaignId: string): Promise<ReportLinkResult> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}`)
  const url = await issueReportLink(campaignId, viewer.id)
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return { ok: true, url, message: 'Report link created and copied. Anyone with it can read the report.' }
}

export async function revokeReportLinksAction(campaignId: string): Promise<ReportLinkResult> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}`)
  await revokeReportLinks(campaignId, viewer.id)
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return {
    ok: true,
    message: 'Every report link for this campaign has stopped working. Create a new one to share again.',
  }
}

/**
 * Whether the client report counts spend at twice the clippers' earnings (owner rule, 2026-10-17:
 * clippers $1 and the agency $1 per 1,000 views). Finance and admins only; audited.
 */
export async function setClientSpendFactorAction(campaignId: string, doubled: boolean): Promise<ReportLinkResult> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}`)
  const factor = doubled ? 2 : 1
  const d = db()
  const [before] = await d
    .select({ f: tables.campaigns.clientSpendFactor })
    .from(tables.campaigns)
    .where(eq(tables.campaigns.id, campaignId))
  if (!before) return { ok: false, error: 'This campaign was not found.' }
  await d.transaction(async (tx) => {
    await tx.update(tables.campaigns).set({ clientSpendFactor: factor }).where(eq(tables.campaigns.id, campaignId))
    await writeAudit(tx, {
      actorId: viewer.id,
      action: 'campaign.client_spend_factor',
      entity: 'campaign',
      entityId: campaignId,
      before: { clientSpendFactor: before.f },
      after: { clientSpendFactor: factor },
    })
  })
  revalidatePath(`/admin/campaigns/${campaignId}`)
  return {
    ok: true,
    message: doubled
      ? 'The client report now shows spend at twice what clippers earn. It can take a minute to update.'
      : 'The client report now shows spend at what clippers earn. It can take a minute to update.',
  }
}
