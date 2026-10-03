import type { Database } from './client'
import { auditLog } from './schema'

/** A database or an open transaction. Audit rows must be written with the transaction that makes the change. */
export type Executor = Pick<Database, 'insert' | 'select' | 'update' | 'execute'>

export type AuditEntry = {
  /** Null for system jobs. */
  actorId: string | null
  /** Dotted verb, for example 'settings.update' or 'staff_role.grant'. */
  action: string
  entity: string
  entityId?: string | null
  before?: unknown
  after?: unknown
}

/**
 * Every staff action that changes money, a decision or a user calls this inside its transaction:
 *
 *   await db.transaction(async (tx) => { ...change...; await writeAudit(tx, {...}) })
 *
 * If the transaction rolls back, the audit row goes with it, and a change can never commit without one.
 */
export async function writeAudit(tx: Executor, entry: AuditEntry) {
  await tx.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  })
}
