// Development seed data. Never run against production: the UI must never show invented data there.
// Phase 0 seeds settings, reason codes, staff, creators, clients and campaigns with their terms.
// Submissions, view snapshots, appeals, warnings and the funded ledger are added once the money
// engine exists (Phase 1 and Phase 4), so the ledger they create balances by construction.
import { REASON_CODES } from '@mde/config'
import { sql } from 'drizzle-orm'
import { fileURLToPath } from 'node:url'
import { createDb, type Db } from './client'
import { seedSettingsDefaults } from './settings'
import { campaigns, clients, creatorProfiles, reasonCodes, staffRoles, termsVersions, users } from './schema'

const SEED_DOMAIN = 'seed.invalid'

export const SEED_STAFF = [
  { email: `reviewer@${SEED_DOMAIN}`, name: 'Seed reviewer', role: 'reviewer' },
  { email: `finance@${SEED_DOMAIN}`, name: 'Seed finance', role: 'finance' },
  { email: `admin@${SEED_DOMAIN}`, name: 'Seed admin', role: 'admin' },
] as const

// The four live campaigns use the sample campaigns and covers from the mockups.
const SEED_CAMPAIGNS = [
  {
    title: 'Sample clipping',
    // Budget left after the seeded earnings (the mockups' sample numbers for the four live campaigns).
    leftCents: 480000,
    type: 'clipping',
    status: 'live',
    budgetCents: 774194,
    rate: 200,
    platforms: ['tiktok', 'instagram'],
    cover: '/designed/camp-clip.png',
  },
  {
    title: 'Sample music',
    leftCents: 160000,
    type: 'music',
    status: 'live',
    budgetCents: 181818,
    rate: 125,
    platforms: ['tiktok'],
    cover: '/designed/camp-music.png',
  },
  {
    title: 'Sample logo',
    leftCents: 600000,
    type: 'logo',
    status: 'live',
    budgetCents: 1538462,
    rate: 150,
    platforms: ['instagram'],
    cover: '/designed/camp-logo.png',
  },
  {
    title: 'Sample UGC',
    leftCents: 160000,
    type: 'ugc',
    status: 'live',
    budgetCents: 695652,
    rate: 200,
    platforms: ['tiktok', 'youtube'],
    cover: '/designed/camp-ugc.png',
  },
  {
    title: 'Seed draft campaign',
    leftCents: null,
    type: 'clipping',
    status: 'draft',
    budgetCents: 500000,
    rate: 200,
    platforms: ['tiktok'],
    cover: null,
  },
  {
    title: 'Seed awaiting funding',
    leftCents: null,
    type: 'music',
    status: 'awaiting_funding',
    budgetCents: 300000,
    rate: 150,
    platforms: ['instagram', 'tiktok'],
    cover: null,
  },
  {
    title: 'Seed closing campaign',
    leftCents: 0,
    type: 'logo',
    status: 'closing',
    budgetCents: 200000,
    rate: 100,
    platforms: ['youtube'],
    cover: null,
  },
  {
    title: 'Seed closed campaign',
    leftCents: 40000,
    type: 'ugc',
    status: 'closed',
    budgetCents: 100000,
    rate: 200,
    platforms: ['x', 'tiktok'],
    cover: null,
  },
] as const

export const SEED_CAMPAIGN_PLAN = SEED_CAMPAIGNS

export async function seed(db: Db) {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database')

  await seedSettingsDefaults(db)

  await db
    .insert(reasonCodes)
    .values(REASON_CODES.map(([code, label, creatorMessage]) => ({ code, label, creatorMessage })))
    .onConflictDoNothing()

  await db.transaction(async (tx) => {
    // Idempotent: skip if the seed already ran.
    const existing = await tx.execute(sql`select 1 from users where email = ${SEED_STAFF[0].email}`)
    if (existing.length > 0) return

    for (const s of SEED_STAFF) {
      const [u] = await tx
        .insert(users)
        .values({
          email: s.email,
          name: s.name,
          isAdultConfirmed: true,
          adultConfirmedAt: new Date(),
          termsAcceptedAt: new Date(),
        })
        .returning()
      await tx.insert(staffRoles).values({ userId: u!.id, role: s.role })
    }

    for (let i = 1; i <= 30; i++) {
      const n = String(i).padStart(2, '0')
      const [u] = await tx
        .insert(users)
        .values({
          email: `creator${n}@${SEED_DOMAIN}`,
          name: `Seed creator ${n}`,
          isPrivateProfile: i % 7 === 0,
          isAdultConfirmed: true,
          adultConfirmedAt: new Date(),
          termsAcceptedAt: new Date(),
        })
        .returning()
      await tx.insert(creatorProfiles).values({ userId: u!.id, payoutStatus: i % 3 === 0 ? 'verified' : 'none' })
    }

    const clientRows = await tx
      .insert(clients)
      .values(
        [1, 2, 3, 4, 5].map((i) => ({
          name: `Seed client ${i}`,
          contactName: `Seed contact ${i}`,
          contactEmail: `client${i}@${SEED_DOMAIN}`,
          serviceFeeBps: i * 250,
        })),
      )
      .returning()

    const now = Date.now()
    for (const [i, c] of SEED_CAMPAIGNS.entries()) {
      const [campaign] = await tx
        .insert(campaigns)
        .values({
          clientId: clientRows[i % clientRows.length]!.id,
          type: c.type,
          title: c.title,
          coverImageUrl: c.cover,
          briefMarkdown: 'Seed brief. Development data only.',
          termsDraftMarkdown: 'Seed campaign rules. Development data only.',
          platforms: [...c.platforms],
          budgetCents: c.budgetCents,
          rateCentsPer1000: c.rate,
          capPerPostCents: 30000,
          capPerCreatorCents: 50000,
          minViewsToEarn: 1000,
          requiredHashtags: ['#mde'],
          // Funded campaigns start unfunded; packages/seed funds them through the money engine, then sets the status.
          status: c.status === 'draft' ? 'draft' : 'awaiting_funding',
          // Staggered by a minute so the plan order is the order campaigns opened.
          startAt: new Date(now - 7 * 86400000 + i * 60000),
          endAt: c.status === 'closed' ? new Date(now - 86400000) : new Date(now + 30 * 86400000),
        })
        .returning()
      const [terms] = await tx
        .insert(termsVersions)
        .values({
          campaignId: campaign!.id,
          bodyMarkdown: 'Seed campaign rules. Development data only.',
          effectiveAt: new Date(now - 7 * 86400000),
        })
        .returning()
      await tx.execute(sql`update campaigns set current_terms_version_id = ${terms!.id} where id = ${campaign!.id}`)
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const { db, sql: client } = createDb(url, { max: 1 })
  await seed(db)
  await client.end()
  console.log('Seed data written (development only)')
}
