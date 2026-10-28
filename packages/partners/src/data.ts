import type { DbOrTx } from '@mde/db'
import { sql, type SQL } from 'drizzle-orm'
import type { PartnerKey } from './keys'

// What the partner API shows (owner decision, 2026-10-28): campaigns that have gone live, their posts'
// public stats and the published client reports. Never clippers' personal details, never money amounts:
// only the share of the budget delivered. Rejected and removed posts never appear, as on the client report.
// A live key sees live campaigns; a sandbox key sees the demo campaigns.

const APPROVED = ['approved', 'earning', 'final', 'paid_out']
const IN_REVIEW = ['checking', 'needs_review', 'needs_info', 'flagged', 'appealed']
const SHOWN_CAMPAIGN = ['live', 'closing', 'closed', 'cancelled']
/** Platforms whose data gives no shares: shown as null (owner decision, 2026-10-26). */
const NO_SHARES = ['instagram']

const list = (xs: readonly string[]) =>
  sql.join(
    xs.map((x) => sql`${x}`),
    sql`, `,
  )
const n = (v: unknown) => Number(v ?? 0)
const iso = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString() : null)

export type ApiCampaign = {
  id: string
  object: 'campaign'
  title: string
  status: 'live' | 'ended'
  platforms: string[]
  cover_url: string | null
  client_id: string | null
  starts_at: string | null
  ends_at: string | null
  ended_at: string | null
  stats: {
    views: number
    likes: number
    comments: number
    shares: number | null
    engagement_rate: number | null
    clips_approved: number
    clips_in_review: number
    pages: number
    budget_delivered_percent: number | null
  }
  updated_at: string | null
}

export type ApiClip = {
  id: string
  object: 'clip'
  campaign_id: string
  platform: string
  url: string
  post_id: string
  page: { handle: string | null; followers: number | null }
  status: 'approved' | 'in_review'
  posted_at: string | null
  submitted_at: string
  stats: { views: number; likes: number; comments: number; shares: number | null }
  updated_at: string | null
}

/** The campaigns a key may see, as a condition on `c` (campaigns). */
export function scope(key: PartnerKey): SQL {
  const clients = key.clientIds?.length
    ? sql`and c.client_id in (${sql.join(
        key.clientIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`
    : sql``
  return sql`c.deleted_at is null and c.status in (${list(SHOWN_CAMPAIGN)}) and c.demo = ${key.mode === 'sandbox'} ${clients}`
}

/** A picture's full address; kept as it is when it cannot be made absolute (no base given). */
function absolute(url: string | null, base: string) {
  if (!url) return null
  try {
    return new URL(url, base || undefined).toString()
  } catch {
    return url
  }
}

type CampaignRow = {
  id: string
  title: string
  status: string
  platforms: string[]
  cover_image_url: string | null
  client_id: string | null
  start_at: Date | null
  end_at: Date | null
  closed_at: Date | null
  created_at: Date
  budget_cents: string
  client_budget_cents: string | null
  client_spend_factor: number
  views: string
  likes: string
  comments: string
  shares: string
  approved: string
  in_review: string
  pages: string
  spent: string
  updated: Date | null
}

function toCampaign(r: CampaignRow, base: string): ApiCampaign {
  const views = n(r.views)
  const shares = r.platforms.some((p) => !NO_SHARES.includes(p)) ? n(r.shares) : null
  const budget = r.client_budget_cents !== null ? n(r.client_budget_cents) : n(r.budget_cents)
  const spent = n(r.spent) * r.client_spend_factor
  return {
    id: r.id,
    object: 'campaign',
    title: r.title,
    status: ['live', 'closing'].includes(r.status) ? 'live' : 'ended',
    platforms: r.platforms,
    cover_url: absolute(r.cover_image_url, base),
    client_id: r.client_id,
    starts_at: iso(r.start_at),
    ends_at: iso(r.end_at),
    ended_at: ['closed', 'cancelled'].includes(r.status) ? iso(r.closed_at) : null,
    stats: {
      views,
      likes: n(r.likes),
      comments: n(r.comments),
      shares,
      engagement_rate:
        views > 0 ? Math.round(((n(r.likes) + n(r.comments) + (shares ?? 0)) / views) * 1000) / 10 : null,
      clips_approved: n(r.approved),
      clips_in_review: n(r.in_review),
      pages: n(r.pages),
      budget_delivered_percent: budget > 0 ? Math.min(100, Math.round((spent / budget) * 1000) / 10) : null,
    },
    updated_at: iso(r.updated),
  }
}

// Each post's newest figures: the newest day row, as the client report reads them.
const latest = sql`left join lateral (
    select views, likes, comments, shares, taken_at from view_snapshot_days v
    where v.submission_id = s.id order by v.day desc limit 1
  ) v on true`

async function campaigns(db: DbOrTx, key: PartnerKey, where: SQL, limit: number): Promise<CampaignRow[]> {
  return db.execute<CampaignRow>(sql`
    select c.id, c.title, c.status, c.platforms, c.cover_image_url, c.client_id, c.start_at, c.end_at, c.closed_at,
      c.created_at, c.budget_cents, c.client_budget_cents, c.client_spend_factor,
      coalesce(sum(v.views) filter (where s.state in (${list(APPROVED)})), 0) as views,
      coalesce(sum(v.likes) filter (where s.state in (${list(APPROVED)})), 0) as likes,
      coalesce(sum(v.comments) filter (where s.state in (${list(APPROVED)})), 0) as comments,
      coalesce(sum(v.shares) filter (where s.state in (${list(APPROVED)}) and s.platform not in (${list(NO_SHARES)})), 0) as shares,
      count(s.id) filter (where s.state in (${list(APPROVED)})) as approved,
      count(s.id) filter (where s.state in (${list(IN_REVIEW)})) as in_review,
      count(distinct coalesce(s.linked_account_id::text, s.creator_id::text))
        filter (where s.state in (${list([...APPROVED, ...IN_REVIEW])})) as pages,
      coalesce(sum(s.earned_cents) filter (where s.state in (${list(APPROVED)})), 0) as spent,
      max(v.taken_at) as updated
    from campaigns c
    left join submissions s on s.campaign_id = c.id
    ${latest}
    where ${scope(key)} and ${where}
    group by c.id
    order by c.created_at desc, c.id desc
    limit ${limit}`)
}

/** A cursor is the last item's sort keys, so pages stay stable while new items arrive. */
export const encodeCursor = (at: Date | string, id: string) =>
  Buffer.from(`${new Date(at).toISOString()}|${id}`).toString('base64url')
export function decodeCursor(c: string | null): { at: string; id: string } | null {
  if (!c) return null
  const [at, id] = Buffer.from(c, 'base64url').toString().split('|')
  if (!at || !id || Number.isNaN(Date.parse(at)) || !/^[0-9a-f-]{36}$/i.test(id)) return null
  return { at, id }
}

export type Page<T> = { object: 'list'; data: T[]; has_more: boolean; next_cursor: string | null }

export async function listCampaigns(
  db: DbOrTx,
  key: PartnerKey,
  base: string,
  q: { limit: number; cursor: string | null; status: 'live' | 'ended' | null },
): Promise<Page<ApiCampaign>> {
  const after = decodeCursor(q.cursor)
  const status =
    q.status === 'live'
      ? sql`c.status in ('live', 'closing')`
      : q.status === 'ended'
        ? sql`c.status in ('closed', 'cancelled')`
        : sql`true`
  const page = after ? sql`(c.created_at, c.id) < (${after.at}::timestamptz, ${after.id}::uuid)` : sql`true`
  const rows = await campaigns(db, key, sql`${status} and ${page}`, q.limit + 1)
  const more = rows.length > q.limit
  const shown = rows.slice(0, q.limit)
  const last = shown.at(-1)
  return {
    object: 'list',
    data: shown.map((r) => toCampaign(r, base)),
    has_more: more,
    next_cursor: more && last ? encodeCursor(last.created_at, last.id) : null,
  }
}

export async function getCampaign(db: DbOrTx, key: PartnerKey, base: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [r] = await campaigns(db, key, sql`c.id = ${id}::uuid`, 1)
  return r ? toCampaign(r, base) : null
}

type ClipRow = {
  id: string
  campaign_id: string
  platform: string
  post_url: string
  platform_post_id: string
  handle: string | null
  followers: number | null
  state: string
  published_at: Date | null
  submitted_at: Date
  views: string | null
  likes: string | null
  comments: string | null
  shares: string | null
  taken_at: Date | null
}

/** The page's handle from the post's address, when the post has no linked account. */
const handleFromUrl = (url: string) =>
  url.match(/\/@([A-Za-z0-9._-]+)/)?.[1] ?? url.match(/x\.com\/([A-Za-z0-9_]+)\/status/)?.[1] ?? null

const toClip = (r: ClipRow): ApiClip => ({
  id: r.id,
  object: 'clip',
  campaign_id: r.campaign_id,
  platform: r.platform,
  url: r.post_url,
  post_id: r.platform_post_id,
  page: { handle: r.handle ?? handleFromUrl(r.post_url), followers: r.followers === null ? null : n(r.followers) },
  status: APPROVED.includes(r.state) ? 'approved' : 'in_review',
  posted_at: iso(r.published_at),
  submitted_at: iso(r.submitted_at)!,
  stats: {
    views: n(r.views),
    likes: n(r.likes),
    comments: n(r.comments),
    shares: NO_SHARES.includes(r.platform) ? null : n(r.shares),
  },
  updated_at: iso(r.taken_at),
})

async function clips(db: DbOrTx, key: PartnerKey, where: SQL, limit: number): Promise<ClipRow[]> {
  return db.execute<ClipRow>(sql`
    select s.id, s.campaign_id, s.platform, s.post_url, s.platform_post_id, a.handle, a.followers, s.state,
      s.published_at, s.submitted_at, v.views, v.likes, v.comments, v.shares, v.taken_at
    from submissions s
    join campaigns c on c.id = s.campaign_id
    left join linked_accounts a on a.id = s.linked_account_id
    ${latest}
    where ${scope(key)} and s.state in (${list([...APPROVED, ...IN_REVIEW])}) and ${where}
    order by s.submitted_at desc, s.id desc
    limit ${limit}`)
}

export async function listClips(
  db: DbOrTx,
  key: PartnerKey,
  campaignId: string,
  q: { limit: number; cursor: string | null; status: 'approved' | 'in_review' | null },
): Promise<Page<ApiClip> | null> {
  if (!(await getCampaign(db, key, '', campaignId))) return null
  const after = decodeCursor(q.cursor)
  const status = q.status ? sql`s.state in (${list(q.status === 'approved' ? APPROVED : IN_REVIEW)})` : sql`true`
  const page = after ? sql`(s.submitted_at, s.id) < (${after.at}::timestamptz, ${after.id}::uuid)` : sql`true`
  const rows = await clips(db, key, sql`s.campaign_id = ${campaignId}::uuid and ${status} and ${page}`, q.limit + 1)
  const more = rows.length > q.limit
  const shown = rows.slice(0, q.limit)
  const last = shown.at(-1)
  return {
    object: 'list',
    data: shown.map(toClip),
    has_more: more,
    next_cursor: more && last ? encodeCursor(last.submitted_at, last.id) : null,
  }
}

export async function getClip(db: DbOrTx, key: PartnerKey, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [r] = await clips(db, key, sql`s.id = ${id}::uuid`, 1)
  return r ? toClip(r) : null
}

/** Clips by id, for webhook payloads; no key scope (the caller already matched it). */
export async function clipsById(db: DbOrTx, ids: string[]): Promise<Map<string, ApiClip>> {
  if (!ids.length) return new Map()
  const rows = await db.execute<ClipRow>(sql`
    select s.id, s.campaign_id, s.platform, s.post_url, s.platform_post_id, a.handle, a.followers, s.state,
      s.published_at, s.submitted_at, v.views, v.likes, v.comments, v.shares, v.taken_at
    from submissions s
    left join linked_accounts a on a.id = s.linked_account_id
    ${latest}
    where s.id in (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`)
  return new Map(rows.map((r) => [r.id, toClip(r)]))
}

/** Views per day: each post's newest figure per day, carried forward, summed; and the posts submitted. */
export async function dailyStats(db: DbOrTx, key: PartnerKey, campaignId: string) {
  const c = await getCampaign(db, key, '', campaignId)
  if (!c) return null
  const rows = await db.execute<{ day: string; total: string; submitted: string }>(sql`
    with daily as (
      select v.submission_id, v.day, v.views
      from view_snapshot_days v join submissions s on s.id = v.submission_id
      where s.campaign_id = ${campaignId}::uuid and s.state in (${list(APPROVED)})
    ), deltas as (
      select day, views - lag(views, 1, 0::bigint) over (partition by submission_id order by day) as delta from daily
    ), per_day as (
      select day, sum(delta) as delta from deltas group by day
    ), bounds as (
      select least(min(day), (select min((submitted_at at time zone 'UTC')::date) from submissions
        where campaign_id = ${campaignId}::uuid)) as first, max(day) as last from daily
    ), days as (
      select d::date as day from bounds, generate_series(bounds.first, greatest(bounds.last, bounds.first), interval '1 day') d
      where bounds.first is not null
    ), submitted as (
      select (submitted_at at time zone 'UTC')::date as day, count(*) as n from submissions
      where campaign_id = ${campaignId}::uuid and state in (${list([...APPROVED, ...IN_REVIEW])}) group by 1
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      coalesce(sum(coalesce(per_day.delta, 0)) over (order by days.day), 0) as total,
      coalesce(submitted.n, 0) as submitted
    from days left join per_day on per_day.day = days.day left join submitted on submitted.day = days.day
    order by days.day`)
  let before = 0
  return {
    object: 'list' as const,
    campaign_id: campaignId,
    data: rows.map((r) => {
      const total = n(r.total)
      const day = {
        date: r.day,
        views: Math.max(0, total - before),
        views_total: total,
        clips_submitted: n(r.submitted),
      }
      before = total
      return day
    }),
  }
}

/** The campaign's published client reports, with their web and PDF addresses. */
export async function campaignReports(db: DbOrTx, key: PartnerKey, base: string, campaignId: string) {
  if (!(await getCampaign(db, key, '', campaignId))) return null
  const rows = await db.execute<{
    id: string
    kind: string
    week_number: number | null
    slug: string
    published_at: Date
  }>(sql`
    select id, kind, week_number, slug, published_at from campaign_reports
    where campaign_id = ${campaignId}::uuid and status = 'published'
    order by published_at desc`)
  return {
    object: 'list' as const,
    data: rows.map((r) => ({
      id: r.id,
      object: 'report' as const,
      kind: r.kind === 'week' ? ('weekly' as const) : ('final' as const),
      week: r.week_number,
      url: new URL(`/reports/${r.slug}`, base).toString(),
      pdf_url: new URL(`/reports/${r.slug}.pdf`, base).toString(),
      published_at: iso(r.published_at),
    })),
  }
}
