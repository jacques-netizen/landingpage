import { randomUUID } from 'node:crypto'
import {
  createDb,
  campaigns,
  clients,
  creatorProfiles,
  submissions,
  termsVersions,
  users,
} from '@mde/db'

export const url =
  process.env.MONEY_TEST_DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/mde_test_money'
export type Db = ReturnType<typeof createDb>['db']

export function testDb(max = 10) {
  return createDb(url, { max })
}

export type CampaignSetup = {
  budgetCents: bigint
  rateCentsPer1000: number
  capPerPostCents?: bigint | null
  capPerCreatorCents?: bigint | null
  minViewsToEarn?: number
  serviceFeeBps?: number
  status?: string
}

/** Setup A from docs/02_DATA_AND_MONEY.md section 7. */
export const SETUP_A: CampaignSetup = {
  budgetCents: 100_000n,
  rateCentsPer1000: 200,
  capPerPostCents: 30_000n,
  capPerCreatorCents: 50_000n,
  minViewsToEarn: 1000,
}

export async function makeClient(db: Db, serviceFeeBps = 0) {
  const [c] = await db
    .insert(clients)
    .values({ name: `Test client ${randomUUID()}`, serviceFeeBps })
    .returning()
  return c!
}

export async function makeCampaign(db: Db, setup: CampaignSetup) {
  const client = await makeClient(db, setup.serviceFeeBps ?? 0)
  const [c] = await db
    .insert(campaigns)
    .values({
      clientId: client.id,
      type: 'clipping',
      title: 'Test campaign',
      platforms: ['tiktok'],
      budgetCents: setup.budgetCents,
      rateCentsPer1000: setup.rateCentsPer1000,
      capPerPostCents: setup.capPerPostCents ?? null,
      capPerCreatorCents: setup.capPerCreatorCents ?? null,
      minViewsToEarn: setup.minViewsToEarn ?? 0,
      status: setup.status ?? 'live',
    })
    .returning()
  const [t] = await db
    .insert(termsVersions)
    .values({ campaignId: c!.id, bodyMarkdown: 'Test terms', effectiveAt: new Date() })
    .returning()
  return { campaign: c!, client, termsId: t!.id }
}

export async function makeCreator(db: Db, opts: { payoutVerified?: boolean } = {}) {
  const [u] = await db
    .insert(users)
    .values({ email: `creator-${randomUUID()}@test.invalid`, isAdultConfirmed: true })
    .returning()
  await db.insert(creatorProfiles).values({
    userId: u!.id,
    payoutStatus: opts.payoutVerified === false ? 'none' : 'verified',
    payoutProvider: 'stripe_connect',
    payoutProviderRef: `acct_${randomUUID()}`,
  })
  return u!
}

export async function makeSubmission(
  db: Db,
  input: {
    campaignId: string
    creatorId: string
    termsId: string
    rateLocked: number
    state?: string
    baselineViews?: number
    latestViews?: number
  },
) {
  const [s] = await db
    .insert(submissions)
    .values({
      campaignId: input.campaignId,
      creatorId: input.creatorId,
      platform: 'tiktok',
      postUrl: `https://example.invalid/${randomUUID()}`,
      platformPostId: randomUUID(),
      state: input.state ?? 'approved',
      termsVersionId: input.termsId,
      rateCentsPer1000Locked: input.rateLocked,
      submittedAt: new Date(),
      baselineViews: input.baselineViews ?? 0,
      latestViews: input.latestViews ?? 0,
    })
    .returning()
  return s!
}
