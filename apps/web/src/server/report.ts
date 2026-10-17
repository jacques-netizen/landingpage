import 'server-only'
import {
  campaignReport,
  forClient,
  type CampaignReport,
  type ReportQuery,
  type ReportSort,
  type ReportStatus,
} from '@mde/campaigns'
import { env } from '@mde/config'
import { db, tables, writeAudit } from '@mde/db'
import { eq } from 'drizzle-orm'
import { newReportSecret, readReportToken, reportKey, signReportToken, verifyReportToken } from '@/lib/report-token'
import { redis } from './rate-limit'

// The client's report link (client report brief, 2026-10-12). The token names the campaign and is
// signed with a key made from the server secret and the campaign's own report secret, so revoking
// means rotating that secret. The report JSON is cached in Redis for 60 seconds per token and query.

const CACHE_SECONDS = 60

/** The campaign a report token opens, or null when the token is wrong, expired or revoked. */
export async function campaignForReportToken(
  token: string,
): Promise<{ id: string; title: string; demo: boolean } | null> {
  const claim = readReportToken(token)
  if (!claim) return null
  const [c] = await db()
    .select({
      id: tables.campaigns.id,
      title: tables.campaigns.title,
      secret: tables.campaigns.reportSecret,
      deletedAt: tables.campaigns.deletedAt,
      demo: tables.campaigns.demo,
    })
    .from(tables.campaigns)
    .where(eq(tables.campaigns.id, claim.c))
  if (!c || c.deletedAt || !c.secret) return null
  const ok = verifyReportToken(token, reportKey(env().AUTH_SECRET, c.secret))
  return ok ? { id: c.id, title: c.title, demo: c.demo } : null
}

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'x']
const STATUSES: ReportStatus[] = ['approved', 'pending', 'rejected']
const SORTS: ReportSort[] = ['views', 'newest', 'spend']
const dayOf = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null)

/** The page's query string as a report query; anything unknown is ignored. */
export function parseReportQuery(sp: URLSearchParams): ReportQuery {
  const status = sp.get('status')
  const platform = sp.get('platform')
  const sort = sp.get('sort')
  return {
    sort: sort && SORTS.includes(sort as ReportSort) ? (sort as ReportSort) : 'views',
    from: dayOf(sp.get('from')),
    to: dayOf(sp.get('to')),
    mode: sp.get('mode') === 'paid' ? 'paid' : 'all',
    page: Math.max(1, Math.min(10_000, Number(sp.get('page')) || 1)),
    platform: platform && PLATFORMS.includes(platform) ? platform : null,
    status: status && STATUSES.includes(status as ReportStatus) ? (status as ReportStatus) : null,
  }
}

/** The query string that identifies a cached report, in a fixed order. */
export function reportCacheKey(token: string, q: ReportQuery) {
  const parts = [
    q.from ? q.from.toISOString().slice(0, 10) : '',
    q.to ? q.to.toISOString().slice(0, 10) : '',
    q.mode,
    String(q.page),
    q.platform ?? '',
    q.status ?? '',
    q.sort ?? 'views',
  ]
  return `report:v2:${token}:${parts.join('|')}`
}

/** The report, from Redis when a copy under 60 seconds old exists, else from Postgres (and then cached). */
export async function cachedReport(token: string, campaignId: string, q: ReportQuery): Promise<CampaignReport | null> {
  const key = reportCacheKey(token, q)
  try {
    const hit = await redis().get(key)
    if (hit) return JSON.parse(hit) as CampaignReport
  } catch (err) {
    console.error(JSON.stringify({ level: 'warn', msg: 'report cache read failed', err: String(err) }))
  }
  // Clients see every amount at their rate, not the clippers' (owner rule, 2026-10-17).
  const raw = await campaignReport(db(), campaignId, q)
  const report = raw ? forClient(raw) : null
  if (report)
    redis()
      .set(key, JSON.stringify(report), 'EX', CACHE_SECONDS)
      .catch((err) =>
        console.error(JSON.stringify({ level: 'warn', msg: 'report cache write failed', err: String(err) })),
      )
  return report
}

/** A fresh link for the campaign's client. The campaign gets a report secret the first time. Audited. */
export async function issueReportLink(campaignId: string, actorId: string): Promise<string> {
  const d = db()
  const [c] = await d
    .select({ secret: tables.campaigns.reportSecret })
    .from(tables.campaigns)
    .where(eq(tables.campaigns.id, campaignId))
  if (!c) throw new Error('No such campaign')
  let secret = c.secret
  if (!secret) {
    secret = newReportSecret()
    await d.update(tables.campaigns).set({ reportSecret: secret }).where(eq(tables.campaigns.id, campaignId))
  }
  const token = signReportToken(
    { c: campaignId, iat: Math.floor(Date.now() / 1000) },
    reportKey(env().AUTH_SECRET, secret),
  )
  await writeAudit(d, {
    actorId,
    action: 'campaign.report_link_issued',
    entity: 'campaign',
    entityId: campaignId,
    after: { issuedAt: new Date().toISOString() },
  })
  return `${env().APP_URL}/r/${token}`
}

/** Every link issued so far stops working: the campaign gets a new report secret. Audited. */
export async function revokeReportLinks(campaignId: string, actorId: string) {
  await db()
    .update(tables.campaigns)
    .set({ reportSecret: newReportSecret() })
    .where(eq(tables.campaigns.id, campaignId))
  await writeAudit(db(), {
    actorId,
    action: 'campaign.report_links_revoked',
    entity: 'campaign',
    entityId: campaignId,
    after: { revokedAt: new Date().toISOString() },
  })
}
