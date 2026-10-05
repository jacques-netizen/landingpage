import { createDb, tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import {
  addBioCodeAccount,
  listAccounts,
  MockProvider,
  ProviderRouter,
  removeAccount,
  renewBioCode,
  verifyBioCode,
  type MockState,
} from '../src'

const { db, sql } = createDb(process.env.DATABASE_URL!, { max: 4, onnotice: () => {} })
afterAll(() => sql.end())

let state: MockState = {}
const router = new ProviderRouter([new MockProvider(() => state)], { backoffMs: 1, log: () => {} })

let n = 0
async function creator() {
  const [u] = await db
    .insert(tables.users)
    .values({ email: `creator-${Date.now()}-${++n}@test.invalid` })
    .returning()
  return u!.id
}
const handle = () => `maya${Date.now() % 100000}${++n}`

function bio(platform: string, h: string, text: string, extra: object = {}) {
  state = { profiles: { ...state.profiles, [`${platform}:${h}`]: { bio: text, ...extra } } }
}

describe('bio code linking', () => {
  it('gives a code, and verifies once the code is in the bio', async () => {
    const me = await creator()
    const h = handle()
    const acc = await addBioCodeAccount(db, me, { platform: 'tiktok', handle: `@${h.toUpperCase()}` })
    expect(acc).toMatchObject({ status: 'pending', handle: h, linkMethod: 'bio_code' })
    expect(acc.verificationCode).toMatch(/^MDE-[A-Z0-9]{4}$/)
    expect(acc.verificationExpiresAt!.getTime() - acc.createdAt.getTime()).toBeGreaterThan(6.9 * 86_400_000)

    bio('tiktok', h, 'daily clips')
    await expect(verifyBioCode(db, router, me, acc.id)).rejects.toMatchObject({ code: 'code_not_seen' })
    await expect(verifyBioCode(db, router, me, acc.id)).rejects.toThrow(
      'We could not see the code yet. It can take a few minutes to show. Try again.',
    )

    bio('tiktok', h, `daily clips ${acc.verificationCode!.toLowerCase()}`, {
      followers: 5400,
      platformUserId: `tt-${h}`,
      createdAt: '2021-05-01T00:00:00Z',
    })
    const v = await verifyBioCode(db, router, me, acc.id)
    expect(v).toMatchObject({ status: 'verified', followers: 5400, platformUserId: `tt-${h}`, verificationCode: null })
    expect(v.accountCreatedAt?.toISOString()).toBe('2021-05-01T00:00:00.000Z')
    expect(v.lastCheckedAt).not.toBeNull()
  })

  it('refuses private accounts and missing accounts', async () => {
    const me = await creator()
    const h = handle()
    const acc = await addBioCodeAccount(db, me, { platform: 'instagram', handle: h })
    bio('instagram', h, acc.verificationCode!, { isPublic: false })
    await expect(verifyBioCode(db, router, me, acc.id)).rejects.toMatchObject({ code: 'account_private' })
  })

  it('needs a new code after 7 days', async () => {
    const me = await creator()
    const h = handle()
    const old = new Date(Date.now() - 8 * 86_400_000)
    const acc = await addBioCodeAccount(db, me, { platform: 'x', handle: h }, old)
    bio('x', h, acc.verificationCode!)
    await expect(verifyBioCode(db, router, me, acc.id)).rejects.toMatchObject({ code: 'code_expired' })
    const renewed = await renewBioCode(db, me, acc.id)
    bio('x', h, renewed.verificationCode!)
    expect((await verifyBioCode(db, router, me, acc.id)).status).toBe('verified')
  })

  it('a platform account belongs to one creator only, and the attempt is recorded for staff', async () => {
    const [a, b] = [await creator(), await creator()]
    const h = handle()
    const first = await addBioCodeAccount(db, a, { platform: 'youtube', handle: h })
    bio('youtube', h, first.verificationCode!, { platformUserId: `yt-${h}` })
    await verifyBioCode(db, router, a, first.id)

    const second = await addBioCodeAccount(db, b, { platform: 'youtube', handle: h })
    bio('youtube', h, second.verificationCode!, { platformUserId: `yt-${h}` })
    await expect(verifyBioCode(db, router, b, second.id)).rejects.toMatchObject({ code: 'linked_elsewhere' })
    const audit = await db.select().from(tables.auditLog).where(eq(tables.auditLog.entityId, second.id))
    expect(audit.map((r) => r.action)).toEqual(['linked_account.conflict'])

    // Once the first creator removes it, the account can be linked by someone else.
    await removeAccount(db, a, first.id)
    expect((await verifyBioCode(db, router, b, second.id)).status).toBe('verified')
  })

  it('limits each creator to the max_linked_accounts setting and refuses duplicates', async () => {
    const me = await creator()
    const h = handle()
    await addBioCodeAccount(db, me, { platform: 'tiktok', handle: h })
    await expect(addBioCodeAccount(db, me, { platform: 'tiktok', handle: `@${h}` })).rejects.toMatchObject({
      code: 'already_added',
    })
    for (let i = 1; i < 8; i++) await addBioCodeAccount(db, me, { platform: 'x', handle: `${h.slice(0, 10)}${i}` })
    await expect(addBioCodeAccount(db, me, { platform: 'instagram', handle: h })).rejects.toMatchObject({
      code: 'limit_reached',
    })
    expect(await listAccounts(db, me)).toHaveLength(8)
  })

  it('rejects handles that cannot exist, and other creators cannot touch your accounts', async () => {
    const [me, other] = [await creator(), await creator()]
    await expect(addBioCodeAccount(db, me, { platform: 'x', handle: 'has space' })).rejects.toMatchObject({
      code: 'invalid_handle',
    })
    const acc = await addBioCodeAccount(db, me, { platform: 'tiktok', handle: handle() })
    await expect(verifyBioCode(db, router, other, acc.id)).rejects.toMatchObject({ code: 'not_found' })
    await expect(removeAccount(db, other, acc.id)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('reports an outage as a provider problem, not a failed check', async () => {
    const me = await creator()
    const h = handle()
    const acc = await addBioCodeAccount(db, me, { platform: 'tiktok', handle: h })
    state = { down: true }
    await expect(verifyBioCode(db, router, me, acc.id)).rejects.toMatchObject({ code: 'provider_unavailable' })
    state = {}
  })
})
