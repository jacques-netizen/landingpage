import 'server-only'
import { db, tables } from '@mde/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { WalletBar, WalletData } from '@/designed/wallet-model'

const APPROVED = ['approved', 'earning', 'final', 'paid_out']

/** A creator's wallet, from the ledger and their submissions. */
export async function loadWallet(creatorId: string, now = new Date()): Promise<WalletData> {
  const d = db()
  const balance = async (kind: string) => {
    const rows = await d.execute<{ b: string }>(sql`
      select coalesce(sum(e.amount_cents), 0)::bigint as b from ledger_entries e
      join ledger_accounts a on a.id = e.account_id where a.kind = ${kind} and a.owner_id = ${creatorId}`)
    return Number(rows[0]!.b)
  }
  const [availableCents, pendingCents, paidRows, profile, posts, bars] = await Promise.all([
    balance('creator_available'),
    balance('creator_pending'),
    d.execute<{ p: string }>(
      sql`select coalesce(sum(amount_cents), 0)::bigint as p from withdrawals where creator_id = ${creatorId} and status = 'paid'`,
    ),
    d.select().from(tables.creatorProfiles).where(eq(tables.creatorProfiles.userId, creatorId)),
    d
      .select({
        id: tables.submissions.id,
        title: tables.campaigns.title,
        platform: tables.submissions.platform,
        state: tables.submissions.state,
        countedViews: tables.submissions.countedViews,
        earnedCents: tables.submissions.earnedCents,
        submittedAt: tables.submissions.submittedAt,
      })
      .from(tables.submissions)
      .innerJoin(tables.campaigns, eq(tables.campaigns.id, tables.submissions.campaignId))
      .where(and(eq(tables.submissions.creatorId, creatorId)))
      .orderBy(desc(tables.submissions.submittedAt))
      .limit(2000),
    lastDaysOfEarnings(creatorId, now),
  ])

  const counted = posts.filter((p) => [...APPROVED, 'flagged'].includes(p.state))
  const p = profile[0]
  const ref = p?.payoutProviderRef?.replace(/\D/g, '') ?? ''
  return {
    availableCents,
    pendingCents,
    paidCents: Number(paidRows[0]!.p),
    countedViewsAll: counted.reduce((s, x) => s + x.countedViews, 0),
    earnedCentsAll: counted.reduce((s, x) => s + x.earnedCents, 0),
    bestCentsAll: Math.max(0, ...posts.map((x) => x.earnedCents)),
    lifetimeCountedViews: posts.filter((x) => APPROVED.includes(x.state)).reduce((s, x) => s + x.countedViews, 0),
    payout: p?.payoutProvider
      ? {
          method: p.payoutProvider === 'paypal' ? 'paypal' : 'bank_transfer',
          last4: ref.length >= 4 ? ref.slice(-4) : null,
        }
      : null,
    posts,
    postDays: [
      ...new Set(posts.filter((x) => x.state !== 'rejected_auto').map((x) => x.submittedAt.toISOString().slice(0, 10))),
    ],
    bars,
  }
}

/**
 * The last 12 days of earnings into pending (net of corrections), oldest first. Each day is coloured by
 * where most of that day's money is now: available (paid out), still pending, or held by a flag.
 */
async function lastDaysOfEarnings(creatorId: string, now: Date): Promise<WalletBar[]> {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 11))
  const rows = await db().execute<{ day: string; kind: string; cents: string }>(sql`
    select to_char(t.created_at at time zone 'UTC', 'YYYY-MM-DD') as day,
      case s.state when 'paid_out' then 'available' when 'flagged' then 'held' else 'pending' end as kind,
      sum(e.amount_cents)::bigint as cents
    from ledger_transactions t
    join ledger_entries e on e.transaction_id = t.id
    join ledger_accounts a on a.id = e.account_id and a.kind = 'creator_pending' and a.owner_id = ${creatorId}
    join submissions s on s.id = t.submission_id
    where t.kind in ('earning_accrued', 'earning_reversed') and t.created_at >= ${from.toISOString()}::timestamptz
    group by 1, 2`)
  return Array.from({ length: 12 }, (_, i) => {
    const day = new Date(from.getTime() + i * 86_400_000).toISOString().slice(0, 10)
    const here = rows.filter((r) => r.day === day)
    const cents = Math.max(
      0,
      here.reduce((s, r) => s + Number(r.cents), 0),
    )
    const top = [...here].sort((a, b) => Number(b.cents) - Number(a.cents))[0]
    return { cents, kind: (top?.kind ?? 'pending') as WalletBar['kind'] }
  })
}
