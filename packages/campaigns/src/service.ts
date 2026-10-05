// Campaign actions for staff and creators. Every staff action that changes data writes an audit row
// in the same database transaction. Money moves only through @mde/money.
import { getSetting, tables, writeAudit, type Db, type DbOrTx } from '@mde/db'
import {
  createPgStore,
  fundCampaign as fundCampaignMoney,
  recordClientFunding as recordFundingMoney,
  MoneyError,
} from '@mde/money'
import { and, eq, inArray, sql } from 'drizzle-orm'
import crypto from 'node:crypto'
import type { CampaignForm } from './input'

export class CampaignError extends Error {
  constructor(
    readonly code:
      | 'not_found'
      | 'not_editable'
      | 'locked_after_funding'
      | 'not_funded'
      | 'incomplete'
      | 'wrong_status'
      | 'not_joinable'
      | 'access_code'
      | 'insufficient_client_funds',
    message: string,
  ) {
    super(message)
    this.name = 'CampaignError'
  }
}

type Campaign = typeof tables.campaigns.$inferSelect

async function load(tx: DbOrTx, id: string, lock = false): Promise<Campaign> {
  const q = tx.select().from(tables.campaigns).where(eq(tables.campaigns.id, id))
  const [c] = lock ? await q.for('update') : await q
  if (!c) throw new CampaignError('not_found', 'No such campaign')
  return c
}

/** Has the campaign's budget been moved in from the client (02_DATA_AND_MONEY.md section 4)? */
export async function isFunded(tx: DbOrTx, campaignId: string) {
  const rows = await tx
    .select({ id: tables.ledgerTransactions.id })
    .from(tables.ledgerTransactions)
    .where(
      and(eq(tables.ledgerTransactions.kind, 'campaign_funded'), eq(tables.ledgerTransactions.campaignId, campaignId)),
    )
  return rows.length > 0
}

function columnsFrom(f: CampaignForm) {
  return {
    title: f.title,
    type: f.type,
    clientId: f.clientId,
    coverImageUrl: f.coverImageUrl,
    briefMarkdown: f.briefMarkdown,
    assets: f.assets,
    examplePosts: f.examplePosts,
    platforms: f.platforms,
    budgetCents: f.budgetCents,
    rateCentsPer1000: f.rateCentsPer1000,
    capPerPostCents: f.capPerPostCents,
    capPerCreatorCents: f.capPerCreatorCents,
    minViewsToEarn: f.minViewsToEarn ?? 0,
    minEngagementBps: f.minEngagementBps,
    maxPostsPerAccount: f.maxPostsPerAccount,
    minFollowers: f.minFollowers,
    minAccountAgeDays: f.minAccountAgeDays,
    languages: f.languages,
    allowedRegions: f.allowedRegions,
    blockedRegions: f.blockedRegions,
    requiredHashtags: f.requiredHashtags,
    requireAdDisclosure: f.requireAdDisclosure,
    minDurationSeconds: f.minDurationSeconds,
    keepLiveDays: f.keepLiveDays ?? 30,
    visibility: f.visibility,
    accessCode: f.visibility === 'private' ? f.accessCode : null,
    startAt: f.startAt,
    endAt: f.endAt,
    termsDraftMarkdown: f.termsDraftMarkdown,
    templateFields: f.templateFields,
  }
}

/** A new campaign, saved as a draft. */
export async function createDraft(db: Db, actorId: string, f: CampaignForm) {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .insert(tables.campaigns)
      .values({
        ...columnsFrom(f),
        budgetCents: f.budgetCents!,
        rateCentsPer1000: f.rateCentsPer1000!,
        status: 'draft',
      })
      .returning()
    await writeAudit(tx, { actorId, action: 'campaign.create', entity: 'campaign', entityId: c!.id, after: c })
    return c!
  })
}

// Once funded, the budget is fixed. Once live, the money rules that existing posts were earned under
// (budget, caps, minimum views) and the type stay as they are. The rate may change: existing posts keep
// their locked rate (section 5.6).
const LOCKED_AFTER_FUNDING = ['budgetCents'] as const
const LOCKED_AFTER_LIVE = [
  'budgetCents',
  'capPerPostCents',
  'capPerCreatorCents',
  'minViewsToEarn',
  'type',
  'clientId',
] as const

/** Save changes. Rule text changes on a published campaign become a new terms version. */
export async function updateCampaign(db: Db, actorId: string, id: string, f: CampaignForm) {
  return db.transaction(async (tx) => {
    const before = await load(tx, id, true)
    if (['closed', 'cancelled'].includes(before.status))
      throw new CampaignError('not_editable', 'Closed and cancelled campaigns cannot be edited.')
    const next = columnsFrom(f)
    const funded = await isFunded(tx, id)
    const published = ['live', 'closing'].includes(before.status)
    const locked: readonly string[] = published ? LOCKED_AFTER_LIVE : funded ? LOCKED_AFTER_FUNDING : []
    for (const k of locked) {
      const a = before[k as keyof Campaign]
      const b = next[k as keyof typeof next]
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null))
        throw new CampaignError(
          'locked_after_funding',
          `${labelFor(k)} cannot change once the campaign is ${published ? 'live' : 'funded'}.`,
        )
    }
    const [after] = await tx
      .update(tables.campaigns)
      .set({ ...next, budgetCents: next.budgetCents!, rateCentsPer1000: next.rateCentsPer1000! })
      .where(eq(tables.campaigns.id, id))
      .returning()
    await writeAudit(tx, { actorId, action: 'campaign.update', entity: 'campaign', entityId: id, before, after })
    if (published) await saveTermsVersionTx(tx, actorId, after!)
    return after!
  })
}

const labelFor = (k: string) =>
  ({
    budgetCents: 'The budget',
    capPerPostCents: 'The cap per post',
    capPerCreatorCents: 'The cap per creator',
    minViewsToEarn: 'The minimum views',
    type: 'The type',
    clientId: 'The client',
  })[k] ?? k

/** Save the rules text as a new terms version when it differs from the one in force. */
async function saveTermsVersionTx(tx: DbOrTx, actorId: string, c: Campaign) {
  const body = (c.termsDraftMarkdown ?? '').trim()
  if (!body) return null
  if (c.currentTermsVersionId) {
    const [cur] = await tx
      .select()
      .from(tables.termsVersions)
      .where(eq(tables.termsVersions.id, c.currentTermsVersionId))
    if (cur && cur.bodyMarkdown === body) return cur
  }
  const [v] = await tx
    .insert(tables.termsVersions)
    .values({ campaignId: c.id, bodyMarkdown: body, effectiveAt: new Date() })
    .returning()
  await tx.update(tables.campaigns).set({ currentTermsVersionId: v!.id }).where(eq(tables.campaigns.id, c.id))
  await writeAudit(tx, {
    actorId,
    action: 'terms.create',
    entity: 'campaign',
    entityId: c.id,
    after: { termsVersionId: v!.id },
  })
  return v!
}

/** What must be filled in before a campaign can be published. */
export function missingForPublish(c: Campaign): string[] {
  const missing: string[] = []
  if (!c.clientId) missing.push('client')
  if (!c.briefMarkdown) missing.push('brief')
  if (!c.coverImageUrl) missing.push('cover image')
  if (!(c.termsDraftMarkdown ?? '').trim()) missing.push('rules text')
  if (c.platforms.length === 0) missing.push('platforms')
  return missing
}

/**
 * Publish: lock the rules as a terms version and go live, but only when fully funded. An unfunded
 * campaign waits as awaiting_funding and goes live the moment it is funded.
 */
export async function publishCampaign(db: Db, actorId: string, id: string) {
  return db.transaction(async (tx) => {
    const c = await load(tx, id, true)
    if (!['draft', 'awaiting_funding'].includes(c.status))
      throw new CampaignError('wrong_status', `A ${c.status} campaign cannot be published.`)
    const missing = missingForPublish(c)
    if (missing.length) throw new CampaignError('incomplete', `Add the ${missing.join(', ')} before publishing.`)
    await saveTermsVersionTx(tx, actorId, c)
    const status = (await isFunded(tx, id)) ? 'live' : 'awaiting_funding'
    await tx.update(tables.campaigns).set({ status }).where(eq(tables.campaigns.id, id))
    await writeAudit(tx, {
      actorId,
      action: 'campaign.publish',
      entity: 'campaign',
      entityId: id,
      before: { status: c.status },
      after: { status },
    })
    return status
  })
}

/** Record money received from a client (finance). */
export async function recordClientFunding(
  db: Db,
  actorId: string,
  i: { clientId: string; amountCents: number; reference: string },
) {
  return recordFundingMoney(createPgStore(db), { ...i, actorId })
}

/** Move the budget and fee from the client's balance into the campaign. Goes live if it was waiting. */
export async function fundCampaign(db: Db, actorId: string, id: string) {
  const c = await load(db, id)
  if (['closed', 'cancelled'].includes(c.status))
    throw new CampaignError('wrong_status', `A ${c.status} campaign cannot be funded.`)
  try {
    await fundCampaignMoney(createPgStore(db), { campaignId: id, actorId })
  } catch (e) {
    if (e instanceof MoneyError && e.code === 'insufficient_client_funds')
      throw new CampaignError(
        'insufficient_client_funds',
        'The client has not paid enough for this budget and fee yet.',
      )
    throw e
  }
  return db.transaction(async (tx) => {
    const now = await load(tx, id, true)
    if (now.status === 'awaiting_funding') {
      await tx.update(tables.campaigns).set({ status: 'live' }).where(eq(tables.campaigns.id, id))
      await writeAudit(tx, {
        actorId,
        action: 'campaign.live',
        entity: 'campaign',
        entityId: id,
        before: { status: now.status },
        after: { status: 'live' },
      })
      return 'live'
    }
    return now.status
  })
}

/** Copy a campaign as a new draft in the same series (for a standing client's next month). */
export async function copyCampaign(db: Db, actorId: string, id: string) {
  return db.transaction(async (tx) => {
    const c = await load(tx, id)
    const [copy] = await tx
      .insert(tables.campaigns)
      .values({
        clientId: c.clientId,
        seriesId: c.seriesId ?? c.id,
        type: c.type,
        title: c.title,
        coverImageUrl: c.coverImageUrl,
        briefMarkdown: c.briefMarkdown,
        assets: c.assets,
        examplePosts: c.examplePosts,
        platforms: c.platforms,
        budgetCents: c.budgetCents,
        rateCentsPer1000: c.rateCentsPer1000,
        capPerPostCents: c.capPerPostCents,
        capPerCreatorCents: c.capPerCreatorCents,
        minViewsToEarn: c.minViewsToEarn,
        minEngagementBps: c.minEngagementBps,
        maxPostsPerAccount: c.maxPostsPerAccount,
        minFollowers: c.minFollowers,
        minAccountAgeDays: c.minAccountAgeDays,
        languages: c.languages,
        allowedRegions: c.allowedRegions,
        blockedRegions: c.blockedRegions,
        requiredHashtags: c.requiredHashtags,
        requireAdDisclosure: c.requireAdDisclosure,
        minDurationSeconds: c.minDurationSeconds,
        keepLiveDays: c.keepLiveDays,
        visibility: c.visibility,
        accessCode: c.accessCode,
        templateFields: c.templateFields,
        termsDraftMarkdown: c.termsDraftMarkdown,
        status: 'draft',
      })
      .returning()
    if (!c.seriesId) await tx.update(tables.campaigns).set({ seriesId: c.id }).where(eq(tables.campaigns.id, c.id))
    await writeAudit(tx, {
      actorId,
      action: 'campaign.copy',
      entity: 'campaign',
      entityId: copy!.id,
      after: { copiedFrom: c.id },
    })
    return copy!
  })
}

/**
 * Close a campaign (02_DATA_AND_MONEY.md section 5.4): no new earnings, posts in approved or earning
 * become final, and earnings are released after the review window. actorId is null for the job.
 */
export async function closeCampaign(tx: DbOrTx, actorId: string | null, id: string, now = new Date()) {
  const c = await load(tx, id, true)
  if (!['live', 'closing'].includes(c.status))
    throw new CampaignError('wrong_status', `A ${c.status} campaign cannot be closed.`)
  const days = await getSetting(tx, 'review_window_days')
  const releaseAt = new Date(now.getTime() + days * 86_400_000)
  await tx
    .update(tables.campaigns)
    .set({ status: 'closed', closedAt: now, releaseAt })
    .where(eq(tables.campaigns.id, id))
  await tx
    .update(tables.submissions)
    .set({ state: 'final' })
    .where(and(eq(tables.submissions.campaignId, id), inArray(tables.submissions.state, ['approved', 'earning'])))
  await writeAudit(tx, {
    actorId,
    action: 'campaign.close',
    entity: 'campaign',
    entityId: id,
    before: { status: c.status },
    after: { status: 'closed', releaseAt },
  })
}

/** Cancel a campaign that was never funded. A funded campaign is closed instead. */
export async function cancelCampaign(db: Db, actorId: string, id: string) {
  return db.transaction(async (tx) => {
    const c = await load(tx, id, true)
    if (!['draft', 'awaiting_funding'].includes(c.status))
      throw new CampaignError(
        'wrong_status',
        'Only campaigns that are not live can be cancelled. Close a live campaign instead.',
      )
    if (await isFunded(tx, id))
      throw new CampaignError(
        'wrong_status',
        'This campaign is funded. Close it instead so the budget is accounted for.',
      )
    await tx.update(tables.campaigns).set({ status: 'cancelled' }).where(eq(tables.campaigns.id, id))
    await writeAudit(tx, {
      actorId,
      action: 'campaign.cancel',
      entity: 'campaign',
      entityId: id,
      before: { status: c.status },
      after: { status: 'cancelled' },
    })
  })
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a.trim().toUpperCase())
  const y = Buffer.from(b.trim().toUpperCase())
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

/** A creator joins a live campaign. Private campaigns need their access code. Joining twice is fine. */
export async function joinCampaign(db: Db, creatorId: string, id: string, accessCode?: string) {
  const c = await load(db, id)
  if (!['live'].includes(c.status))
    throw new CampaignError('not_joinable', 'This campaign is not open to new creators.')
  if (c.visibility === 'private' && !(accessCode && c.accessCode && safeEqual(accessCode, c.accessCode)))
    throw new CampaignError(
      'access_code',
      'That access code is not right. Check it with the person who shared the campaign.',
    )
  await db.insert(tables.campaignMembers).values({ campaignId: id, creatorId }).onConflictDoNothing()
}

export async function isMember(db: DbOrTx, creatorId: string, campaignId: string) {
  const rows = await db.execute(
    sql`select 1 from campaign_members where campaign_id = ${campaignId} and creator_id = ${creatorId}`,
  )
  return rows.length > 0
}

/** Create a client record (finance). */
export async function createClient(
  db: Db,
  actorId: string,
  i: {
    name: string
    contactName: string | null
    contactEmail: string | null
    serviceFeeBps: number
    notes: string | null
  },
) {
  return db.transaction(async (tx) => {
    const [c] = await tx.insert(tables.clients).values(i).returning()
    await writeAudit(tx, { actorId, action: 'client.create', entity: 'client', entityId: c!.id, after: c })
    return c!
  })
}

export async function updateClient(
  db: Db,
  actorId: string,
  id: string,
  i: {
    name: string
    contactName: string | null
    contactEmail: string | null
    serviceFeeBps: number
    notes: string | null
  },
) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(tables.clients).where(eq(tables.clients.id, id)).for('update')
    if (!before) throw new CampaignError('not_found', 'No such client')
    const [after] = await tx.update(tables.clients).set(i).where(eq(tables.clients.id, id)).returning()
    await writeAudit(tx, { actorId, action: 'client.update', entity: 'client', entityId: id, before, after })
    return after!
  })
}
