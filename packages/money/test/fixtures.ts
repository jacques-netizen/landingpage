import { createDb, tables } from '@mde/db'
import { eq, sql } from 'drizzle-orm'
import { createPgStore } from '../src'

// Shared helpers for the Postgres-backed money tests.
export function connect(max = 10) {
  const { db, sql: client } = createDb(process.env.DATABASE_URL!, { max, onnotice: () => {} })
  return { db, client, store: createPgStore(db) }
}

type Db = ReturnType<typeof connect>['db']
let n = 0
const uid = (p: string) => `${p}-${Date.now()}-${++n}@test.invalid`

export async function makeUser(db: Db, opts: { payoutStatus?: 'none' | 'verified' } = {}) {
  const [u] = await db
    .insert(tables.users)
    .values({ email: uid('u') })
    .returning()
  await db.insert(tables.creatorProfiles).values({ userId: u!.id, payoutStatus: opts.payoutStatus ?? 'none' })
  return u!.id
}

export async function makeClient(db: Db, serviceFeeBps = 0) {
  const [c] = await db.insert(tables.clients).values({ name: 'Test client', serviceFeeBps }).returning()
  return c!.id
}

// Setup A from 02_DATA_AND_MONEY.md section 7, overridable per test.
export const SETUP_A = {
  budgetCents: 100_000,
  rateCentsPer1000: 200,
  capPerPostCents: 30_000 as number | null,
  capPerCreatorCents: 50_000 as number | null,
  minViewsToEarn: 1_000,
}

export async function makeCampaign(db: Db, clientId: string, over: Partial<typeof SETUP_A> = {}) {
  const s = { ...SETUP_A, ...over }
  const [c] = await db
    .insert(tables.campaigns)
    .values({
      clientId,
      type: 'clipping',
      title: 'Test campaign',
      platforms: ['tiktok'],
      budgetCents: s.budgetCents,
      rateCentsPer1000: s.rateCentsPer1000,
      capPerPostCents: s.capPerPostCents,
      capPerCreatorCents: s.capPerCreatorCents,
      minViewsToEarn: s.minViewsToEarn,
      status: 'awaiting_funding',
    })
    .returning()
  const [t] = await db
    .insert(tables.termsVersions)
    .values({ campaignId: c!.id, bodyMarkdown: 'Test terms', effectiveAt: new Date() })
    .returning()
  await db.update(tables.campaigns).set({ currentTermsVersionId: t!.id }).where(eq(tables.campaigns.id, c!.id))
  return { campaignId: c!.id, termsVersionId: t!.id }
}

/** Client pays, then the campaign is funded. Leaves the campaign live. */
export async function fundedCampaign(ctx: ReturnType<typeof connect>, over: Partial<typeof SETUP_A> = {}, feeBps = 0) {
  const { db, store } = ctx
  const { recordClientFunding, fundCampaign, serviceFeeCents } = await import('../src')
  const clientId = await makeClient(db, feeBps)
  const c = await makeCampaign(db, clientId, over)
  const budget = over.budgetCents ?? SETUP_A.budgetCents
  await recordClientFunding(store, {
    clientId,
    amountCents: budget + serviceFeeCents(budget, feeBps),
    reference: `invoice-${c.campaignId}`,
    actorId: null,
  })
  await fundCampaign(store, { campaignId: c.campaignId, actorId: null })
  await db.update(tables.campaigns).set({ status: 'live' }).where(eq(tables.campaigns.id, c.campaignId))
  return { clientId, ...c }
}

let postSeq = 0
export async function makeSubmission(
  db: Db,
  c: { campaignId: string; termsVersionId: string },
  creatorId: string,
  opts: { countedViews?: number; rateLocked?: number; state?: string } = {},
) {
  const [s] = await db
    .insert(tables.submissions)
    .values({
      campaignId: c.campaignId,
      creatorId,
      platform: 'tiktok',
      postUrl: `https://www.tiktok.com/@x/video/${++postSeq}`,
      platformPostId: `${Date.now()}${postSeq}`,
      state: opts.state ?? 'approved',
      termsVersionId: c.termsVersionId,
      rateCentsPer1000Locked: opts.rateLocked ?? SETUP_A.rateCentsPer1000,
      submittedAt: new Date(),
      countedViews: opts.countedViews ?? 0,
      latestViews: opts.countedViews ?? 0,
    })
    .returning()
  return s!.id
}

export async function setCountedViews(db: Db, submissionId: string, countedViews: number) {
  await db
    .update(tables.submissions)
    .set({ countedViews, latestViews: countedViews })
    .where(eq(tables.submissions.id, submissionId))
}

export async function submission(db: Db, id: string) {
  const [s] = await db.select().from(tables.submissions).where(eq(tables.submissions.id, id))
  return s!
}

export async function campaign(db: Db, id: string) {
  const [c] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.id, id))
  return c!
}

/** Balance of one ledger account, from entries. 0 if the account does not exist yet. */
export async function balanceOf(db: Db, kind: string, ownerId: string | null) {
  const rows = await db.execute<{ b: string | null }>(sql`
    select coalesce(sum(e.amount_cents), 0)::bigint as b
    from ledger_entries e join ledger_accounts a on a.id = e.account_id
    where a.kind = ${kind} and a.owner_id is not distinct from ${ownerId}`)
  return Number(rows[0]!.b)
}

export async function transactionsFor(db: Db, submissionId: string) {
  return db.select().from(tables.ledgerTransactions).where(eq(tables.ledgerTransactions.submissionId, submissionId))
}
