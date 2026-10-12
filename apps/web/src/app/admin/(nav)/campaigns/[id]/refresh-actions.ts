'use server'

import { db, tables } from '@mde/db'
import { runViewCheck } from '@mde/tracking'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/server/guard'
import { providers } from '@/server/providers'
import { tokenFor } from '@/server/submissions'

export type RefreshResult = {
  posts: number
  checked: number
  unavailable: number
  failed: number
  message: string
}

const UNTRACKED = ['rejected', 'rejected_auto', 'removed']

// "Refresh stats now" (owner request, 2026-10-12): every approved and pending post of the campaign is
// checked at once from the web app, whatever the worker is doing. The same check the worker runs, so
// snapshots, counted views and earnings move exactly as they would on the hour. Audited by its totals.
export async function refreshCampaignStatsAction(campaignId: string): Promise<RefreshResult> {
  await requireStaff('staff', `/admin/campaigns/${campaignId}`)
  const d = db()
  const now = new Date()
  const posts = await d
    .update(tables.submissions)
    .set({ nextCheckAt: now })
    .where(and(eq(tables.submissions.campaignId, campaignId), notInArray(tables.submissions.state, UNTRACKED)))
    .returning({ id: tables.submissions.id })
  const totals = { posts: posts.length, checked: 0, unavailable: 0, failed: 0 }
  const deps = { router: providers(), tokenFor, now }
  let i = 0
  const worker = async () => {
    while (i < posts.length) {
      const id = posts[i++]!.id
      try {
        const r = await runViewCheck(d, id, deps)
        if (!r.ran) continue
        if (r.result === 'provider_unavailable') totals.unavailable++
        else totals.checked++
      } catch (e) {
        totals.failed++
        console.error(
          JSON.stringify({ level: 'error', msg: 'manual view check failed', submissionId: id, err: String(e) }),
        )
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, posts.length) }, worker))
  // Posts still queued at the lease time are left for the worker's next pass.
  await d
    .update(tables.submissions)
    .set({ nextCheckAt: now })
    .where(
      and(
        inArray(
          tables.submissions.id,
          posts.map((p) => p.id),
        ),
        eq(tables.submissions.nextCheckAt, now),
      ),
    )
  revalidatePath(`/admin/campaigns/${campaignId}`)
  const message =
    totals.unavailable === totals.posts && totals.posts > 0
      ? `None of the ${totals.posts} posts could be read: the data provider did not answer. Check DATA_PROVIDER_API_KEY and the provider's credits.`
      : `${totals.checked} of ${totals.posts} posts refreshed${totals.unavailable ? `, ${totals.unavailable} not reachable` : ''}${totals.failed ? `, ${totals.failed} failed` : ''}.`
  return { ...totals, message }
}
