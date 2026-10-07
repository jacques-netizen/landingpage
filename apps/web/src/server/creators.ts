import 'server-only'
import { db, tables } from '@mde/db'
import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm'

const { users, creatorProfiles, submissions, campaigns, linkedAccounts, warnings, reasonCodes, withdrawals } = tables

/** Creators for the staff list, newest first, optionally matching a name or email. */
export async function listCreators(q?: string) {
  const term = q?.trim()
  return db()
    .select({
      id: users.id,
      email: users.email,
      name: sql<string | null>`coalesce(${users.username}, ${users.name})`,
      status: users.status,
      strikes: creatorProfiles.strikesActive,
      payoutStatus: creatorProfiles.payoutStatus,
      posts: sql<number>`(select count(*)::int from submissions s where s.creator_id = ${users.id})`,
      earnedCents: sql<number>`(select coalesce(sum(s.earned_cents), 0)::bigint from submissions s where s.creator_id = ${users.id})`,
      joinedAt: users.createdAt,
    })
    .from(creatorProfiles)
    .innerJoin(users, eq(users.id, creatorProfiles.userId))
    .where(
      term
        ? or(ilike(users.email, `%${term}%`), ilike(users.name, `%${term}%`), ilike(users.username, `%${term}%`))
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(200)
}

/** Everything staff need about one creator (01_PRODUCT.md 8.4). Null if there is no such creator. */
export async function creatorDetail(id: string) {
  const d = db()
  const [row] = await d
    .select({ user: users, profile: creatorProfiles })
    .from(creatorProfiles)
    .innerJoin(users, eq(users.id, creatorProfiles.userId))
    .where(eq(users.id, id))
  if (!row) return null
  const balance = async (kind: string) => {
    const r = await d.execute<{ b: string }>(sql`
      select coalesce(sum(e.amount_cents), 0)::bigint as b from ledger_entries e
      join ledger_accounts a on a.id = e.account_id where a.kind = ${kind} and a.owner_id = ${id}`)
    return Number(r[0]!.b)
  }
  const [accounts, posts, strikes, availableCents, pendingCents, [paid]] = await Promise.all([
    d
      .select()
      .from(linkedAccounts)
      .where(and(eq(linkedAccounts.creatorId, id), ne(linkedAccounts.status, 'removed')))
      .orderBy(desc(linkedAccounts.createdAt)),
    d
      .select({
        id: submissions.id,
        campaignTitle: campaigns.title,
        platform: submissions.platform,
        postUrl: submissions.postUrl,
        state: submissions.state,
        countedViews: submissions.countedViews,
        earnedCents: submissions.earnedCents,
        submittedAt: submissions.submittedAt,
      })
      .from(submissions)
      .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
      .where(eq(submissions.creatorId, id))
      .orderBy(desc(submissions.submittedAt))
      .limit(100),
    d
      .select({
        id: warnings.id,
        reason: reasonCodes.label,
        note: warnings.note,
        submissionId: warnings.submissionId,
        createdAt: warnings.createdAt,
        expiresAt: warnings.expiresAt,
      })
      .from(warnings)
      .leftJoin(reasonCodes, eq(reasonCodes.code, warnings.reasonCode))
      .where(eq(warnings.creatorId, id))
      .orderBy(desc(warnings.createdAt)),
    balance('creator_available'),
    balance('creator_pending'),
    d
      .select({ cents: sql<string>`coalesce(sum(${withdrawals.amountCents}), 0)::bigint` })
      .from(withdrawals)
      .where(and(eq(withdrawals.creatorId, id), eq(withdrawals.status, 'paid'))),
  ])
  return {
    ...row,
    accounts,
    posts,
    strikes,
    money: {
      earnedCents: posts.reduce((s, p) => s + p.earnedCents, 0),
      pendingCents,
      availableCents,
      paidOutCents: Number(paid?.cents ?? 0),
    },
  }
}
