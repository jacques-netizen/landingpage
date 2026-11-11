// Two staff-facing notifications (owner, 2026-11-10): payout method alerts for finance and admins, and
// plain messages from staff to clippers that are not warnings, so they add no strike.
import { notify, tables, writeAudit, type Db, type DbOrTx } from '@mde/db'
import { and, eq, inArray } from 'drizzle-orm'

const { staffRoles, users } = tables

/**
 * Tells every finance and admin staff member who has not switched it off that a clipper added or
 * changed where their withdrawals are paid. `before` and `after` are short, masked descriptions
 * (never full account numbers: the alert is also emailed). Returns how many staff were told.
 */
export async function notifyPayoutMethodChange(
  d: DbOrTx,
  input: { creatorId: string; creatorName: string; before: string | null; after: string },
) {
  const staff = await d
    .selectDistinct({ id: users.id })
    .from(staffRoles)
    .innerJoin(users, eq(users.id, staffRoles.userId))
    .where(and(inArray(staffRoles.role, ['finance', 'admin']), eq(users.notifyPayoutChanges, true)))
  const title = input.before
    ? `${input.creatorName} changed their payout method`
    : `${input.creatorName} added a payout method`
  const body = input.before ? `From ${input.before} to ${input.after}.` : `${input.after}.`
  for (const { id } of staff)
    await notify(d, id, 'payout_method_changed', { title, body, link: `/admin/creators/${input.creatorId}` })
  return staff.length
}

export async function setPayoutChangeAlerts(d: DbOrTx, userId: string, on: boolean) {
  await d.update(users).set({ notifyPayoutChanges: on }).where(eq(users.id, userId))
}

export class StaffMessageError extends Error {}

export const STAFF_MESSAGE_MAX = 2000
export const STAFF_MESSAGE_TITLE_MAX = 120
export const STAFF_MESSAGE_DEFAULT_TITLE = 'A message from the team'

/**
 * A message from staff to one or more clippers: in the app and by email (for those who keep email
 * on), with no warning and no strike. Closed accounts are skipped. Audited once per send.
 * Returns how many clippers it went to.
 */
export async function sendStaffMessage(
  db: Db,
  staffId: string,
  creatorIds: string[],
  input: { title?: string; body: string; campaignId?: string },
) {
  const title = (input.title ?? '').trim() || STAFF_MESSAGE_DEFAULT_TITLE
  const body = input.body.trim()
  if (!body) throw new StaffMessageError('Write the message.')
  if (body.length > STAFF_MESSAGE_MAX)
    throw new StaffMessageError(`Keep the message under ${STAFF_MESSAGE_MAX.toLocaleString('en-US')} characters.`)
  if (title.length > STAFF_MESSAGE_TITLE_MAX)
    throw new StaffMessageError(`Keep the title under ${STAFF_MESSAGE_TITLE_MAX} characters.`)
  const ids = [...new Set(creatorIds)]
  if (!ids.length) throw new StaffMessageError('There is nobody to send it to.')
  return db.transaction(async (tx) => {
    const to = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, ids), inArray(users.status, ['active', 'suspended'])))
    for (const { id } of to) await notify(tx, id, 'staff_message', { title, body, link: '/notifications' })
    await writeAudit(tx, {
      actorId: staffId,
      action: 'creator.message',
      entity: input.campaignId ? 'campaign' : 'user',
      entityId: input.campaignId ?? ids[0]!,
      after: { title, body, recipients: to.map((r) => r.id) },
    })
    return to.length
  })
}
