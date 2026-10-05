import { createDb, tables } from '@mde/db'
import { MockProvider, ProviderRouter, type MockState } from '@mde/platforms'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { recheckAccount, runAccountRechecks } from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} })
afterAll(() => sql.end())
let state: MockState = {}
const router = new ProviderRouter([new MockProvider(() => state)], { backoffMs: 1, attempts: 1, log: () => {} })
let n = 0
const uniq = () => `${Date.now() % 1e9}${++n}`

async function account(followers = 10_000) {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `r-${uniq()}@test.invalid` })
    .returning()
  const handle = `acct${uniq()}`
  const [a] = await db
    .insert(tables.linkedAccounts)
    .values({
      creatorId: u!.id,
      platform: 'x',
      handle,
      linkMethod: 'bio_code',
      status: 'verified',
      platformUserId: `x-${handle}`,
      followers,
      lastCheckedAt: new Date(Date.now() - 2 * 86_400_000),
    })
    .returning()
  return a!
}
const profile = (a: { handle: string; platformUserId: string | null }, over: object) =>
  (state = { profiles: { ...state.profiles, [`x:${a.handle}`]: { platformUserId: a.platformUserId!, ...over } } })
const reload = async (id: string) =>
  (await db.select().from(tables.linkedAccounts).where(eq(tables.linkedAccounts.id, id)))[0]!

describe('account re-check', () => {
  it('updates followers and the time checked', async () => {
    const a = await account()
    profile(a, { followers: 12_000 })
    expect(await recheckAccount(db, a, { router })).toBe('ok')
    expect(await reload(a.id)).toMatchObject({ followers: 12_000, status: 'verified' })
  })

  it('follows a handle change through the platform user id', async () => {
    const a = await account()
    profile(a, { handle: 'NewName', followers: 10_000 })
    expect(await recheckAccount(db, a, { router })).toBe('handle_changed')
    expect((await reload(a.id)).handle).toBe('newname')
  })

  it('marks accounts that went private or were deleted', async () => {
    const a = await account()
    profile(a, { isPublic: false })
    expect(await recheckAccount(db, a, { router })).toBe('private')
    expect((await reload(a.id)).status).toBe('failed')
    const [note] = await db.select().from(tables.notifications).where(eq(tables.notifications.userId, a.creatorId))
    expect(note).toMatchObject({ kind: 'account_status', link: '/accounts' })
    const b = await account()
    profile(b, { platformUserId: 'someone-new' })
    expect(await recheckAccount(db, b, { router })).toBe('gone')
  })

  it('runs only accounts not checked in the last day', async () => {
    const a = await account()
    profile(a, { followers: 10_000 })
    await runAccountRechecks(db, { router })
    const checked = (await reload(a.id)).lastCheckedAt!
    await runAccountRechecks(db, { router })
    expect((await reload(a.id)).lastCheckedAt).toEqual(checked)
  })
})
