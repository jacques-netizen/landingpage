'use server'

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
