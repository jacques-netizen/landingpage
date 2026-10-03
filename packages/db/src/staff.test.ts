import { afterAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { makeUser, testDb } from '../test/helpers'
import { grantStaffRole, revokeStaffRole } from './staff'
import { auditLog, staffRoles } from './schema'

const { db, sql } = testDb()
afterAll(() => sql.end())

describe('staff role changes', () => {
  it('grant and revoke each write an audit row', async () => {
    const admin = await makeUser(db, 'admin')
    const person = await makeUser(db, 'person')
    await grantStaffRole(db, { userId: person.id, role: 'reviewer', actorId: admin.id })
    await grantStaffRole(db, { userId: person.id, role: 'reviewer', actorId: admin.id }) // repeat does nothing
    let rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, person.id), eq(auditLog.action, 'staff_role.grant')))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.after).toEqual({ role: 'reviewer' })

    await revokeStaffRole(db, { userId: person.id, role: 'reviewer', actorId: admin.id })
    const left = await db.select().from(staffRoles).where(eq(staffRoles.userId, person.id))
    expect(left).toHaveLength(0)
    rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, person.id), eq(auditLog.action, 'staff_role.revoke')))
    expect(rows).toHaveLength(1)
  })
})
