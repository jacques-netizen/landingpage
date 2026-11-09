import 'server-only'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { db, tables } from '@mde/db'
import { desc, eq, sql } from 'drizzle-orm'

// What changed on the platform and where it came from (owner, 2026-11-09), for the admin's Change log:
// code changes from CHANGELOG.md, deploys from the deploys table the migrate step fills, and staff
// actions on live data from the audit log.

export type CodeChange = { date: string; what: string; requestedBy: string; madeBy: string; commit: string }

/** CHANGELOG.md sits at the repository root; the web app runs from apps/web. */
function changelogPath() {
  for (const p of [path.join(process.cwd(), '..', '..', 'CHANGELOG.md'), path.join(process.cwd(), 'CHANGELOG.md')])
    if (existsSync(p)) return p
  return null
}

export function codeChanges(): CodeChange[] {
  const file = changelogPath()
  if (!file) return []
  const out: CodeChange[] = []
  let date = ''
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const d = line.match(/^## (\d{4}-\d{2}-\d{2})$/)
    if (d) {
      date = d[1]!
      continue
    }
    if (!date || !line.startsWith('- ')) continue
    const parts = line.slice(2).split(' · ')
    if (parts.length < 4) continue
    const commit = parts.at(-1)!.trim()
    const field = (name: string) =>
      parts
        .find((p) => p.startsWith(`${name}: `))
        ?.slice(name.length + 2)
        .trim() ?? 'not recorded'
    out.push({
      date,
      what: parts[0]!.trim(),
      requestedBy: field('Requested by'),
      madeBy: field('Made by'),
      commit,
    })
  }
  return out
}

/** The commit live right now, as Railway reports it to the running app (null outside Railway). */
export function liveCommit() {
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA
  return sha ? { sha, branch: process.env.RAILWAY_GIT_BRANCH ?? null } : null
}

export async function recentDeploys(limit = 100) {
  return db().select().from(tables.deploys).orderBy(desc(tables.deploys.createdAt)).limit(limit)
}

export const STAFF_PAGE = 100

/** Staff actions on live data, newest first, with who did them ("Platform" for jobs and deploy steps). */
export async function staffActions(page: number) {
  const rows = await db()
    .select({
      id: tables.auditLog.id,
      at: tables.auditLog.createdAt,
      action: tables.auditLog.action,
      entity: tables.auditLog.entity,
      entityId: tables.auditLog.entityId,
      actorId: tables.auditLog.actorId,
      who: sql<string | null>`coalesce(${tables.users.username}, ${tables.users.name}, ${tables.users.email})`,
    })
    .from(tables.auditLog)
    .leftJoin(tables.users, eq(tables.users.id, tables.auditLog.actorId))
    .orderBy(desc(tables.auditLog.id))
    .limit(STAFF_PAGE + 1)
    .offset((Math.max(1, page) - 1) * STAFF_PAGE)
  return { rows: rows.slice(0, STAFF_PAGE), more: rows.length > STAFF_PAGE }
}
