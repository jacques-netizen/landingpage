// Development seed: the base rows from @mde/db, then money through the real engine so the ledger
// balances by construction. Development only; never production (the UI must never show invented data).
// Idempotent: running it twice changes nothing.
import { createDb, tables, type Db } from '@mde/db'
import { SEED_CAMPAIGN_PLAN, seed as seedBase } from '@mde/db/seed'
import {
  accrueEarnings,
  createPgStore,
  fundCampaign,
  recordClientFunding,
  serviceFeeCents,
  type MoneyStore,
} from '@mde/money'
import { and, eq, like, sql } from 'drizzle-orm'
import { fileURLToPath } from 'node:url'

/** Views that earn exactly `cents` at `rate` (floor(views * rate / 1000) === cents for rate <= 1000). */
const viewsFor = (cents: number, rate: number) => Math.ceil((cents * 1000) / rate)

async function seedMoney(db: Db, store: MoneyStore) {
  const creators = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(like(tables.users.email, 'creator%@seed.invalid'))
    .orderBy(tables.users.email)

  for (const plan of SEED_CAMPAIGN_PLAN) {
    if (plan.leftCents === null) continue
    const [c] = await db.select().from(tables.campaigns).where(eq(tables.campaigns.title, plan.title))
    if (!c) continue
    const [client] = await db.select().from(tables.clients).where(eq(tables.clients.id, c.clientId!))
    await recordClientFunding(store, {
      clientId: client!.id,
      amountCents: c.budgetCents + serviceFeeCents(c.budgetCents, client!.serviceFeeBps),
      reference: `seed-invoice-${c.id}`,
      actorId: null,
    })
    await fundCampaign(store, { campaignId: c.id, actorId: null })
    if (c.status === 'awaiting_funding')
      await db.update(tables.campaigns).set({ status: 'live' }).where(eq(tables.campaigns.id, c.id))

    // Earn the planned amount: one post per creator up to the per-post cap, a second post up to the
    // per-creator cap, until paid = budget - left.
    const existing = await db
      .select({ id: tables.submissions.id })
      .from(tables.submissions)
      .where(eq(tables.submissions.campaignId, c.id))
    if (existing.length > 0) continue // already seeded
    let remaining = c.budgetCents - plan.leftCents
    let n = 0
    for (const creator of creators) {
      if (remaining <= 0) break
      let creatorLeft = c.capPerCreatorCents ?? Number.MAX_SAFE_INTEGER
      while (remaining > 0 && creatorLeft > 0) {
        const earn = Math.min(remaining, c.capPerPostCents ?? remaining, creatorLeft)
        const views = viewsFor(earn, c.rateCentsPer1000)
        const [s] = await db
          .insert(tables.submissions)
          .values({
            campaignId: c.id,
            creatorId: creator.id,
            platform: c.platforms[0]!,
            postUrl: `https://www.tiktok.com/@seed/video/${c.id.slice(0, 8)}${++n}`,
            platformPostId: `seed-${c.id}-${n}`,
            state: 'approved',
            termsVersionId: c.currentTermsVersionId!,
            rateCentsPer1000Locked: c.rateCentsPer1000,
            submittedAt: new Date(),
            latestViews: views,
            countedViews: views,
          })
          .returning()
        const r = await accrueEarnings(store, { submissionId: s!.id })
        remaining -= r.deltaCents
        creatorLeft -= r.deltaCents
        if (r.deltaCents === 0) throw new Error(`Seed could not earn on ${plan.title}`)
      }
    }
    if (plan.status === 'closed') {
      const closedAt = new Date(Date.now() - 86400000)
      await db
        .update(tables.campaigns)
        .set({ status: 'closed', closedAt, releaseAt: new Date(closedAt.getTime() + 7 * 86400000) })
        .where(eq(tables.campaigns.id, c.id))
      await db
        .update(tables.submissions)
        .set({ state: 'final' })
        .where(and(eq(tables.submissions.campaignId, c.id), sql`state in ('approved','earning')`))
    }
  }

  // The browse screen's featured campaign is the sample clipping campaign, with the mockup's copy.
  const [featured] = await db
    .select({ id: tables.campaigns.id })
    .from(tables.campaigns)
    .where(eq(tables.campaigns.title, 'Sample clipping'))
  if (featured) {
    await db
      .insert(tables.settings)
      .values({
        key: 'content.browse',
        value: {
          'featured.campaign': featured.id,
          'featured.title': 'Sample clipping campaign',
          'featured.body':
            'Cut the best moments, post on your own account, and earn $2.00 for every 1,000 counted views.',
          'featured.tags': 'Clipping, TikTok',
        },
      })
      .onConflictDoNothing()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database')
  const { db, sql: client } = createDb(url, { max: 4, onnotice: () => {} })
  await seedBase(db)
  await seedMoney(db, createPgStore(db))
  await client.end()
  console.log('Seed data written (development only)')
}
