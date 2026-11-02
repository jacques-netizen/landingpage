import { reopenCampaign } from '@mde/campaigns'
import { and, desc, eq, ilike, inArray, isNull, sql, tables, writeAudit, type Db } from '@mde/db'
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
async function billboardLiveAndApprove(db: Db, log: (e: Record<string, unknown>) => void) {
  const [done] = await db
    .select({ id: tables.auditLog.id })
    .from(tables.auditLog)
    .where(eq(tables.auditLog.action, MARK))
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

  let reopened: string | null = null
  if (c.status === 'closed') {
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
    action: MARK,
    entity: 'campaign',
    entityId: c.id,
    after: { title: c.title, statusBefore: c.status, reopened, approved, failed },
  })
  log({ level: 'info', msg: 'billboard live and approve', title: c.title, reopened, approved, failed: failed.length })
}

export async function runOneOffs(
  db: Db,
  log: (e: Record<string, unknown>) => void = (e) => console.log(JSON.stringify(e)),
) {
  try {
    await billboardLiveAndApprove(db, log)
  } catch (err) {
    log({ level: 'error', msg: 'one-off failed', err: String(err) })
  }
}
