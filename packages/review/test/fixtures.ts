import {
  campaignFormSchema,
  createClient,
  createDraft,
  fundCampaign,
  joinCampaign,
  publishCampaign,
  recordClientFunding,
} from '@mde/campaigns'
import { createDb, tables } from '@mde/db'
import { MockProvider, ProviderRouter, type MockState } from '@mde/platforms'
import { submitPost } from '@mde/submissions'
import { runViewCheck } from '@mde/tracking'
import { eq, sql as dsql } from 'drizzle-orm'

export const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
let state: MockState = {}
export const router = new ProviderRouter([new MockProvider(() => state)], { backoffMs: 1, attempts: 1, log: () => {} })
const HOUR = 3_600_000
let n = 0
export const uniq = () => `${Date.now() % 1e9}${++n}`

export async function user(prefix: string, role?: 'reviewer' | 'admin') {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `${prefix}-${uniq()}@test.invalid` })
    .returning()
  await db.insert(tables.creatorProfiles).values({ userId: u!.id }).onConflictDoNothing()
  if (role) await db.insert(tables.staffRoles).values({ userId: u!.id, role })
  return u!.id
}

let staff: { id: string; clientId: string } | null = null
async function staffAndClient() {
  if (!staff) {
    const id = await user('staff', 'admin')
    const c = await createClient(db, id, {
      name: 'C',
      contactName: null,
      contactEmail: null,
      serviceFeeBps: 0,
      notes: null,
    })
    staff = { id, clientId: c.id }
  }
  return staff
}

/** A live campaign ($2.00 per 1,000, minimum 1,000 views) with one creator's post in review. */
export async function postInReview() {
  const s = await staffAndClient()
  const c = await createDraft(
    db,
    s.id,
    campaignFormSchema.parse({
      title: 'Review test',
      type: 'clipping',
      clientId: s.clientId,
      coverImageUrl: '/designed/camp-clip.png',
      briefMarkdown: 'b',
      assets: '',
      examplePosts: '',
      platforms: ['tiktok'],
      budgetCents: '$1,000.00',
      rateCentsPer1000: '$2.00',
      capPerPostCents: '',
      capPerCreatorCents: '',
      minViewsToEarn: '1000',
      minEngagementBps: '',
      maxPostsPerAccount: '',
      minFollowers: '',
      minAccountAgeDays: '',
      languages: '',
      allowedRegions: '',
      blockedRegions: '',
      requiredHashtags: '',
      requireAdDisclosure: false,
      minDurationSeconds: '',
      keepLiveDays: '30',
      visibility: 'public',
      accessCode: '',
      startAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      endAt: '',
      termsDraftMarkdown: 'Rules.',
      templateFields: {},
    }),
  )
  await recordClientFunding(db, s.id, { clientId: s.clientId, amountCents: 100_000, reference: `INV-${c.id}` })
  await fundCampaign(db, s.id, c.id)
  await publishCampaign(db, s.id, c.id)
  const creator = await user('creator')
  const handle = `rv${uniq()}`
  const [acc] = await db
    .insert(tables.linkedAccounts)
    .values({
      creatorId: creator,
      platform: 'tiktok',
      handle,
      linkMethod: 'bio_code',
      status: 'verified',
      platformUserId: `tt-${handle}`,
      followers: 50_000,
    })
    .returning()
  await joinCampaign(db, creator, c.id)
  const pid = `76${uniq()}`.padEnd(19, '0').slice(0, 19)
  const views = (v: number, extra: object = {}) => {
    state = {
      ...state,
      posts: {
        ...state.posts,
        [`tiktok:${pid}`]: {
          authorPlatformUserId: acc!.platformUserId,
          publishedAt: new Date(Date.now() - HOUR).toISOString(),
          views: v,
          likes: Math.floor(v / 20),
          comments: Math.floor(v / 200),
          ...extra,
        },
      },
    }
  }
  views(500)
  const t0 = new Date()
  const r = await submitPost(
    db,
    { creatorId: creator, campaignId: c.id, postUrl: `https://www.tiktok.com/@${handle}/video/${pid}` },
    { router, now: t0 },
  )
  if (r.outcome !== 'needs_review') throw new Error(`setup: ${r.outcome}`)
  const id = r.submissionId!
  const sub = async () => (await db.select().from(tables.submissions).where(eq(tables.submissions.id, id)))[0]!
  const balance = async (kind: string, owner: string) => {
    const rows = await db.execute(dsql`select coalesce(sum(e.amount_cents),0)::bigint as b from ledger_entries e
      join ledger_accounts a on a.id = e.account_id where a.kind = ${kind} and a.owner_id = ${owner}`)
    return Number((rows[0] as { b: string }).b)
  }
  /** Run the next due view check, hours after submission. */
  const check = (hours: number) => runViewCheck(db, id, { router, now: new Date(t0.getTime() + hours * HOUR) })
  return { staffId: s.id, campaignId: c.id, creator, id, sub, views, check, balance, t0 }
}
