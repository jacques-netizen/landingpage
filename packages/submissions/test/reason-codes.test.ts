import { createDb, tables } from '@mde/db'
import { and, eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { listReasonCodes, updateReasonCode } from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} })
afterAll(() => sql.end())

describe('reason codes', () => {
  it('start with every code from 03_SYSTEMS.md section 5, written by the migration step', async () => {
    const codes = (await listReasonCodes(db)).map((r) => r.code)
    for (const c of ['not_linked_account', 'missing_hashtag', 'post_limit_reached', 'other']) expect(codes).toContain(c)
  })

  it('staff can reword a message, and the change is audited with before and after', async () => {
    const [u] = await db
      .insert(tables.users)
      .values({ email: `admin-${Date.now()}@test.invalid` })
      .returning()
    const original = (await listReasonCodes(db)).find((r) => r.code === 'missing_disclosure')!
    const after = await updateReasonCode(db, u!.id, 'missing_disclosure', {
      label: original.label,
      creatorMessage: 'Add #ad to the caption so viewers know it is an ad.',
    })
    expect(after.creatorMessage).toBe('Add #ad to the caption so viewers know it is an ad.')
    const audit = await db
      .select()
      .from(tables.auditLog)
      .where(and(eq(tables.auditLog.entityId, 'missing_disclosure'), eq(tables.auditLog.actorId, u!.id)))
    expect(audit).toMatchObject([
      {
        action: 'reason_code.update',
        before: { creatorMessage: original.creatorMessage },
        after: { creatorMessage: 'Add #ad to the caption so viewers know it is an ad.' },
      },
    ])
  })

  it('refuses empty or long wording and unknown codes', async () => {
    const [u] = await db
      .insert(tables.users)
      .values({ email: `admin2-${Date.now()}@test.invalid` })
      .returning()
    await expect(updateReasonCode(db, u!.id, 'other', { label: 'Other', creatorMessage: ' ' })).rejects.toThrow(
      /message/,
    )
    await expect(updateReasonCode(db, u!.id, 'other', { label: 'x'.repeat(81), creatorMessage: 'ok' })).rejects.toThrow(
      /label/,
    )
    await expect(updateReasonCode(db, u!.id, 'nope', { label: 'x', creatorMessage: 'y' })).rejects.toThrow(
      /does not exist/,
    )
  })
})
