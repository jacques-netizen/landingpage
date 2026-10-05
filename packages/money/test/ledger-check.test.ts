import { tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { accrueEarnings, ledgerCheck } from '../src'
import { connect, fundedCampaign, makeSubmission, makeUser, setCountedViews } from './fixtures'

const ctx = connect()
const { db, store } = ctx
afterAll(() => ctx.client.end())

describe('ledger check', () => {
  it('reports zero errors on a ledger built by the engine', async () => {
    const c = await fundedCampaign(ctx)
    const s = await makeSubmission(db, c, await makeUser(db))
    await setCountedViews(db, s, 25_000)
    await accrueEarnings(store, { submissionId: s })
    expect(await ledgerCheck(db)).toEqual([])
  })

  it('catches pending that does not match what posts earned', async () => {
    const c = await fundedCampaign(ctx)
    const s = await makeSubmission(db, c, await makeUser(db))
    await setCountedViews(db, s, 25_000)
    await accrueEarnings(store, { submissionId: s })
    // Simulate a broken write: the post's earned cents drift from the ledger.
    await db.update(tables.submissions).set({ earnedCents: 1 }).where(eq(tables.submissions.id, s))
    const problems = await ledgerCheck(db)
    expect(problems.map((p) => p.check)).toContain('pending equals unreleased earnings')
    await db.update(tables.submissions).set({ earnedCents: 5_000 }).where(eq(tables.submissions.id, s))
    expect(await ledgerCheck(db)).toEqual([])
  })
})
