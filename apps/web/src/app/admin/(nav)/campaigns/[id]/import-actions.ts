'use server'

import { revalidatePath } from 'next/cache'
import { importSubmissionsCsv, type ImportResult } from '@/server/csv-import'
import { requireStaff } from '@/server/guard'

// Add posts to a campaign from a CSV (owner request, 2026-10-30). Finance and admins, as approving on
// import moves money. Audited by the import.
export async function importCsvAction(campaignId: string, text: string): Promise<ImportResult> {
  const viewer = await requireStaff('money', `/admin/campaigns/${campaignId}?tab=clips`)
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Choose a CSV file first.' }
  if (text.length > 2_000_000) return { ok: false, error: 'The file is too big: keep it under 2 MB.' }
  const r = await importSubmissionsCsv(campaignId, viewer.id, text)
  if (r.ok) revalidatePath(`/admin/campaigns/${campaignId}`)
  return r
}
