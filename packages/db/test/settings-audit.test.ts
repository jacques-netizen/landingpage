import { SETTINGS_DEFAULTS } from '@mde/config'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb, getSetting, getSettings, seedSettingsDefaults, tables, updateSetting, writeAudit } from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} })
afterAll(() => sql.end())

async function makeUser(email: string) {
  const [u] = await db.insert(tables.users).values({ email }).returning()
  return u!
}

describe('settings', () => {
  it('returns the defaults when nothing is stored', async () => {
    expect(await getSettings(db)).toEqual(SETTINGS_DEFAULTS)
    expect(await getSetting(db, 'withdrawal_min_cents')).toBe(500)
  })

  it('seeding defaults never overwrites a stored value', async () => {
    const admin = await makeUser('settings-admin@test.invalid')
    await updateSetting(db, admin.id, 'review_window_days', 10)
    await seedSettingsDefaults(db)
    expect(await getSetting(db, 'review_window_days')).toBe(10)
  })

  it('writes an audit row with before and after in the same transaction', async () => {
    const admin = await makeUser('settings-admin-2@test.invalid')
    await updateSetting(db, admin.id, 'withdrawal_fee_bps', 150)
    const rows = await db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, 'withdrawal_fee_bps'))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ actorId: admin.id, action: 'settings.update', before: 0, after: 150 })
  })

  it('rejects an invalid value and writes nothing', async () => {
    const admin = await makeUser('settings-admin-3@test.invalid')
    await expect(updateSetting(db, admin.id, 'withdrawal_min_cents', 12.5)).rejects.toThrow()
    const rows = await db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, 'withdrawal_min_cents'))
    expect(rows).toHaveLength(0)
  })
})

describe('audit log', () => {
  it('rolls back with the change it records', async () => {
    await expect(
      db.transaction(async (tx) => {
        await writeAudit(tx, { actorId: null, action: 'test.rollback', entity: 'test' })
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    const rows = await db.select().from(tables.auditLog).where(eq(tables.auditLog.action, 'test.rollback'))
    expect(rows).toHaveLength(0)
  })

  it('cannot be edited or deleted', async () => {
    await writeAudit(db, { actorId: null, action: 'test.immutable', entity: 'test' })
    // Drizzle wraps the Postgres error; the trigger message is on the cause.
    const cause = (p: Promise<unknown>) =>
      p.then(
        () => 'no error',
        (e: Error) => String((e.cause as Error | undefined)?.message ?? e.message),
      )
    expect(await cause(db.update(tables.auditLog).set({ action: 'changed' }))).toMatch(/append only/)
    expect(await cause(db.delete(tables.auditLog))).toMatch(/append only/)
  })
})

describe('schema constraints', () => {
  it('rejects unknown enum values', async () => {
    await expect(sql`insert into users (email, status) values ('x@test.invalid', 'banned')`).rejects.toThrow(
      /users_status_check/,
    )
  })
})
