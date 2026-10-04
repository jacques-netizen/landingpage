import type { DbOrTx } from './client'
import { auditLog } from './schema'

export type AuditEntry = {
  actorId: string | null
  action: string
  entity: string
  entityId?: string | null
  before?: unknown
  after?: unknown
}

// Write one audit row. Call it with the same transaction handle as the change it records,
// so the change and its audit row commit or roll back together (02_DATA_AND_MONEY.md section 1).
export async function writeAudit(tx: DbOrTx, entry: AuditEntry) {
  await tx.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    before: entry.before === undefined ? null : entry.before,
    after: entry.after === undefined ? null : entry.after,
  })
}
