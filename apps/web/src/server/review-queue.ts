import 'server-only'
import { db, tables } from '@mde/db'
import type { CheckResult } from '@mde/submissions/checks'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { ReviewItem } from '@/designed/review-view'

const FLAG_LABEL: Record<string, string> = {
  view_jump: 'View jump',
  engagement_below_floor: 'Engagement below the floor',
  duplicate_media: 'Same clip posted before',
  wrong_author: 'Posted from another account',
  follower_drop: 'Follower drop',
}

/**
 * Posts waiting for a reviewer: flagged posts first, then oldest first (01_PRODUCT.md 8.4). Optional
 * filters by campaign, platform or flagged only, read from the page's address.
 */
export async function reviewQueue(
  f: { campaignId?: string; platform?: string; flaggedOnly?: boolean } = {},
): Promise<ReviewItem[]> {
  const d = db()
  const rows = await d
    .select({
      id: tables.submissions.id,
      state: tables.submissions.state,
      platform: tables.submissions.platform,
      postUrl: tables.submissions.postUrl,
      submittedAt: tables.submissions.submittedAt,
      checks: tables.submissions.checkResults,
      campaignTitle: tables.campaigns.title,
      email: tables.users.email,
      name: tables.users.name,
    })
    .from(tables.submissions)
    .innerJoin(tables.campaigns, eq(tables.campaigns.id, tables.submissions.campaignId))
    .innerJoin(tables.users, eq(tables.users.id, tables.submissions.creatorId))
    .where(
      and(
        inArray(tables.submissions.state, f.flaggedOnly ? ['flagged'] : ['needs_review', 'flagged']),
        f.campaignId ? eq(tables.submissions.campaignId, f.campaignId) : undefined,
        f.platform ? eq(tables.submissions.platform, f.platform) : undefined,
      ),
    )
    .orderBy(
      sql`case when ${tables.submissions.state} = 'flagged' then 0 else 1 end`,
      asc(tables.submissions.submittedAt),
    )
    .limit(200)
  const ids = rows.map((r) => r.id)
  const flags = ids.length
    ? await d
        .select({ submissionId: tables.fraudFlags.submissionId, kind: tables.fraudFlags.kind })
        .from(tables.fraudFlags)
        .where(and(inArray(tables.fraudFlags.submissionId, ids), eq(tables.fraudFlags.status, 'open')))
    : []
  return rows.map((r) => {
    const own = flags.filter((x) => x.submissionId === r.id)
    const checks = ((r.checks ?? []) as CheckResult[]).map((c) => ({ label: c.label, status: c.status }))
    // Open flags show as checks to review, after the automatic checks.
    for (const fl of own)
      if (!checks.some((c) => c.label === FLAG_LABEL[fl.kind]))
        checks.push({ label: FLAG_LABEL[fl.kind] ?? fl.kind, status: 'review' })
    return {
      id: r.id,
      who: r.name ?? r.email,
      platform: r.platform,
      campaignTitle: r.campaignTitle,
      flagged: r.state === 'flagged',
      submittedAt: r.submittedAt.toISOString(),
      postUrl: r.postUrl,
      checks,
    }
  })
}
