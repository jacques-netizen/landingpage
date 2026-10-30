import 'server-only'
import { db, tables, writeAudit } from '@mde/db'
import { parsePostUrl } from '@mde/platforms'
import { approve, ReviewError } from '@mde/review'
import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { csvRecords } from '@/lib/csv'

// Add posts to a campaign from a CSV (owner request, 2026-10-30): staff upload a file of post links and
// the clipper each belongs to. Each post goes in as if the clipper had submitted it, at the campaign's
// rate, and waits for review; with "approved" in the status column it is approved at once through the
// same review step as the Review tab, so earnings, notifications and the audit log work as usual. Its
// views are read by the next check, like any new post. Nothing is changed for a row that fails.

export const MAX_ROWS = 2000
const URL_COLUMNS = ['url', 'post_url', 'link', 'post', 'post_link']
const CLIPPER_COLUMNS = ['clipper', 'username', 'email', 'creator', 'handle', 'user']

export type ImportRow = { row: number; url: string; result: 'added' | 'approved' | 'skipped' | 'error'; detail: string }
export type ImportResult =
  | { ok: true; added: number; approved: number; skipped: number; errors: number; rows: ImportRow[] }
  | { ok: false; error: string }

const pick = (r: Record<string, string>, names: string[]) => names.map((n) => r[n]).find((v) => v && v.trim()) ?? ''

export async function importSubmissionsCsv(campaignId: string, staffId: string, text: string): Promise<ImportResult> {
  const d = db()
  const [c] = await d.select().from(tables.campaigns).where(eq(tables.campaigns.id, campaignId))
  if (!c || c.deletedAt) return { ok: false, error: 'That campaign is gone.' }
  if (!['live', 'closing'].includes(c.status) || !c.currentTermsVersionId)
    return { ok: false, error: 'Posts can only be added to a live campaign. Resume it first if it has ended.' }
  const { header, records } = csvRecords(text)
  if (!URL_COLUMNS.some((h) => header.includes(h)))
    return { ok: false, error: 'The file needs a "url" column with the post links.' }
  if (!CLIPPER_COLUMNS.some((h) => header.includes(h)))
    return { ok: false, error: 'The file needs a "clipper" column with each clipper’s username or email.' }
  if (!records.length) return { ok: false, error: 'The file has no rows under its header.' }
  if (records.length > MAX_ROWS) return { ok: false, error: `Up to ${MAX_ROWS.toLocaleString('en-US')} rows a file.` }

  const rows: ImportRow[] = []
  const seen = new Set<string>()
  for (const [i, r] of records.entries()) {
    const n = i + 2 // the spreadsheet's row number, after the header
    const url = pick(r, URL_COLUMNS).trim()
    const who = pick(r, CLIPPER_COLUMNS).trim().replace(/^@/, '')
    // Matched as typed, case aside: no wildcards.
    const like = who.replace(/[\\%_]/g, '\\$&')
    const wantApproved = /^(approved?|yes|y|true|1)$/i.test((r.status ?? r.approve ?? '').trim())
    const fail = (detail: string) => rows.push({ row: n, url, result: 'error', detail })
    const post = parsePostUrl(url)
    if (!post) {
      fail('Not a TikTok, Instagram, YouTube or X post link.')
      continue
    }
    if (!c.platforms.includes(post.platform)) {
      fail(`This campaign does not take ${post.platform} posts.`)
      continue
    }
    const key = `${post.platform}:${post.platformPostId}`
    if (seen.has(key)) {
      rows.push({ row: n, url, result: 'skipped', detail: 'The same post is higher up in the file.' })
      continue
    }
    seen.add(key)
    if (!who) {
      fail('No clipper given.')
      continue
    }
    // The clipper: by username or email, else by a linked account with that handle.
    const [user] = await d
      .select({ id: tables.users.id })
      .from(tables.users)
      .where(or(ilike(tables.users.username, like), ilike(tables.users.email, like)))
      .limit(2)
    let creatorId = user?.id ?? null
    const accounts = await d
      .select()
      .from(tables.linkedAccounts)
      .where(
        and(
          eq(tables.linkedAccounts.platform, post.platform),
          sql`${tables.linkedAccounts.status} <> 'removed'`,
          creatorId ? eq(tables.linkedAccounts.creatorId, creatorId) : ilike(tables.linkedAccounts.handle, like),
        ),
      )
    if (!creatorId && accounts.length) creatorId = accounts[0]!.creatorId
    if (!creatorId) {
      fail(`No clipper with the username, email or ${post.platform} handle "${who}".`)
      continue
    }
    const account =
      accounts.find((a) => post.handle && a.handle.toLowerCase() === post.handle.toLowerCase()) ??
      (accounts.length === 1 ? accounts[0] : undefined)
    const now = new Date()
    await d.insert(tables.campaignMembers).values({ campaignId, creatorId }).onConflictDoNothing()
    const [s] = await d
      .insert(tables.submissions)
      .values({
        campaignId,
        creatorId,
        linkedAccountId: account?.id ?? null,
        platform: post.platform,
        postUrl: url,
        platformPostId: post.platformPostId,
        state: 'needs_review',
        termsVersionId: c.currentTermsVersionId,
        rateCentsPer1000Locked: c.rateCentsPer1000,
        submittedAt: now,
        baselineViews: 0,
        checkResults: [],
        creatorNote: 'Added by staff from a CSV.',
        nextCheckAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: tables.submissions.id })
    if (!s) {
      rows.push({ row: n, url, result: 'skipped', detail: 'Already in this campaign.' })
      continue
    }
    if (!wantApproved) {
      rows.push({ row: n, url, result: 'added', detail: 'Waiting for review.' })
      continue
    }
    try {
      await approve(d, staffId, s.id, { note: 'Approved on import from a CSV.' })
      rows.push({ row: n, url, result: 'approved', detail: 'Approved; views are read at the next check.' })
    } catch (err) {
      rows.push({
        row: n,
        url,
        result: 'added',
        detail: `Added, not approved: ${err instanceof ReviewError ? err.message : 'approval failed'}.`,
      })
    }
  }
  const count = (k: ImportRow['result']) => rows.filter((r) => r.result === k).length
  const summary = {
    added: count('added') + count('approved'),
    approved: count('approved'),
    skipped: count('skipped'),
    errors: count('error'),
  }
  await writeAudit(d, {
    actorId: staffId,
    action: 'submissions.csv_import',
    entity: 'campaign',
    entityId: campaignId,
    after: { ...summary, rows: records.length },
  })
  return { ok: true, ...summary, rows }
}
