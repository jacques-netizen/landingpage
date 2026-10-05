'use server'

import { CampaignError, joinCampaign } from '@mde/campaigns'
import { db } from '@mde/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { rateLimit } from '@/server/rate-limit'
import { getViewer } from '@/server/viewer'

export type JoinState = { error?: string }

/** Join a campaign. Private campaigns need the access code; guesses are rate limited. */
export async function joinAction(campaignId: string, _prev: JoinState, form: FormData): Promise<JoinState> {
  const viewer = await getViewer()
  if (!viewer) redirect(`/sign-in?next=/campaigns/${campaignId}`)
  const code = String(form.get('accessCode') ?? '')
  if (code && !(await rateLimit(`join-code:${viewer.id}`, 10, 3600)))
    return { error: 'Too many tries. Wait an hour and try again.' }
  try {
    await joinCampaign(db(), viewer.id, campaignId, code || undefined)
  } catch (e) {
    if (e instanceof CampaignError) return { error: e.message }
    throw e
  }
  revalidatePath(`/campaigns/${campaignId}`)
  return {}
}
