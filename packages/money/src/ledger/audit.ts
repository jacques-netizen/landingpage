import { writeAudit, type AuditEntry, type Executor } from '@mde/db'

/** Staff actions write an audit row inside the same transaction. System jobs (no actor) do not. */
export async function auditIfStaff(
  tx: Executor,
  actorId: string | null | undefined,
  entry: Omit<AuditEntry, 'actorId'>,
) {
  if (actorId) await writeAudit(tx, { ...entry, actorId })
}
