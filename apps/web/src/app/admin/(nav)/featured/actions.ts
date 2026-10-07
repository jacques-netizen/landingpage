'use server'

import { listPublicCampaigns } from '@mde/campaigns'
import { db, getContentOverrides, updateContentOverrides } from '@mde/db'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'

export type FeaturedState = { ok?: string; error?: string }

const KEYS = ['featured.campaign', 'featured.title', 'featured.body', 'featured.tags', 'featured.image'] as const

// Chooses the campaign at the top of the campaigns screen and, optionally, its words there. Saved
// into the screen's content settings (audited); the layout stays as designed.
export async function saveFeaturedAction(_prev: FeaturedState, form: FormData): Promise<FeaturedState> {
  const viewer = await requireStaff('admin', '/admin/featured')
  const campaignId = String(form.get('campaign') ?? '')
  const title = String(form.get('title') ?? '').trim()
  const body = String(form.get('body') ?? '').trim()
  const tags = String(form.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const image = String(form.get('image') ?? '').trim()
  if (image && !/^\/files\/[0-9a-f-]{36}\//.test(image)) return { error: 'Upload the picture again.' }
  if (title.length > 80) return { error: 'Keep the headline under 80 characters.' }
  if (body.length > 220) return { error: 'Keep the text under 220 characters.' }
  if (tags.length > 2 || tags.some((t) => t.length > 20)) return { error: 'Use at most two short tags.' }
  if (campaignId) {
    const live = await listPublicCampaigns(db())
    if (!live.some((x) => x.campaign.id === campaignId && x.campaign.status === 'live'))
      return { error: 'Choose a live public campaign.' }
  }
  const current = await getContentOverrides(db(), 'browse')
  const next: Record<string, string> = { ...current }
  for (const k of KEYS) delete next[k]
  if (image) next['featured.image'] = image
  if (campaignId) {
    next['featured.campaign'] = campaignId
    if (title) next['featured.title'] = title
    if (body) next['featured.body'] = body
    if (tags.length) next['featured.tags'] = tags.join(',')
  }
  await updateContentOverrides(db(), viewer.id, 'browse', next)
  revalidatePath('/campaigns')
  return { ok: 'Saved. The campaigns screen shows it now.' }
}
