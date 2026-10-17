// The client's campaign report (client report brief, 2026-10-12): read-only figures for one campaign,
// every number aggregated in SQL from submissions, view snapshots and the ledger. Nothing here is
// stored or edited by hand. Amounts are whole cents; views are counts from the latest snapshot per post.
import { tables, type DbOrTx } from '@mde/db'
import { eq, sql } from 'drizzle-orm'

/** Which posts count: every approved post, or only those whose payout has been paid out. */
export type ReportMode = 'all' | 'paid'
export type ReportStatus = 'approved' | 'pending' | 'rejected'
export type ReportSort = 'views' | 'newest' | 'spend'

export type ReportQuery = {
  /** Submitted on or after this UTC day. Unset: from the campaign's first post. */
  from?: Date | null
  /** Submitted on or before this UTC day. Unset: today. */
  to?: Date | null
  mode: ReportMode
  /** The "All submissions" page, from 1, 50 a page. */
  page: number
  platform?: string | null
  status?: ReportStatus | null
  /** Order of the submissions list: most views (default), newest, or most spend. */
  sort?: ReportSort | null
}

export type ReportClip = {
  id: string
  platform: string
  platformPostId: string
  handle: string
  url: string
  /** The post's picture and video file as the platform last gave them; null when it gave none. */
  thumbnail: string | null
  video: string | null
  /** Views since submission, the ones that earn; the campaign's minimum is on the report. */
  countedViews: number
  postedAt: string | null
  submittedAt: string
  status: ReportStatus
  views: number
  likes: number
  comments: number
  shares: number
  /** What the post has earned, and whether that has been paid out. */
  payoutCents: number
  payout: 'paid' | 'pending' | 'none'
  /** The views come from a verification the creator proved, not from the scraper (owner brief, 2026-10-15). */
  verified: boolean
}

export type CampaignReport = {
  campaign: {
    title: string
    startAt: string | null
    status: 'Live' | 'Ended' | 'Not started'
    thumbnail: string | null
    rateCentsPer1000: number
    /** Counted views a post needs before it earns; 0 when there is no minimum. */
    minViewsToEarn: number
  }
  range: { from: string; to: string }
  totals: { views: number; likes: number; comments: number; shares: number; clips: number }
  viewsByDay: { day: string; views: number; clips: number }[]
  budget: {
    budgetCents: number
    spentCents: number
    paidOutCents: number
    holdCents: number
    remainingCents: number
    /** Spend over views, times 1,000, in cents. Null before any view. */
    ecpmCents: number | null
  }
  platforms: { platform: string; views: number; clips: number; spentCents: number; ecpmCents: number | null }[]
  spendByDay: { day: string; spendCents: number; clips: number }[]
  /** Clippers by what their approved posts earned, most first; share is of the campaign's spend in range. */
  accounts: { handle: string; posts: number; spentCents: number; share: number }[]
  /** Posts submitted per day per platform, for the stacked bars. */
  clipsByPlatformDay: { day: string; platform: string; clips: number }[]
  topClips: ReportClip[]
  /** Every post in range, whatever its state: "N submitted, N approved, N pending review". */
  counts: { submitted: number; approved: number; pending: number; rejected: number }
  submissions: { rows: ReportClip[]; total: number; page: number; pageSize: number }
  lastUpdated: string | null
}

export const PAGE_SIZE = 50
const APPROVED = ['approved', 'earning', 'final', 'paid_out']
const PENDING = ['checking', 'needs_review', 'needs_info', 'flagged', 'appealed']
const REJECTED = ['rejected', 'rejected_auto', 'removed']

const list = (xs: readonly string[]) =>
  sql.join(
    xs.map((x) => sql`${x}`),
    sql`, `,
  )
// Raw query rows give dates as strings; the schema gives Date objects.
const day = (d: Date | string) => new Date(d).toISOString().slice(0, 10)
const n = (v: unknown) => Number(v ?? 0)

/** The handle shown for a post: the linked account, else the one in the link, else the creator's username. */
export function handleFor(p: { handle: string | null; url: string; username: string | null }) {
  if (p.handle) return `@${p.handle}`
  const m = p.url.match(/\/@([A-Za-z0-9._-]+)/) ?? p.url.match(/x\.com\/([A-Za-z0-9_]+)\/status/)
  if (m) return `@${m[1]}`
  return p.username ? `@${p.username}` : 'Creator'
}

const statusOf = (state: string): ReportStatus =>
  APPROVED.includes(state) ? 'approved' : REJECTED.includes(state) ? 'rejected' : 'pending'

export async function campaignReport(db: DbOrTx, campaignId: string, q: ReportQuery): Promise<CampaignReport | null> {
  const [c] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, campaignId))
  if (!c || c.deletedAt) return null
  const counted = q.mode === 'paid' ? ['paid_out'] : APPROVED

  // The range in whole UTC days: from the first post (or the campaign's start) to today unless given.
  const [first] = await db.execute<{ first: Date | null; last_snapshot: Date | null }>(sql`
    select min(s.submitted_at) as first,
      (select max(v.taken_at) from view_snapshot_days v join submissions x on x.id = v.submission_id where x.campaign_id = ${campaignId}) as last_snapshot
    from submissions s where s.campaign_id = ${campaignId}`)
  const today = new Date()
  const fromDay = day(q.from ?? first?.first ?? c.startAt ?? c.createdAt)
  // A closed campaign's report ends on the day it closed.
  const toDay = day(q.to ?? (c.status === 'closed' && c.closedAt && c.closedAt < today ? c.closedAt : today))
  const fromTs = `${fromDay}T00:00:00Z`
  const toTs = `${toDay}T23:59:59.999Z`

  const inRange = sql`s.campaign_id = ${campaignId} and s.submitted_at >= ${fromTs}::timestamptz and s.submitted_at <= ${toTs}::timestamptz`
  // Each post with its latest figures (the newest day row).
  const latest = sql`
    select s.id, s.platform, s.platform_post_id, s.post_url, s.published_at, s.submitted_at, s.state, s.earned_cents, s.creator_id,
      s.thumbnail_url, s.video_url, s.counted_views, s.verified_views, s.latest_views, a.handle, u.username,
      coalesce(v.views, 0)::bigint as views, coalesce(v.likes, 0)::bigint as likes,
      coalesce(v.comments, 0)::bigint as comments, coalesce(v.shares, 0)::bigint as shares
    from submissions s
    left join linked_accounts a on a.id = s.linked_account_id
    left join users u on u.id = s.creator_id
    left join lateral (
      select views, likes, comments, shares from view_snapshot_days v
      where v.submission_id = s.id order by v.day desc limit 1
    ) v on true`

  type ClipRow = {
    id: string
    platform: string
    platform_post_id: string
    post_url: string
    thumbnail_url: string | null
    video_url: string | null
    counted_views: string
    verified_views: string
    latest_views: string
    published_at: Date | null
    submitted_at: Date
    state: string
    earned_cents: string
    handle: string | null
    username: string | null
    views: string
    likes: string
    comments: string
    shares: string
  }
  const toClip = (r: ClipRow): ReportClip => ({
    id: r.id,
    platform: r.platform,
    platformPostId: r.platform_post_id,
    thumbnail: r.thumbnail_url,
    video: r.video_url,
    countedViews: n(r.counted_views),
    handle: handleFor({ handle: r.handle, url: r.post_url, username: r.username }),
    url: r.post_url,
    postedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
    submittedAt: new Date(r.submitted_at).toISOString(),
    status: statusOf(r.state),
    views: n(r.views),
    likes: n(r.likes),
    comments: n(r.comments),
    shares: n(r.shares),
    payoutCents: n(r.earned_cents),
    payout: r.state === 'paid_out' ? 'paid' : APPROVED.includes(r.state) && n(r.earned_cents) > 0 ? 'pending' : 'none',
    verified: n(r.verified_views) > 0 && n(r.verified_views) >= n(r.latest_views),
  })

  const order =
    q.sort === 'newest'
      ? sql`submitted_at desc`
      : q.sort === 'spend'
        ? sql`earned_cents desc, views desc, submitted_at desc`
        : sql`views desc, submitted_at desc`
  const [totals, byPlatform, top, series, spend, budget, pageRows, pageCount, counts, accounts, perPlatformDay] =
    await Promise.all([
      db.execute<{ views: string; likes: string; comments: string; shares: string; clips: string }>(sql`
      with l as (${latest} where ${inRange} and s.state in (${list(counted)}))
      select coalesce(sum(views), 0) as views, coalesce(sum(likes), 0) as likes, coalesce(sum(comments), 0) as comments,
        coalesce(sum(shares), 0) as shares, count(*) as clips from l`),
      db.execute<{ platform: string; views: string; clips: string; spent: string }>(sql`
      with l as (${latest} where ${inRange} and s.state in (${list(counted)}))
      select platform, coalesce(sum(views), 0) as views, count(*) as clips, coalesce(sum(earned_cents), 0) as spent
      from l group by platform order by views desc`),
      db.execute<ClipRow>(sql`
      with l as (${latest} where ${inRange} and s.state in (${list(counted)}))
      select * from l order by views desc, submitted_at desc limit 10`),
      // Cumulative views by day: each post's latest figure per day (view_snapshot_days), carried forward, summed.
      db.execute<{ day: string; views: string; clips: string }>(sql`
      with daily as (
        select v.submission_id, v.day, v.views
        from view_snapshot_days v join submissions s on s.id = v.submission_id
        where ${inRange} and s.state in (${list(counted)}) and v.day <= ${toDay}::date
      ), deltas as (
        select day, views - lag(views, 1, 0::bigint) over (partition by submission_id order by day) as delta from daily
      ), per_day as (
        select day, sum(delta) as delta from deltas group by day
      ), days as (
        select d::date as day from generate_series(${fromDay}::date, ${toDay}::date, interval '1 day') d
      ), submitted as (
        select (s.submitted_at at time zone 'UTC')::date as day, count(*) as clips from submissions s
        where ${inRange} group by 1
      )
      select to_char(days.day, 'YYYY-MM-DD') as day,
        coalesce(sum(coalesce(per_day.delta, 0)) over (order by days.day), 0) as views,
        coalesce(submitted.clips, 0) as clips
      from days left join per_day on per_day.day = days.day left join submitted on submitted.day = days.day
      order by days.day`),
      // Spend by day from the ledger: money reserved for posts counts when reserved; returns when returned.
      // A demo campaign's ledger rows were all written the day it was built, so its spend is spread over
      // the days each post gained its views instead (owner request, 2026-10-14).
      db.execute<{ day: string; spend: string; clips: string }>(sql`
      with moves as (${
        c.demo
          ? sql`
        select day, sum(spend)::bigint as spend from (
          select v.day, (v.views - lag(v.views, 1, 0::bigint) over (partition by v.submission_id order by v.day))
            * s.earned_cents / nullif(max(v.views) over (partition by v.submission_id), 0) as spend
          from view_snapshot_days v join submissions s on s.id = v.submission_id
          where s.campaign_id = ${campaignId} and s.state in (${list(APPROVED)})
            and v.day >= ${fromDay}::date and v.day <= ${toDay}::date
        ) x group by day`
          : sql`
        select (t.created_at at time zone 'UTC')::date as day, -sum(e.amount_cents) as spend
        from ledger_transactions t
        join ledger_entries e on e.transaction_id = t.id
        join ledger_accounts a on a.id = e.account_id and a.kind = 'campaign_budget'
        where t.campaign_id = ${campaignId} and t.kind in ('earning_accrued', 'earning_reversed')
          and t.created_at >= ${fromTs}::timestamptz and t.created_at <= ${toTs}::timestamptz
        group by 1`
      }
      ), submitted as (
        select (s.submitted_at at time zone 'UTC')::date as day, count(*) as clips from submissions s
        where ${inRange} group by 1
      )
      select to_char(coalesce(m.day, su.day), 'YYYY-MM-DD') as day, coalesce(m.spend, 0) as spend, coalesce(su.clips, 0) as clips
      from moves m full outer join submitted su on su.day = m.day order by 1`),
      // The budget block is always the whole campaign.
      db.execute<{ spent: string; paid: string; hold: string; views: string }>(sql`
      with l as (${latest} where s.campaign_id = ${campaignId} and s.state in (${list(APPROVED)}))
      select coalesce(sum(earned_cents), 0) as spent,
        coalesce(sum(earned_cents) filter (where state = 'paid_out'), 0) as paid,
        coalesce(sum(earned_cents) filter (where state <> 'paid_out'), 0) as hold,
        coalesce(sum(views), 0) as views from l`),
      db.execute<ClipRow>(sql`
      with l as (${latest} where ${inRange}
        ${q.platform ? sql`and s.platform = ${q.platform}` : sql``}
        ${q.status ? sql`and s.state in (${list(q.status === 'approved' ? APPROVED : q.status === 'pending' ? PENDING : REJECTED)})` : sql``})
      select * from l order by ${order} limit ${PAGE_SIZE} offset ${(Math.max(1, q.page) - 1) * PAGE_SIZE}`),
      db.execute<{ total: string }>(sql`
      select count(*) as total from submissions s where ${inRange}
        ${q.platform ? sql`and s.platform = ${q.platform}` : sql``}
        ${q.status ? sql`and s.state in (${list(q.status === 'approved' ? APPROVED : q.status === 'pending' ? PENDING : REJECTED)})` : sql``}`),
      db.execute<{ submitted: string; approved: string; pending: string; rejected: string }>(sql`
      select count(*) as submitted,
        count(*) filter (where s.state in (${list(APPROVED)})) as approved,
        count(*) filter (where s.state in (${list(PENDING)})) as pending,
        count(*) filter (where s.state in (${list(REJECTED)})) as rejected
      from submissions s where ${inRange}`),
      db.execute<{
        handle: string | null
        post_url: string
        username: string | null
        posts: string
        spent: string
      }>(sql`
      with l as (${latest} where ${inRange} and s.state in (${list(counted)}))
      select max(handle) as handle, max(post_url) as post_url, max(username) as username,
        count(*) as posts, coalesce(sum(earned_cents), 0) as spent
      from l group by creator_id order by spent desc, posts desc limit 10`),
      db.execute<{ day: string; platform: string; clips: string }>(sql`
      select to_char((s.submitted_at at time zone 'UTC')::date, 'YYYY-MM-DD') as day, s.platform, count(*) as clips
      from submissions s where ${inRange} group by 1, 2 order by 1`),
    ])

  const t = totals[0]!
  const b = budget[0]!
  const spentCents = n(b.spent)
  const ecpm = (spent: number, views: number) => (views > 0 ? Math.round((spent * 1000) / views) : null)
  return {
    campaign: {
      title: c.title,
      startAt: c.startAt?.toISOString() ?? null,
      status: ['live', 'closing'].includes(c.status)
        ? 'Live'
        : ['closed', 'cancelled'].includes(c.status)
          ? 'Ended'
          : 'Not started',
      thumbnail: c.coverImageUrl,
      rateCentsPer1000: c.rateCentsPer1000,
      minViewsToEarn: c.minViewsToEarn,
    },
    range: { from: fromDay, to: toDay },
    totals: { views: n(t.views), likes: n(t.likes), comments: n(t.comments), shares: n(t.shares), clips: n(t.clips) },
    viewsByDay: series.map((r) => ({ day: r.day, views: n(r.views), clips: n(r.clips) })),
    budget: {
      budgetCents: c.budgetCents,
      spentCents,
      paidOutCents: n(b.paid),
      holdCents: n(b.hold),
      remainingCents: c.budgetCents - spentCents,
      ecpmCents: ecpm(spentCents, n(b.views)),
    },
    platforms: byPlatform.map((r) => ({
      platform: r.platform,
      views: n(r.views),
      clips: n(r.clips),
      spentCents: n(r.spent),
      ecpmCents: ecpm(n(r.spent), n(r.views)),
    })),
    spendByDay: spend.map((r) => ({ day: r.day, spendCents: n(r.spend), clips: n(r.clips) })),
    accounts: (() => {
      const total = accounts.reduce((sum, a) => sum + n(a.spent), 0)
      return accounts.map((a) => ({
        handle: handleFor({ handle: a.handle, url: a.post_url, username: a.username }),
        posts: n(a.posts),
        spentCents: n(a.spent),
        share: total > 0 ? Math.round((n(a.spent) / total) * 1000) / 10 : 0,
      }))
    })(),
    clipsByPlatformDay: perPlatformDay.map((r) => ({ day: r.day, platform: r.platform, clips: n(r.clips) })),
    topClips: top.map(toClip),
    counts: {
      submitted: n(counts[0]?.submitted),
      approved: n(counts[0]?.approved),
      pending: n(counts[0]?.pending),
      rejected: n(counts[0]?.rejected),
    },
    submissions: {
      rows: pageRows.map(toClip),
      total: n(pageCount[0]?.total),
      page: Math.max(1, q.page),
      pageSize: PAGE_SIZE,
    },
    lastUpdated: first?.last_snapshot ? new Date(first.last_snapshot).toISOString() : null,
  }
}

/** Every submission in range, for the CSV download: the list's rows in the list's order, up to 5,000. */
export async function campaignReportRows(db: DbOrTx, campaignId: string, q: ReportQuery): Promise<ReportClip[]> {
  const all: ReportClip[] = []
  for (let page = 1; page <= 100; page++) {
    const r = await campaignReport(db, campaignId, { ...q, page })
    if (!r) break
    all.push(...r.submissions.rows)
    if (r.submissions.rows.length < PAGE_SIZE) break
  }
  return all
}

/**
 * What the client pays per dollar a clipper earns (owner rule, 2026-10-17): clippers get $1 per 1,000
 * views and the agency keeps $1, so the client's report counts every amount at twice the clippers'
 * earnings, a $2 CPM on a $1 campaign. Staff screens and the ledger keep the clippers' figures.
 */
export const CLIENT_SPEND_FACTOR = 2

const clientClip = (c: ReportClip, f: number): ReportClip => ({ ...c, payoutCents: c.payoutCents * f })

/** The report as the client sees it: every money amount at the client's rate. Views and counts unchanged. */
export function forClient(r: CampaignReport, f = CLIENT_SPEND_FACTOR): CampaignReport {
  const x = (v: number) => v * f
  const xn = (v: number | null) => (v === null ? null : v * f)
  return {
    ...r,
    campaign: { ...r.campaign, rateCentsPer1000: x(r.campaign.rateCentsPer1000) },
    budget: {
      budgetCents: x(r.budget.budgetCents),
      spentCents: x(r.budget.spentCents),
      paidOutCents: x(r.budget.paidOutCents),
      holdCents: x(r.budget.holdCents),
      remainingCents: x(r.budget.remainingCents),
      ecpmCents: xn(r.budget.ecpmCents),
    },
    platforms: r.platforms.map((p) => ({ ...p, spentCents: x(p.spentCents), ecpmCents: xn(p.ecpmCents) })),
    spendByDay: r.spendByDay.map((d) => ({ ...d, spendCents: x(d.spendCents) })),
    accounts: r.accounts.map((a) => ({ ...a, spentCents: x(a.spentCents) })),
    topClips: r.topClips.map((c) => clientClip(c, f)),
    submissions: { ...r.submissions, rows: r.submissions.rows.map((c) => clientClip(c, f)) },
  }
}

/** One clip at the client's rate, for the CSV export. */
export const clipForClient = (c: ReportClip, f = CLIENT_SPEND_FACTOR) => clientClip(c, f)
