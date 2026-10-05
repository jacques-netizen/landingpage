'use server'

import { CampaignError, joinCampaign } from '@mde/campaigns'
import { db } from '@mde/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { submitPost } from '@mde/submissions'
import { providers } from '@/server/providers'
import { rateLimit } from '@/server/rate-limit'
import { reasonMessages, tokenFor } from '@/server/submissions'
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

export type SubmitCheck = { check: number; label: string; status: 'pass' | 'fail' | 'review'; message?: string }
export type SubmitState = {
  outcome?: 'needs_review' | 'approved' | 'flagged' | 'rejected_auto' | 'not_submitted'
  checks?: SubmitCheck[]
  error?: string
  /** The form values to keep when nothing was stored. */
  values?: { postUrl: string; note: string; linkedAccountId: string }
}

/** Submit a post link. The automatic checks run at once and every result comes back to the form. */
export async function submitAction(campaignId: string, _prev: SubmitState, form: FormData): Promise<SubmitState> {
  const viewer = await getViewer()
  if (!viewer) redirect(`/sign-in?next=/campaigns/${campaignId}`)
  const values = {
    postUrl: String(form.get('postUrl') ?? '').slice(0, 2000),
    note: String(form.get('note') ?? '').slice(0, 1000),
    linkedAccountId: String(form.get('linkedAccountId') ?? ''),
  }
  if (!values.postUrl.trim()) return { error: 'Paste the link to your post.', values }
  if (!values.linkedAccountId) return { error: 'Choose the account you posted from.', values }
  if (!(await rateLimit(`submit:${viewer.id}`, 30, 3600)))
    return { error: 'Too many submissions in an hour. Wait a little and try again.', values }

  const result = await submitPost(
    db(),
    { creatorId: viewer.id, campaignId, ...values },
    { router: providers(), tokenFor },
  )
  const messages = await reasonMessages()
  revalidatePath(`/campaigns/${campaignId}`)
  revalidatePath('/submissions')
  return {
    outcome: result.outcome,
    error: result.message,
    values: result.outcome === 'not_submitted' ? values : undefined,
    checks: result.checks.map((c) => ({
      check: c.check,
      label: c.label,
      status: c.status,
      // The creator sees the staff-worded message for a failure, and any detail the check gave.
      message:
        c.status === 'fail'
          ? [c.reason && c.reason !== 'other' ? messages[c.reason] : null, c.detail].filter(Boolean).join(' ')
          : c.detail,
    })),
  }
}
