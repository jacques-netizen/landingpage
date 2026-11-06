import { reopenCampaign } from '@mde/campaigns'
import { and, desc, eq, ilike, inArray, isNull, sql, tables, writeAudit, type Db } from '@mde/db'
import { accrueEarnings, createPgStore } from '@mde/money'
import { approve } from '@mde/review'

// One-time tasks the owner asked for that need the platform's own campaign and review code, run when the
// worker starts. Each is marked in the audit log when done, so it never runs twice.

const MARK = 'oneoff.billboard_live_and_approve'

/**
 * Owner, 2026-11-02: "approve everything and make the campaign live" for the One Billion Dollar
 * Billboard campaign. Resumes it the same way as the Resume button (only possible until its earnings are
 * released), then approves every post waiting for review the same way as the Review tab. Posts that
 * were denied stay denied.
 */
async function billboardLiveAndApprove(db: Db, log: (e: Record<string, unknown>) => void, mark = MARK) {
  const [done] = await db
    .select({ id: tables.auditLog.id })
    .from(tables.auditLog)
    .where(eq(tables.auditLog.action, mark))
    .limit(1)
  if (done) return
  const found = await db
    .select({ id: tables.campaigns.id, status: tables.campaigns.status, title: tables.campaigns.title })
    .from(tables.campaigns)
    .where(and(ilike(tables.campaigns.title, '%billion dollar billboard%'), isNull(tables.campaigns.deletedAt)))
  if (!found.length) return
  // More than one match: the one holding the most posts.
  const counts = await db
    .select({ id: tables.submissions.campaignId, n: sql<number>`count(*)::int` })
    .from(tables.submissions)
    .where(
      inArray(
        tables.submissions.campaignId,
        found.map((c) => c.id),
      ),
    )
    .groupBy(tables.submissions.campaignId)
    .orderBy(desc(sql`count(*)`))
  const c = found.find((x) => x.id === counts[0]?.id) ?? found[0]!
  // Decisions are made in the name of an admin, as the audit log needs a person.
  const [admin] = await db
    .select({ id: tables.staffRoles.userId })
    .from(tables.staffRoles)
    .where(eq(tables.staffRoles.role, 'admin'))
    .orderBy(tables.staffRoles.createdAt)
    .limit(1)
  if (!admin) return

  // What closed it last (no person: the platform's own lifecycle job), and what its budget holds, so
  // the audit log says why it ended and a campaign with an empty budget is not resumed only to close again.
  const [lastClose] = await db
    .select({ actorId: tables.auditLog.actorId, at: tables.auditLog.createdAt })
    .from(tables.auditLog)
    .where(and(eq(tables.auditLog.action, 'campaign.close'), eq(tables.auditLog.entityId, c.id)))
    .orderBy(desc(tables.auditLog.id))
    .limit(1)
  const [budget] = await db.execute<{ cents: string }>(sql`
    select coalesce(sum(e.amount_cents), 0)::bigint as cents from ledger_entries e
    join ledger_accounts a on a.id = e.account_id where a.kind = 'campaign_budget' and a.owner_id = ${c.id}`)
  const budgetLeft = Number(budget?.cents ?? 0)
  let reopened: string | null = null
  if (c.status === 'closed' && budgetLeft < 1) reopened = 'not resumed: its budget has nothing left'
  else if (c.status === 'closed') {
    try {
      const r = await reopenCampaign(db, admin.id, c.id)
      reopened = `resumed, ${r.posts} posts back to approved`
    } catch (err) {
      reopened = `not resumed: ${err instanceof Error ? err.message : String(err)}`
    }
  }
  const waiting = await db
    .select({ id: tables.submissions.id })
    .from(tables.submissions)
    .where(
      and(
        eq(tables.submissions.campaignId, c.id),
        inArray(tables.submissions.state, ['needs_review', 'needs_info', 'flagged']),
      ),
    )
  let approved = 0
  const failed: string[] = []
  for (const s of waiting) {
    try {
      await approve(db, admin.id, s.id, { note: 'Approved on the owner request of 2026-11-02.' })
      approved++
    } catch (err) {
      failed.push(`${s.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  await writeAudit(db, {
    actorId: admin.id,
    action: mark,
    entity: 'campaign',
    entityId: c.id,
    after: {
      title: c.title,
      statusBefore: c.status,
      lastClose: lastClose ?? null,
      budgetLeft,
      reopened,
      approved,
      failed,
    },
  })
  log({ level: 'info', msg: 'billboard live and approve', title: c.title, reopened, approved, failed: failed.length })
}

/**
 * Owner, 2026-11-06: "do the view check now" on Davido X Winnerman-Audio, so the new rule (clippers stop
 * earning once the client's budget is used up) applies at once instead of at each post's next check.
 * Earnings are recalculated from the views already read, so no data provider is called.
 */
async function davidoCapNow(db: Db, log: (e: Record<string, unknown>) => void) {
  const mark = 'oneoff.davido_client_cap'
  const [done] = await db
    .select({ id: tables.auditLog.id })
    .from(tables.auditLog)
    .where(eq(tables.auditLog.action, mark))
    .limit(1)
  if (done) return
  const found = await db
    .select({ id: tables.campaigns.id, title: tables.campaigns.title, status: tables.campaigns.status })
    .from(tables.campaigns)
    .where(and(ilike(tables.campaigns.title, '%davido%winnerman%'), isNull(tables.campaigns.deletedAt)))
  if (found.length !== 1) {
    if (found.length) log({ level: 'warn', msg: 'davido cap: more than one campaign matches', n: found.length })
    return
  }
  const c = found[0]!
  const posts = await db
    .select({ id: tables.submissions.id })
    .from(tables.submissions)
    .where(and(eq(tables.submissions.campaignId, c.id), inArray(tables.submissions.state, ['approved', 'earning'])))
  const store = createPgStore(db)
  let changed = 0
  let closing = false
  const failed: string[] = []
  for (const s of posts) {
    try {
      const r = await accrueEarnings(store, { submissionId: s.id })
      if (r.deltaCents !== 0) changed++
      closing ||= r.campaignClosing
    } catch (err) {
      failed.push(`${s.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const [after] = await db
    .select({ status: tables.campaigns.status })
    .from(tables.campaigns)
    .where(eq(tables.campaigns.id, c.id))
  await writeAudit(db, {
    actorId: null,
    action: mark,
    entity: 'campaign',
    entityId: c.id,
    after: {
      title: c.title,
      statusBefore: c.status,
      statusAfter: after?.status,
      posts: posts.length,
      changed,
      closing,
      failed,
    },
  })
  log({ level: 'info', msg: 'davido cap applied', posts: posts.length, changed, status: after?.status })
}

export async function runOneOffs(
  db: Db,
  log: (e: Record<string, unknown>) => void = (e) => console.log(JSON.stringify(e)),
) {
  try {
    await billboardLiveAndApprove(db, log)
    // Owner, 2026-11-03: the campaign had ended again after being resumed on 2026-11-02; resume it once more.
    await billboardLiveAndApprove(db, log, `${MARK}.2`)
    await davidoCapNow(db, log)
  } catch (err) {
    log({ level: 'error', msg: 'one-off failed', err: String(err) })
  }
}
