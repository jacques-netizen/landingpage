import { afterAll, describe, expect, it } from 'vitest'
import { eq, sql as dsql } from 'drizzle-orm'
import { settingsDefaults } from '@mde/config'
import { makeUser, testDb } from '../test/helpers'
import { writeAudit } from './audit'
import { getSetting, getSettings, updateSetting } from './settings'
import { auditLog, settings } from './schema'

const { db, sql } = testDb()
afterAll(() => sql.end())

describe('audit log', () => {
  it('writes inside the same transaction, so a rollback removes it too', async () => {
    const actor = await makeUser(db)
    const action = `test.rollback.${crypto.randomUUID()}`
    await expect(
      db.transaction(async (tx) => {
        await writeAudit(tx, {
          actorId: actor.id,
          action,
          entity: 'thing',
          before: { a: 1 },
          after: { a: 2 },
        })
        throw new Error('money step failed')
      }),
    ).rejects.toThrow('money step failed')
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, action))
    expect(rows).toHaveLength(0)
  })

  it('keeps before and after values when the transaction commits', async () => {
    const actor = await makeUser(db)
    const action = `test.commit.${crypto.randomUUID()}`
    await db.transaction((tx) =>
      writeAudit(tx, {
        actorId: actor.id,
        action,
        entity: 'thing',
        before: { a: 1 },
        after: { a: 2 },
      }),
    )
    const [row] = await db.select().from(auditLog).where(eq(auditLog.action, action))
    expect(row?.before).toEqual({ a: 1 })
    expect(row?.after).toEqual({ a: 2 })
    expect(row?.actorId).toBe(actor.id)
  })

  it('cannot be updated, deleted or truncated', async () => {
    const action = `test.immutable.${crypto.randomUUID()}`
    await db.transaction((tx) => writeAudit(tx, { actorId: null, action, entity: 'thing' }))
    await expect(
      db.execute(dsql`update audit_log set action = 'x' where action = ${action}`),
    ).rejects.toThrow()
    await expect(db.execute(dsql`delete from audit_log where action = ${action}`)).rejects.toThrow()
    await expect(db.execute(dsql`truncate audit_log`)).rejects.toThrow()
  })
})

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    await db.delete(settings)
    const all = await getSettings(db)
    expect(all).toEqual(settingsDefaults)
    expect(await getSetting(db, 'withdrawal_min_cents')).toBe(2000)
  })

  it('stores a change and audits it with before and after', async () => {
    const admin = await makeUser(db, 'admin')
    await updateSetting(db, { key: 'review_window_days', value: 10, actorId: admin.id })
    expect(await getSetting(db, 'review_window_days')).toBe(10)
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, 'settings.update'))
    const row = rows.find((r) => r.actorId === admin.id)
    expect(row?.before).toEqual({ key: 'review_window_days', value: 7 })
    expect(row?.after).toEqual({ key: 'review_window_days', value: 10 })
  })

  it('rejects an invalid value and writes nothing', async () => {
    const admin = await makeUser(db, 'admin')
    await expect(
      updateSetting(db, { key: 'withdrawal_fee_bps', value: 12.5, actorId: admin.id }),
    ).rejects.toThrow()
    await expect(
      updateSetting(db, { key: 'withdrawal_fee_bps', value: 20000, actorId: admin.id }),
    ).rejects.toThrow()
    expect(await getSetting(db, 'withdrawal_fee_bps')).toBe(0)
    const rows = await db.select().from(auditLog).where(eq(auditLog.actorId, admin.id))
    expect(rows).toHaveLength(0)
  })

  it('rejects an unknown key', async () => {
    const admin = await makeUser(db, 'admin')
    // @ts-expect-error not a setting key
    await expect(
      updateSetting(db, { key: 'made_up', value: 1, actorId: admin.id }),
    ).rejects.toThrow()
  })
})
