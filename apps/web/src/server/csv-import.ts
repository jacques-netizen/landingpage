import 'server-only'
import { db, tables, writeAudit } from '@mde/db'
import { parsePostUrl } from '@mde/platforms'
import { approve, ReviewError } from '@mde/review'
import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { csvRecords } from '@/lib/csv'

// Add posts to a campaign from a CSV (owner request, 2026-10-30): staff upload any file with post links,
// whatever its columns are called. A clipper column is optional; without one, or for a name nobody has,
// the post goes to the clipper who linked the page in the link, else to a stand-in clipper for that page. Each post goes in as if the clipper had submitted it, at the campaign's
// rate, and waits for review; with "approved" in the status column it is approved at once through the
// same review step as the Review tab, so earnings, notifications and the audit log work as usual. Its
// views are read by the next check, like any new post. Nothing is changed for a row that fails.

export const MAX_ROWS = 2000
const URL_COLUMNS = ['url', 'post_url', 'link', 'post', 'post_link']
const CLIPPER_COLUMNS = ['clipper', 'username', 'email', 'creator', 'handle', 'user', 'account']

export type ImportRow = { row: number; url: string; result: 'added' | 'approved' | 'skipped' | 'error'; detail: string }
export type ImportResult =
  | { ok: true; added: number; approved: number; skipped: number; errors: number; rows: ImportRow[] }
  | { ok: false; error: string }

const pick = (r: Record<string, string>, names: string[]) => names.map((n) => r[n]).find((v) => v && v.trim()) ?? ''

// The row's post link: a named link column first, else any cell that holds one.
function linkIn(r: Record<string, string>) {
  const named = pick(r, URL_COLUMNS).trim()
  if (named && parsePostUrl(named)) return named
  return (
    Object.values(r)
      .map((v) => v.trim())
      .find((v) => parsePostUrl(v)) ?? named
  )
}

// A stand-in clipper for a page nobody on the platform has claimed: no password and an address that
// takes no mail, so nobody can sign in as it or be paid as it.
async function standIn(d: ReturnType<typeof db>, name: string) {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown'
  const email = `csv-import+${slug}@clippers.invalid`
  await d.insert(tables.users).values({ email, name }).onConflictDoNothing()
  const [u] = await d.select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, email))
  await d.insert(tables.creatorProfiles).values({ userId: u!.id }).onConflictDoNothing()
  return u!.id
}

export async function importSubmissionsCsv(campaignId: string, staffId: string, text: string): Promise<ImportResult> {
  const d = db()
  const [c] = await d.select().from(tables.campaigns).where(eq(tables.campaigns.id, campaignId))
  if (!c || c.deletedAt) return { ok: false, error: 'That campaign is gone.' }
  // Live or ended campaigns (owner request, 2026-10-30): on an ended one the posts count in the report
  // and earn only if the campaign is resumed, as approval adds earnings only while a campaign is live.
  if (!['live', 'closing', 'closed'].includes(c.status) || !c.currentTermsVersionId)
    return { ok: false, error: 'Posts can only be added to a campaign that has gone live.' }
  const { records } = csvRecords(text)
  if (!records.length) return { ok: false, error: 'The file has no rows under its header.' }
  if (!records.some((r) => parsePostUrl(linkIn(r))))
    return { ok: false, error: 'No TikTok, Instagram, YouTube or X post links were found in the file.' }
  if (records.length > MAX_ROWS) return { ok: false, error: `Up to ${MAX_ROWS.toLocaleString('en-US')} rows a file.` }

  const rows: ImportRow[] = []
  const seen = new Set<string>()
  for (const [i, r] of records.entries()) {
    const n = i + 2 // the spreadsheet's row number, after the header
    const url = linkIn(r)
    const who = pick(r, CLIPPER_COLUMNS).trim().replace(/^@/, '')
    // Matched as typed, case aside: no wildcards.
    const like = who.replace(/[\\%_]/g, '\\$&')
    const wantApproved = /^(approved?|yes|y|true|1)$/i.test((r.status ?? r.approve ?? '').trim())
    const fail = (detail: string) => rows.push({ row: n, url, result: 'error', detail })
    const post = parsePostUrl(url)
    if (!post) {
      // A row with no link at all (a total, a note) is passed over.
      if (url) fail('Not a TikTok, Instagram, YouTube or X post link.')
      else rows.push({ row: n, url, result: 'skipped', detail: 'No post link in this row.' })
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
    // The clipper: by username or email, else the clipper who linked that page, else a stand-in.
    const [user] = who
      ? await d
          .select({ id: tables.users.id })
          .from(tables.users)
          .where(or(ilike(tables.users.username, like), ilike(tables.users.email, like)))
          .limit(2)
      : []
    let creatorId = user?.id ?? null
    const page = (post.handle ?? who).replace(/^@/, '')
    const pageLike = page.replace(/[\\%_]/g, '\\$&')
    const accounts = await d
      .select()
      .from(tables.linkedAccounts)
      .where(
        and(
          eq(tables.linkedAccounts.platform, post.platform),
          sql`${tables.linkedAccounts.status} <> 'removed'`,
          creatorId
            ? eq(tables.linkedAccounts.creatorId, creatorId)
            : or(ilike(tables.linkedAccounts.handle, pageLike), ilike(tables.linkedAccounts.handle, like)),
        ),
      )
    if (!creatorId && accounts.length) creatorId = accounts[0]!.creatorId
    const standing = !creatorId
    if (!creatorId) creatorId = await standIn(d, page ? `@${page}` : 'Imported from a CSV')
    const account =
      accounts.find((a) => post.handle && a.handle.toLowerCase() === post.handle.toLowerCase()) ??
      (accounts.length === 1 ? accounts[0] : undefined)
    const note = `@${page || 'this page'} has no account here yet.`
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
      rows.push({
        row: n,
        url,
        result: 'added',
        detail: standing ? `Waiting for review. ${note}` : 'Waiting for review.',
      })
      continue
    }
    try {
      await approve(d, staffId, s.id, { note: 'Approved on import from a CSV.' })
      rows.push({
        row: n,
        url,
        result: 'approved',
        detail: standing
          ? `Approved; views are read at the next check. ${note}`
          : 'Approved; views are read at the next check.',
      })
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
