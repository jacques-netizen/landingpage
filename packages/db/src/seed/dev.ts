import { sql } from 'drizzle-orm'
import type { Database } from '../client'
import {
  appeals,
  authIdentities,
  campaignMembers,
  campaigns,
  clients,
  creatorProfiles,
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  linkedAccounts,
  reviewDecisions,
  staffRoles,
  submissions,
  termsVersions,
  users,
  viewSnapshots,
  warnings,
  fraudFlags,
} from '../schema'
import { makeRng } from './rng'

/*
 * DEVELOPMENT ONLY. Every row made here is fake and marked: emails end in @seed.invalid and client
 * names end in "(seed)". The interface must never show this data in production.
 * Ledger rows are balanced by construction and checked at the end.
 */

const FIRST = [
  'Alex',
  'Sam',
  'Jo',
  'Robin',
  'Maya',
  'Noah',
  'Lena',
  'Omar',
  'Ines',
  'Kai',
  'Zoe',
  'Ravi',
  'Mina',
  'Theo',
  'Ada',
]
const LAST = [
  'Rivera',
  'Okoye',
  'Lindqvist',
  'Haddad',
  'Moreau',
  'Tanaka',
  'Silva',
  'Novak',
  'Adeyemi',
  'Brandt',
]
const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'x'] as const
type Platform = (typeof PLATFORMS)[number]

type CampaignPlan = {
  title: string
  type: 'clipping' | 'logo' | 'music' | 'ugc'
  status: 'draft' | 'awaiting_funding' | 'live' | 'closing' | 'closed'
  clientIdx: number
  budget: number
  rate: number
  platforms: Platform[]
  visibility?: 'public' | 'private'
}

const PLANS: CampaignPlan[] = [
  {
    title: 'Seed clipping run A',
    type: 'clipping',
    status: 'live',
    clientIdx: 0,
    budget: 2500000,
    rate: 200,
    platforms: ['tiktok', 'instagram', 'youtube'],
  },
  {
    title: 'Seed clipping run B',
    type: 'clipping',
    status: 'closed',
    clientIdx: 1,
    budget: 1500000,
    rate: 150,
    platforms: ['tiktok', 'youtube'],
  },
  {
    title: 'Seed logo placement',
    type: 'logo',
    status: 'live',
    clientIdx: 2,
    budget: 1000000,
    rate: 300,
    platforms: ['tiktok', 'instagram'],
  },
  {
    title: 'Seed music sound',
    type: 'music',
    status: 'live',
    clientIdx: 3,
    budget: 3000000,
    rate: 120,
    platforms: ['tiktok'],
  },
  {
    title: 'Seed music closing',
    type: 'music',
    status: 'closing',
    clientIdx: 3,
    budget: 400000,
    rate: 250,
    platforms: ['tiktok', 'instagram'],
  },
  {
    title: 'Seed original content',
    type: 'ugc',
    status: 'live',
    clientIdx: 4,
    budget: 2000000,
    rate: 400,
    platforms: ['youtube', 'instagram', 'x'],
    visibility: 'private',
  },
  {
    title: 'Seed ugc awaiting funds',
    type: 'ugc',
    status: 'awaiting_funding',
    clientIdx: 4,
    budget: 1200000,
    rate: 350,
    platforms: ['tiktok'],
  },
  {
    title: 'Seed clipping draft',
    type: 'clipping',
    status: 'draft',
    clientIdx: 0,
    budget: 800000,
    rate: 180,
    platforms: ['x', 'tiktok'],
  },
]

const bigintSum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n)

export async function seedDev(db: Database) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to run the dev seed in production')
  const rng = makeRng()
  const now = Date.now()
  const day = 86_400_000

  await db.transaction(async (tx) => {
    // Staff ---------------------------------------------------------------
    const staff = await tx
      .insert(users)
      .values(
        ['reviewer', 'finance', 'admin'].map((r) => ({
          email: `${r}@seed.invalid`,
          name: `Seed ${r}`,
          isAdultConfirmed: true,
          adultConfirmedAt: new Date(now - 90 * day),
          termsAcceptedAt: new Date(now - 90 * day),
        })),
      )
      .returning()
    await tx
      .insert(staffRoles)
      .values(staff.map((u, i) => ({ userId: u.id, role: ['reviewer', 'finance', 'admin'][i]! })))
    const reviewer = staff[0]!

    // Creators ------------------------------------------------------------
    const creatorRows = Array.from({ length: 30 }, (_, i) => ({
      email: `creator${String(i + 1).padStart(2, '0')}@seed.invalid`,
      name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
      isPrivateProfile: rng.chance(0.15),
      isAdultConfirmed: true,
      adultConfirmedAt: new Date(now - 60 * day),
      termsAcceptedAt: new Date(now - 60 * day),
    }))
    const creators = await tx.insert(users).values(creatorRows).returning()
    await tx.insert(authIdentities).values(
      creators.map((u) => ({
        userId: u.id,
        type: 'email',
        provider: 'email',
        providerAccountId: u.email,
      })),
    )
    await tx.insert(creatorProfiles).values(
      creators.map((u, i) => ({
        userId: u.id,
        payoutStatus: i % 3 === 0 ? 'verified' : 'none',
        payoutProvider: i % 3 === 0 ? 'stripe_connect' : null,
        payoutProviderRef: i % 3 === 0 ? `seed_acct_${i}` : null,
      })),
    )

    // Linked accounts -------------------------------------------------------
    const accountRows = creators.flatMap((u, ci) => {
      const n = rng.int(1, 2)
      return Array.from({ length: n }, (_, k) => {
        const platform = PLATFORMS[(ci + k) % 4]!
        return {
          creatorId: u.id,
          platform,
          platformUserId: `seed_${platform}_${ci}_${k}`,
          handle: `seed_creator_${ci + 1}_${platform}`,
          linkMethod: platform === 'x' || rng.chance(0.5) ? 'bio_code' : 'oauth',
          verifiedAt: new Date(now - 45 * day),
          followers: rng.int(800, 250000),
          accountCreatedAt: new Date(now - rng.int(100, 1500) * day),
          status: 'verified',
          lastCheckedAt: new Date(now - day),
        }
      })
    })
    const accounts = await tx.insert(linkedAccounts).values(accountRows).returning()

    // Clients ---------------------------------------------------------------
    const clientRows = await tx
      .insert(clients)
      .values(
        [0, 500, 1000, 1500, 750].map((fee, i) => ({
          name: `Seed client ${i + 1} (seed)`,
          contactName: 'Seed contact',
          contactEmail: `client${i + 1}@seed.invalid`,
          serviceFeeBps: fee,
          notes: 'SEED DATA. Not a real client.',
        })),
      )
      .returning()

    // Ledger helpers ------------------------------------------------------
    const accountCache = new Map<string, string>()
    const account = async (kind: string, ownerType: string | null, ownerId: string | null) => {
      const key = `${kind}|${ownerType}|${ownerId}`
      const hit = accountCache.get(key)
      if (hit) return hit
      const found = await tx.execute<{ id: string }>(
        sql`select id from ledger_accounts where kind = ${kind} and owner_type is not distinct from ${ownerType} and owner_id is not distinct from ${ownerId}`,
      )
      let id = found[0]?.id
      if (!id) {
        const [row] = await tx
          .insert(ledgerAccounts)
          .values({ kind, ownerType, ownerId })
          .returning()
        id = row!.id
      }
      accountCache.set(key, id)
      return id
    }
    const post = async (
      kind: string,
      key: string,
      entries: [string, bigint][],
      refs: { campaignId?: string; submissionId?: string; creatorId?: string; memo?: string } = {},
    ) => {
      if (bigintSum(entries.map((e) => e[1])) !== 0n)
        throw new Error(`Unbalanced seed transaction ${key}`)
      const [t] = await tx
        .insert(ledgerTransactions)
        .values({ kind, idempotencyKey: key, memo: refs.memo ?? 'SEED DATA', ...refs })
        .returning()
      await tx.insert(ledgerEntries).values(
        entries.map(([accountId, amountCents]) => ({
          transactionId: t!.id,
          accountId,
          amountCents,
        })),
      )
    }
    const external = await account('external', null, null)
    const revenue = await account('platform_revenue', 'platform', null)

    // Campaigns -------------------------------------------------------------
    const created: {
      id: string
      plan: CampaignPlan
      termsId: string
      rate: number
      capPost: bigint
      capCreator: bigint
      minViews: number
    }[] = []
    for (const plan of PLANS) {
      const client = clientRows[plan.clientIdx]!
      const capPost = 40000n
      const capCreator = 120000n
      const minViews = 1000
      const isClosed = plan.status === 'closed'
      const [c] = await tx
        .insert(campaigns)
        .values({
          clientId: client.id,
          type: plan.type,
          title: plan.title,
          briefMarkdown: 'SEED DATA. Working brief text for development.',
          platforms: plan.platforms,
          budgetCents: BigInt(plan.budget),
          rateCentsPer1000: plan.rate,
          capPerPostCents: capPost,
          capPerCreatorCents: capCreator,
          minViewsToEarn: minViews,
          requireAdDisclosure: true,
          keepLiveDays: 30,
          visibility: plan.visibility ?? 'public',
          accessCode: plan.visibility === 'private' ? 'SEEDCODE' : null,
          startAt: new Date(now - (isClosed ? 60 : 20) * day),
          endAt: isClosed ? new Date(now - 10 * day) : null,
          status: plan.status,
          closedAt: isClosed || plan.status === 'closing' ? new Date(now - 10 * day) : null,
          releaseAt: isClosed
            ? new Date(now - 3 * day)
            : plan.status === 'closing'
              ? new Date(now + 3 * day)
              : null,
        })
        .returning()
      const [terms] = await tx
        .insert(termsVersions)
        .values({
          campaignId: c!.id,
          bodyMarkdown: 'SEED DATA. Working campaign rules.',
          effectiveAt: new Date(now - 30 * day),
        })
        .returning()
      await tx
        .update(campaigns)
        .set({ currentTermsVersionId: terms!.id })
        .where(sql`id = ${c!.id}`)
      created.push({
        id: c!.id,
        plan,
        termsId: terms!.id,
        rate: plan.rate,
        capPost,
        capCreator,
        minViews,
      })

      // Fund live, closing and closed campaigns in full.
      if (['live', 'closing', 'closed'].includes(plan.status)) {
        const B = BigInt(plan.budget)
        const F = (B * BigInt(client.serviceFeeBps) + 5000n) / 10000n // round half up
        const holding = await account('client_funds_holding', 'client', client.id)
        const budgetAcc = await account('campaign_budget', 'campaign', c!.id)
        await post(
          'client_funding_received',
          `seed:funding:${c!.id}`,
          [
            [external, -(B + F)],
            [holding, B + F],
          ],
          { campaignId: c!.id },
        )
        await post(
          'campaign_funded',
          `seed:campaign_funded:${c!.id}`,
          [
            [holding, -B],
            [budgetAcc, B],
          ],
          { campaignId: c!.id },
        )
        if (F > 0n)
          await post(
            'service_fee_taken',
            `seed:fee:${c!.id}`,
            [
              [holding, -F],
              [revenue, F],
            ],
            { campaignId: c!.id },
          )
      }
    }

    // Submissions -----------------------------------------------------------
    const fundedCampaigns = created.filter((c) =>
      ['live', 'closing', 'closed'].includes(c.plan.status),
    )
    const spent = new Map<string, bigint>()
    const creatorEarned = new Map<string, bigint>() // campaign|creator
    const joined = new Set<string>()
    let postCounter = 0
    const stateMix = [
      'earning',
      'earning',
      'earning',
      'earning',
      'approved',
      'needs_review',
      'needs_review',
      'checking',
      'rejected',
      'rejected_auto',
      'flagged',
      'removed',
      'needs_info',
      'appealed',
    ] as const

    for (let n = 0; n < 200; n++) {
      const camp = rng.pick(fundedCampaigns)
      const eligible = accounts.filter((a) =>
        (camp.plan.platforms as string[]).includes(a.platform),
      )
      if (eligible.length === 0) continue
      const acct = rng.pick(eligible)
      const creator = acct.creatorId
      const isClosed = camp.plan.status === 'closed'
      let state: string = isClosed
        ? rng.chance(0.85)
          ? 'paid_out'
          : rng.pick(['rejected', 'removed'] as const)
        : rng.pick(stateMix)
      const flagged = state === 'flagged'
      const earns =
        ['earning', 'approved', 'flagged', 'paid_out', 'appealed'].includes(state) &&
        state !== 'appealed'
      postCounter++
      const submittedAt = new Date(now - rng.int(isClosed ? 15 : 1, isClosed ? 55 : 18) * day)
      const baseline = rng.int(0, 400)
      const finalViews = earns ? baseline + rng.int(300, 300000) : baseline + rng.int(0, 500)
      const counted = earns ? finalViews - baseline : 0

      let earned = 0n
      if (earns && counted >= camp.minViews && camp.plan.status !== 'closing') {
        const raw = BigInt(Math.floor((counted * camp.rate) / 1000))
        const ckey = `${camp.id}|${creator}`
        const creatorRoom = camp.capCreator - (creatorEarned.get(ckey) ?? 0n)
        const budgetLeft = BigInt(camp.plan.budget) - (spent.get(camp.id) ?? 0n)
        earned = [raw, camp.capPost, creatorRoom, budgetLeft].reduce((a, b) => (b < a ? b : a))
        if (earned < 0n) earned = 0n
        spent.set(camp.id, (spent.get(camp.id) ?? 0n) + earned)
        creatorEarned.set(ckey, (creatorEarned.get(ckey) ?? 0n) + earned)
      }
      if (state === 'earning' && earned === 0n) state = 'approved'

      const reason =
        state === 'rejected'
          ? rng.pick(['not_original', 'brand_unsafe', 'missing_hashtag'])
          : state === 'rejected_auto'
            ? rng.pick(['missing_hashtag', 'posted_too_early', 'below_min_duration'])
            : state === 'removed'
              ? 'deleted_or_edited_post'
              : null

      const [sub] = await tx
        .insert(submissions)
        .values({
          campaignId: camp.id,
          creatorId: creator,
          linkedAccountId: acct.id,
          platform: acct.platform,
          postUrl: `https://example.invalid/${acct.platform}/post/${postCounter}`,
          platformPostId: `seed_post_${postCounter}`,
          state,
          reasonCode: reason,
          termsVersionId: camp.termsId,
          rateCentsPer1000Locked: camp.rate,
          publishedAt: new Date(submittedAt.getTime() - rng.int(1, 20) * 3_600_000),
          submittedAt,
          baselineViews: baseline,
          latestViews: finalViews,
          countedViews: counted,
          earnedCents: earned,
          mediaHash: `seedhash${postCounter}`,
        })
        .returning()

      const memberKey = `${camp.id}|${creator}`
      if (!joined.has(memberKey)) {
        joined.add(memberKey)
        await tx.insert(campaignMembers).values({
          campaignId: camp.id,
          creatorId: creator,
          joinedAt: new Date(submittedAt.getTime() - 3_600_000),
        })
      }

      // View snapshots, with a scripted jump on flagged posts.
      if (!['checking', 'rejected_auto'].includes(state)) {
        const steps = 8
        const snaps = Array.from({ length: steps }, (_, i) => {
          const share =
            flagged && i === steps - 2
              ? 0.15
              : flagged && i === steps - 1
                ? 1
                : (i + 1) / (steps * 1.4)
          const views = baseline + Math.floor((finalViews - baseline) * Math.min(1, share))
          return {
            submissionId: sub!.id,
            takenAt: new Date(submittedAt.getTime() + i * 2 * 3_600_000),
            views,
            likes: Math.floor(views * 0.05),
            comments: Math.floor(views * 0.004),
            shares: Math.floor(views * 0.003),
            saves: Math.floor(views * 0.006),
            isPublic: true,
            source: 'provider:mock',
            raw: { seed: true },
          }
        })
        await tx.insert(viewSnapshots).values(snaps)
      }

      if (state === 'flagged')
        await tx.insert(fraudFlags).values({
          submissionId: sub!.id,
          kind: 'view_jump',
          detail: { seed: true, note: 'Scripted jump' },
        })
      if (reason && ['rejected', 'removed'].includes(state))
        await tx.insert(reviewDecisions).values({
          submissionId: sub!.id,
          reviewerId: reviewer.id,
          outcome: state === 'removed' ? 'remove' : 'reject',
          reasonCode: reason,
          note: 'SEED DATA',
        })
      if (state === 'appealed')
        await tx.insert(appeals).values({
          submissionId: sub!.id,
          creatorId: creator,
          message: 'SEED DATA. Working appeal text.',
          dueAt: new Date(now + rng.int(-1, 5) * day),
        })

      // Ledger for earnings and release.
      if (earned > 0n) {
        const budgetAcc = await account('campaign_budget', 'campaign', camp.id)
        const pending = await account('creator_pending', 'creator', creator)
        await post(
          'earning_accrued',
          `seed:earning:${sub!.id}:${counted}`,
          [
            [budgetAcc, -earned],
            [pending, earned],
          ],
          { campaignId: camp.id, submissionId: sub!.id, creatorId: creator },
        )
        if (state === 'paid_out') {
          const available = await account('creator_available', 'creator', creator)
          await post(
            'earnings_released',
            `seed:release:${sub!.id}`,
            [
              [pending, -earned],
              [available, earned],
            ],
            { campaignId: camp.id, submissionId: sub!.id, creatorId: creator },
          )
        }
      }
    }

    // Warnings --------------------------------------------------------------
    await tx.insert(warnings).values(
      [0, 3, 7, 12].map((i) => ({
        creatorId: creators[i]!.id,
        reasonCode: 'not_original',
        note: 'SEED DATA',
        expiresAt: new Date(now + 40 * day),
        createdBy: reviewer.id,
      })),
    )

    // Final check: the funded ledger balances ---------------------------------
    const [tot] = await tx.execute<{ total: string; bad: string }>(sql`
      select coalesce((select sum(amount_cents) from ledger_entries), 0)::text as total,
             (select count(*) from (select transaction_id from ledger_entries group by transaction_id having sum(amount_cents) <> 0) x)::text as bad`)
    if (tot!.total !== '0' || tot!.bad !== '0')
      throw new Error(`Seed ledger does not balance: ${JSON.stringify(tot)}`)
  })
}
