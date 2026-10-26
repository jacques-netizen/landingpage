import 'server-only'
import { campaignReport, forClient } from '@mde/campaigns'
import { db, tables } from '@mde/db'
import { eq, inArray, sql } from 'drizzle-orm'
import type { ReportData } from '@/reports/spec'

// A campaign's figures for its client report (owner brief, 2026-10-26), read from the same queries as the
// client's report link and shown the way the client sees them: spend at the campaign's client factor,
// the client's budget when one is set, rejected and removed posts left out. Nothing here is typed by hand.

const REJECTED = ['rejected', 'rejected_auto', 'removed']
/** Platforms whose data gives no shares (owner decision, 2026-10-26: Instagram shares are left out). */
const NO_SHARES = ['instagram']
const one = (n: number) => Math.round(n * 10) / 10

export async function reportData(campaignId: string, now = new Date()): Promise<ReportData | null> {
  const d = db()
  const [c] = await d.select().from(tables.campaigns).where(eq(tables.campaigns.id, campaignId))
  if (!c || c.deletedAt) return null
  const [raw, top, [pages]] = await Promise.all([
    campaignReport(d, campaignId, { mode: 'all', page: 1 }),
    campaignReport(d, campaignId, { mode: 'all', page: 1, status: 'approved', sort: 'views' }),
    d.execute<{ pages: string }>(sql`
      select count(distinct coalesce(linked_account_id::text, creator_id::text)) as pages
      from submissions where campaign_id = ${campaignId}
        and state not in (${sql.join(
          REJECTED.map((s) => sql`${s}`),
          sql`, `,
        )})`),
  ])
  if (!raw || !top) return null
  const r = forClient(raw, c.clientSpendFactor, c.clientBudgetCents)

  const rows = top.submissions.rows.filter((x) => x.status === 'approved').slice(0, 24)
  const followers = rows.length
    ? await d
        .select({ id: tables.submissions.id, followers: tables.linkedAccounts.followers })
        .from(tables.submissions)
        .leftJoin(tables.linkedAccounts, eq(tables.linkedAccounts.id, tables.submissions.linkedAccountId))
        .where(
          inArray(
            tables.submissions.id,
            rows.map((x) => x.id),
          ),
        )
    : []
  const followersOf = new Map(followers.map((f) => [f.id, f.followers ?? null]))

  const t = r.totals
  const withShares = r.platforms.some((p) => !NO_SHARES.includes(p.platform))
  const shares = withShares ? t.shares : null
  const engagementPct = t.views > 0 ? one(((t.likes + t.comments + (shares ?? 0)) / t.views) * 100) : null
  const budgetCents = r.budget.budgetCents
  const cpm = c.rateCentsPer1000 * c.clientSpendFactor
  const viewGoal = budgetCents > 0 && cpm > 0 ? Math.round((budgetCents * 1000) / cpm) : null
  const end = c.status === 'closed' && c.closedAt && c.closedAt < now ? c.closedAt : now
  const start = c.startAt
  return {
    asOf: now.toISOString(),
    campaign: {
      title: c.title,
      startAt: start?.toISOString() ?? null,
      closedAt: c.closedAt?.toISOString() ?? null,
      complete: c.status === 'closed' || c.status === 'cancelled',
      coverUrl: c.coverImageUrl,
      minViewsToEarn: c.minViewsToEarn,
    },
    daysLive: start && start <= end ? Math.floor((end.getTime() - start.getTime()) / 86_400_000) : null,
    totals: { views: t.views, likes: t.likes, comments: t.comments, shares, engagementPct },
    posts: { submitted: r.counts.submitted, approved: r.counts.approved, pending: r.counts.pending },
    pages: Number(pages?.pages ?? 0),
    platforms: r.platforms
      .filter((p) => p.clips > 0)
      .map((p) => ({ platform: p.platform, views: p.views, posts: p.clips })),
    goal: {
      budgetCents,
      spentCents: r.budget.spentCents,
      deliveredPct: budgetCents > 0 ? Math.min(100, one((r.budget.spentCents / budgetCents) * 100)) : null,
      viewGoal,
      viewPct: viewGoal ? one((t.views / viewGoal) * 100) : null,
    },
    clips: rows.map((x) => ({
      id: x.id,
      platform: x.platform,
      postId: x.platformPostId,
      url: x.url,
      handle: x.handle.replace(/^@/, ''),
      views: x.views,
      likes: x.likes,
      comments: x.comments,
      shares: NO_SHARES.includes(x.platform) ? null : x.shares,
      postedAt: x.postedAt ?? x.submittedAt,
      followers: followersOf.get(x.id) ?? null,
    })),
  }
}
