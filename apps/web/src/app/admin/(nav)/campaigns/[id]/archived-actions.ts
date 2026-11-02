'use server'

import { revalidatePath } from 'next/cache'
import { addArchivedClip, type ArchivedClipInput, type ArchivedClipResult } from '@/server/archived-clips'
import { requireStaff } from '@/server/guard'

// Add a clip that is no longer online from its video file (owner decision, 2026-11-02). Finance and
// admins, like the CSV import beside it. Audited by addArchivedClip.
export async function addArchivedClipAction(campaignId: string, input: ArchivedClipInput): Promise<ArchivedClipResult> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}?tab=clips`)
  const r = await addArchivedClip(campaignId, viewer.id, input)
  if (r.ok) revalidatePath(`/admin/campaigns/${campaignId}`)
  return r
}
