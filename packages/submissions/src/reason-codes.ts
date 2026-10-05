// Reason codes with staff-editable wording (03_SYSTEMS.md section 5). The code itself never changes.
import { tables, writeAudit, type Db, type DbOrTx } from '@mde/db'
import { asc, eq } from 'drizzle-orm'

const { reasonCodes } = tables

export class ReasonCodeError extends Error {}

export function listReasonCodes(d: DbOrTx) {
  return d.select().from(reasonCodes).orderBy(asc(reasonCodes.code))
}

/** Change a reason's label and creator message. Written to the audit log with before and after. */
export async function updateReasonCode(
  db: Db,
  actorId: string,
  code: string,
  input: { label: string; creatorMessage: string },
) {
  const label = input.label.trim()
  const creatorMessage = input.creatorMessage.trim()
  if (!label || label.length > 80) throw new ReasonCodeError('Enter a label of up to 80 characters.')
  if (!creatorMessage || creatorMessage.length > 300)
    throw new ReasonCodeError('Enter the message creators see, up to 300 characters.')
  if (/[—]/.test(label + creatorMessage))
    throw new ReasonCodeError('Use a comma or a full stop instead of a long dash.')
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(reasonCodes).where(eq(reasonCodes.code, code)).for('update')
    if (!before) throw new ReasonCodeError('This reason code does not exist.')
    if (before.label === label && before.creatorMessage === creatorMessage) return before
    const [after] = await tx
      .update(reasonCodes)
      .set({ label, creatorMessage })
      .where(eq(reasonCodes.code, code))
      .returning()
    await writeAudit(tx, {
      actorId,
      action: 'reason_code.update',
      entity: 'reason_code',
      entityId: code,
      before: { label: before.label, creatorMessage: before.creatorMessage },
      after: { label, creatorMessage },
    })
    return after!
  })
}
