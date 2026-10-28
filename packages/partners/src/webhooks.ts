import { createHash, createHmac, randomBytes } from 'node:crypto'
import { tables, type DbOrTx } from '@mde/db'
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'
import { clipsById, getCampaign, type ApiCampaign, type ApiClip } from './data'
import type { PartnerKey } from './keys'

// Webhooks for partners (owner decision, 2026-10-28). A job looks for what happened since it last
// looked (posts approved, new view figures, campaigns starting and ending), makes one event for each,
// and delivers it to every webhook whose key may see that campaign. Every delivery is signed with the
// webhook's secret; a failed one is tried again with growing waits for about a day, then given up.
// Nothing in the money or review code changes for this: events are read from what those already write.

export const WEBHOOK_EVENTS = tables.WEBHOOK_EVENTS
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]
export type Webhook = typeof tables.partnerWebhooks.$inferSelect

/** Waits after each failed attempt; after the last one the delivery is marked failed. */
const RETRY_MINUTES = [1, 5, 30, 120, 360, 720, 1440]
const TIMEOUT_MS = 10_000
const MAX_WEBHOOKS_PER_KEY = 5

export class WebhookError extends Error {}

/** Only public https addresses: never this server, a private network or a bare IP address. */
export function checkWebhookUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new WebhookError('The url is not a valid address.')
  }
  if (url.protocol !== 'https:') throw new WebhookError('The url must start with https://.')
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^[\d.]+$/.test(host) ||
    host.includes(':') ||
    !host.includes('.')
  )
    throw new WebhookError('The url must be a public domain name.')
  if (url.username || url.password) throw new WebhookError('The url must not contain a user name or password.')
  return url.toString()
}

export async function createWebhook(db: DbOrTx, key: PartnerKey, input: { url: string; events: string[] }) {
  const url = checkWebhookUrl(input.url)
  const events = [...new Set(input.events)]
  if (!events.length) throw new WebhookError('Choose at least one event.')
  const unknown = events.filter((e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e))
  if (unknown.length) throw new WebhookError(`Unknown event: ${unknown.join(', ')}.`)
  const existing = await listWebhooks(db, key)
  if (existing.length >= MAX_WEBHOOKS_PER_KEY)
    throw new WebhookError(`A key can have up to ${MAX_WEBHOOKS_PER_KEY} webhooks. Delete one first.`)
  const secret = `whsec_${randomBytes(24).toString('base64url')}`
  const [row] = await db.insert(tables.partnerWebhooks).values({ keyId: key.id, url, secret, events }).returning()
  return { webhook: toApi(row!), secret }
}

export async function listWebhooks(db: DbOrTx, key: PartnerKey) {
  return db
    .select()
    .from(tables.partnerWebhooks)
    .where(and(eq(tables.partnerWebhooks.keyId, key.id), isNull(tables.partnerWebhooks.disabledAt)))
    .orderBy(asc(tables.partnerWebhooks.createdAt))
}

export async function deleteWebhook(db: DbOrTx, key: PartnerKey, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false
  const rows = await db
    .update(tables.partnerWebhooks)
    .set({ disabledAt: new Date() })
    .where(
      and(
        eq(tables.partnerWebhooks.id, id),
        eq(tables.partnerWebhooks.keyId, key.id),
        isNull(tables.partnerWebhooks.disabledAt),
      ),
    )
    .returning({ id: tables.partnerWebhooks.id })
  return rows.length > 0
}

export const toApi = (w: Webhook) => ({
  id: w.id,
  object: 'webhook' as const,
  url: w.url,
  events: w.events,
  created_at: w.createdAt.toISOString(),
})

/** The signature header: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>" with the secret>`. */
export function sign(secret: string, body: string, at: Date) {
  const t = Math.floor(at.getTime() / 1000)
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  return `t=${t},v1=${v1}`
}

type Found = {
  type: WebhookEvent
  /** The same for one happening, whichever webhook it goes to. */
  key: string
  campaignId: string
  clipId: string | null
  at: Date
}

const eventId = (key: string) => `evt_${createHash('sha256').update(key).digest('hex').slice(0, 24)}`

async function cursor(db: DbOrTx, name: string, now: Date) {
  const [c] = await db.select().from(tables.webhookCursors).where(eq(tables.webhookCursors.name, name))
  if (c) return c.at
  // The first run starts from now: events are about what happens from here on, not history.
  await db.insert(tables.webhookCursors).values({ name, at: now }).onConflictDoNothing()
  return now
}

async function findEvents(db: DbOrTx, now: Date): Promise<{ found: Found[]; until: Date }> {
  const from = await cursor(db, 'events', now)
  const found: Found[] = []
  if (from >= now) return { found, until: now }
  const approved = await db.execute<{ id: string; submission_id: string; campaign_id: string; at: Date }>(sql`
    select d.id, d.submission_id, s.campaign_id, d.created_at as at from review_decisions d
    join submissions s on s.id = d.submission_id
    where d.outcome = 'approve' and d.created_at > ${from.toISOString()}::timestamptz
      and d.created_at <= ${now.toISOString()}::timestamptz`)
  for (const r of approved)
    found.push({
      type: 'clip.approved',
      key: `clip.approved:${r.id}`,
      campaignId: r.campaign_id,
      clipId: r.submission_id,
      at: new Date(r.at),
    })
  // New view figures: each post's newest reading in the window, when it differs from the one before.
  const views = await db.execute<{ id: number; submission_id: string; campaign_id: string; at: Date }>(sql`
    select distinct on (x.submission_id) x.id, x.submission_id, x.campaign_id, x.taken_at as at from (
      select v.id, v.submission_id, s.campaign_id, v.taken_at, v.views,
        lag(v.views) over (partition by v.submission_id order by v.taken_at) as before
      from view_snapshots v join submissions s on s.id = v.submission_id
      where s.state in ('approved', 'earning', 'final') and v.views is not null
        and v.taken_at > ${from.toISOString()}::timestamptz - interval '2 days'
        and v.taken_at <= ${now.toISOString()}::timestamptz
    ) x
    where x.taken_at > ${from.toISOString()}::timestamptz and x.views is distinct from x.before
    order by x.submission_id, x.taken_at desc`)
  for (const r of views)
    found.push({
      type: 'clip.views_updated',
      key: `clip.views_updated:${r.id}`,
      campaignId: r.campaign_id,
      clipId: r.submission_id,
      at: new Date(r.at),
    })
  const started = await db.execute<{ id: string; at: Date }>(sql`
    select a.entity_id as id, min(a.created_at) as at from audit_log a
    where a.action in ('campaign.publish', 'campaign.live', 'campaign.reopen') and a.entity = 'campaign'
      and a.created_at > ${from.toISOString()}::timestamptz and a.created_at <= ${now.toISOString()}::timestamptz
    group by a.entity_id`)
  for (const r of started)
    found.push({
      type: 'campaign.started',
      key: `campaign.started:${r.id}:${new Date(r.at).toISOString()}`,
      campaignId: r.id,
      clipId: null,
      at: new Date(r.at),
    })
  const ended = await db.execute<{ id: string; at: Date }>(sql`
    select id, closed_at as at from campaigns
    where status in ('closed', 'cancelled') and closed_at > ${from.toISOString()}::timestamptz
      and closed_at <= ${now.toISOString()}::timestamptz`)
  for (const r of ended)
    found.push({
      type: 'campaign.ended',
      key: `campaign.ended:${r.id}:${new Date(r.at).toISOString()}`,
      campaignId: r.id,
      clipId: null,
      at: new Date(r.at),
    })
  return { found, until: now }
}

/** Turn what happened since the last run into deliveries, one per event and matching webhook. */
export async function queueWebhookEvents(db: DbOrTx, now = new Date()) {
  const { found, until } = await findEvents(db, now)
  let queued = 0
  if (found.length) {
    const hooks = await db
      .select({ hook: tables.partnerWebhooks, key: tables.partnerKeys })
      .from(tables.partnerWebhooks)
      .innerJoin(tables.partnerKeys, eq(tables.partnerKeys.id, tables.partnerWebhooks.keyId))
      .where(and(isNull(tables.partnerWebhooks.disabledAt), isNull(tables.partnerKeys.revokedAt)))
    if (hooks.length) {
      const clips = await clipsById(db, [...new Set(found.map((f) => f.clipId).filter((x): x is string => !!x))])
      const campaigns = new Map<string, ApiCampaign | null>()
      for (const { hook, key } of hooks) {
        for (const f of found) {
          if (!hook.events.includes(f.type)) continue
          // The campaign as this key sees it: null when the key may not see it.
          const ck = `${key.id}:${f.campaignId}`
          if (!campaigns.has(ck)) campaigns.set(ck, await getCampaign(db, key, process.env.APP_URL ?? '', f.campaignId))
          const campaign = campaigns.get(ck)
          if (!campaign) continue
          const clip: ApiClip | undefined = f.clipId ? clips.get(f.clipId) : undefined
          if (f.clipId && !clip) continue
          const id = eventId(f.key)
          const payload = {
            id,
            object: 'event',
            type: f.type,
            created_at: f.at.toISOString(),
            livemode: key.mode === 'live',
            data: clip ? { clip, campaign } : { campaign },
          }
          const rows = await db
            .insert(tables.webhookDeliveries)
            .values({ webhookId: hook.id, eventId: id, event: f.type, payload, nextAttemptAt: now })
            .onConflictDoNothing()
            .returning({ id: tables.webhookDeliveries.id })
          queued += rows.length
        }
      }
    }
  }
  await db
    .insert(tables.webhookCursors)
    .values({ name: 'events', at: until })
    .onConflictDoUpdate({ target: tables.webhookCursors.name, set: { at: until } })
  return { events: found.length, queued }
}

export type Send = (url: string, init: RequestInit) => Promise<{ status: number }>

/** Send the deliveries that are due. A 2xx answer within 10 seconds counts as delivered. */
export async function deliverWebhooks(db: DbOrTx, opts: { now?: Date; send?: Send; limit?: number } = {}) {
  const now = opts.now ?? new Date()
  const send: Send = opts.send ?? ((url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }))
  const due = await db
    .select({ d: tables.webhookDeliveries, hook: tables.partnerWebhooks })
    .from(tables.webhookDeliveries)
    .innerJoin(tables.partnerWebhooks, eq(tables.partnerWebhooks.id, tables.webhookDeliveries.webhookId))
    .where(
      and(
        isNull(tables.webhookDeliveries.deliveredAt),
        isNull(tables.webhookDeliveries.failedAt),
        lte(tables.webhookDeliveries.nextAttemptAt, now),
      ),
    )
    .orderBy(asc(tables.webhookDeliveries.nextAttemptAt))
    .limit(opts.limit ?? 50)
  let delivered = 0
  let failed = 0
  for (const { d, hook } of due) {
    // A webhook deleted since the event was queued gets nothing more.
    if (hook.disabledAt) {
      await db
        .update(tables.webhookDeliveries)
        .set({ failedAt: now, lastError: 'Webhook deleted' })
        .where(eq(tables.webhookDeliveries.id, d.id))
      continue
    }
    const body = JSON.stringify(d.payload)
    let status: number | null = null
    let error: string | null = null
    try {
      status = (
        await send(hook.url, {
          method: 'POST',
          body,
          redirect: 'manual',
          headers: {
            'content-type': 'application/json',
            'user-agent': 'MaisonDElites-Webhooks/1.0',
            'mde-event': d.event,
            'mde-delivery': d.id,
            'mde-signature': sign(hook.secret, body, now),
          },
        })
      ).status
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
    const attempts = d.attempts + 1
    if (status !== null && status >= 200 && status < 300) {
      delivered++
      await db
        .update(tables.webhookDeliveries)
        .set({ attempts, lastStatus: status, lastError: null, deliveredAt: now, nextAttemptAt: null })
        .where(eq(tables.webhookDeliveries.id, d.id))
    } else {
      const wait = RETRY_MINUTES[attempts - 1]
      if (wait === undefined) failed++
      await db
        .update(tables.webhookDeliveries)
        .set({
          attempts,
          lastStatus: status,
          lastError: (error ?? `Answered ${status}`).slice(0, 500),
          nextAttemptAt: wait === undefined ? null : new Date(now.getTime() + wait * 60_000),
          failedAt: wait === undefined ? now : null,
        })
        .where(eq(tables.webhookDeliveries.id, d.id))
    }
  }
  return { due: due.length, delivered, failed }
}
