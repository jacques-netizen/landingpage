import { and, eq } from 'drizzle-orm'
import type { StaffRole } from '@mde/config'
import type { Database } from './client'
import { writeAudit } from './audit'
import { staffRoles, users } from './schema'

export async function grantStaffRole(
  db: Database,
  input: { userId: string; role: StaffRole; actorId: string | null },
) {
  await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
    if (!user) throw new Error('No such user')
    const inserted = await tx
      .insert(staffRoles)
      .values({ userId: input.userId, role: input.role })
      .onConflictDoNothing()
      .returning()
    if (inserted.length === 0) return
    await writeAudit(tx, {
      actorId: input.actorId,
      action: 'staff_role.grant',
      entity: 'user',
      entityId: input.userId,
      before: null,
      after: { role: input.role },
    })
  })
}

export async function revokeStaffRole(
  db: Database,
  input: { userId: string; role: StaffRole; actorId: string | null },
) {
  await db.transaction(async (tx) => {
    const removed = await tx
      .delete(staffRoles)
      .where(and(eq(staffRoles.userId, input.userId), eq(staffRoles.role, input.role)))
      .returning()
    if (removed.length === 0) return
    await writeAudit(tx, {
      actorId: input.actorId,
      action: 'staff_role.revoke',
      entity: 'user',
      entityId: input.userId,
      before: { role: input.role },
      after: null,
    })
  })
}
