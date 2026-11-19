import { sql } from 'drizzle-orm'
import { writeAudit } from './audit'
import type { DbOrTx } from './client'
import * as tables from './schema'

// One-off (owner, 2026-11-19: "add these numbers to Alpay's / londonbaithead submission in the platform"):
// the two @londonbaithead Instagram posts on the Davido X Winnerman-Audio campaign, with the figures from
// the page owner's own Instagram Post insights screens. We cannot reach the live database, so the deploy
// adds them, as the archived clips were. Reporting only: it writes post_insights and the audit log and
// nothing else. The submission rows, the ledger, earnings, payouts and spend are never touched, and the
// audit row records the campaign's earned and paid figures before and after to show it.
// Runs with the migrations on every deploy; does nothing once the figures are in, or where the campaign
// or a post cannot be matched to exactly one submission.

export const INSIGHTS_CAMPAIGN_ID = 'ad8d147b-7090-48d8-b932-3ee257553cfa'
export const INSIGHTS_HANDLE = 'londonbaithead'
export const INSIGHTS_SOURCE = 'Instagram Post insights (page owner), read 19 Nov 2026'
const READ_ON = '2026-11-19'

type Insight = {
  /** The UTC day the post went up, to match it to its submission. */
  postedOn: string
  label: string
  views: number
  viewsByApp: { instagram: number; facebook: number }
  // As the screen shows them: 19.3K is kept as 19,300.
  likes: number
  comments: number
  reposts: number
  saves: number
  extra: Record<string, unknown>
}

export const BAITHEAD_INSIGHTS: Insight[] = [
  {
    postedOn: '2026-11-03',
    label: '3 November at 17:13, Davido quote "keep the receipt"',
    views: 1_389_215,
    viewsByApp: { instagram: 234_228, facebook: 1_154_987 },
    likes: 19_300,
    comments: 2_800,
    reposts: 577,
    saves: 294,
    extra: {
      postedAsShown: '3 November at 17:13',
      roundedOnScreen: { likes: '19.3K', comments: '2.8K' },
      profileActivity: 733,
      follows: 494,
      profileVisits: 239,
      audienceByCountry: [
        ['Nigeria', 68.2],
        ['United Kingdom', 6.7],
        ['United States', 4.9],
        ['Ghana', 3.4],
        ['Canada', 2.2],
      ],
    },
  },
  {
    postedOn: '2026-11-04',
    label: '4 November at 12:35, Love Island Nigeria',
    views: 888_571,
    viewsByApp: { instagram: 883_466, facebook: 5_105 },
    likes: 113_000,
    comments: 1_100,
    reposts: 2_900,
    saves: 4_500,
    extra: {
      postedAsShown: '4 November at 12:35',
      roundedOnScreen: { likes: '113.0K', comments: '1.1K', reposts: '2.9K', saves: '4.5K' },
      profileActivity: 2_586,
      follows: 287,
      externalLinkTaps: 2,
      audienceByCountry: [
        ['United States', 44.0],
        ['United Kingdom', 13.6],
        ['Canada', 6.4],
        ['Germany', 3.7],
        ['Kenya', 3.2],
      ],
    },
  },
]

type Money = { earned: string; outside: string; counted: string; ledger: string }

/** The campaign's money as it stands: what clippers earned, outside pay, counted views and ledger total. */
async function campaignMoney(d: DbOrTx, campaignId: string) {
  const [m] = await d.execute<Money>(sql`
    select
      (select coalesce(sum(earned_cents), 0) from submissions where campaign_id = ${campaignId})::text as earned,
      (select coalesce(sum(outside_paid_cents), 0) from submissions where campaign_id = ${campaignId})::text as outside,
      (select coalesce(sum(counted_views), 0) from submissions where campaign_id = ${campaignId})::text as counted,
      (select count(*) from ledger_transactions where campaign_id = ${campaignId})::text as ledger`)
  return m!
}

export async function importPostInsights(
  d: DbOrTx,
  log: (m: string) => void = console.log,
  campaignId: string = INSIGHTS_CAMPAIGN_ID,
) {
  const [c] = await d.execute<{ id: string }>(
    sql`select id from campaigns where id = ${campaignId} and deleted_at is null`,
  )
  if (!c) return
  for (const item of BAITHEAD_INSIGHTS) {
    const matches = await d.execute<{
      id: string
      latest_views: string
      counted_views: string
      earned_cents: string
      state: string
      post_url: string
    }>(sql`
      select s.id, s.latest_views::text, s.counted_views::text, s.earned_cents::text, s.state, s.post_url
      from submissions s left join linked_accounts a on a.id = s.linked_account_id
      where s.campaign_id = ${campaignId} and s.platform = 'instagram'
        and s.state not in ('rejected_auto', 'rejected', 'removed')
        and (lower(a.handle) = ${INSIGHTS_HANDLE} or s.post_url ilike ${`%instagram.com/${INSIGHTS_HANDLE}/%`})
        and (coalesce(s.published_at, s.submitted_at) at time zone 'UTC')::date = ${item.postedOn}::date`)
    if (matches.length !== 1) {
      log(
        JSON.stringify({
          level: 'warn',
          msg: 'post insights not added: the post did not match exactly one submission',
          postedOn: item.postedOn,
          matches: matches.length,
        }),
      )
      continue
    }
    const s = matches[0]!
    const [had] = await d
      .select()
      .from(tables.postInsights)
      .where(sql`submission_id = ${s.id}`)
    if (had && had.views === item.views && had.source === INSIGHTS_SOURCE) continue
    // The insight and its audit row commit together, or neither does.
    await d.transaction(async (tx) => {
      const before = await campaignMoney(tx, campaignId)
      const values = {
        views: item.views,
        viewsByApp: item.viewsByApp,
        likes: item.likes,
        comments: item.comments,
        reposts: item.reposts,
        saves: item.saves,
        extra: item.extra,
        source: INSIGHTS_SOURCE,
        readOn: READ_ON,
        setBy: null,
      }
      await tx
        .insert(tables.postInsights)
        .values({ submissionId: s.id, ...values })
        .onConflictDoUpdate({ target: tables.postInsights.submissionId, set: { ...values, updatedAt: new Date() } })
      const after = await campaignMoney(tx, campaignId)
      await writeAudit(tx, {
        actorId: null,
        action: 'submission.insights_set',
        entity: 'submission',
        entityId: s.id,
        before: {
          reportedViews: Math.max(Number(s.latest_views), had?.views ?? 0),
          latestViews: Number(s.latest_views),
          countedViews: Number(s.counted_views),
          earnedCents: Number(s.earned_cents),
          state: s.state,
          insight: had ? { views: had.views, source: had.source } : null,
          campaignMoney: before,
        },
        after: {
          post: item.label,
          postUrl: s.post_url,
          views: item.views,
          viewsByApp: item.viewsByApp,
          source: INSIGHTS_SOURCE,
          note: 'Reporting only, owner request 2026-11-19, added by the deploy. Earnings, payouts and spend unchanged.',
          campaignMoney: after,
        },
      })
    })
    log(`post insights added for the ${item.postedOn} @${INSIGHTS_HANDLE} post: ${item.views} views`)
  }
}
