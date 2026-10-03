import { createDb } from '../src/client'
import { users } from '../src/schema'

export const url =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/mde_test'

export function testDb() {
  return createDb(url, { max: 4 })
}

export async function makeUser(db: ReturnType<typeof createDb>['db'], label = 'user') {
  const [u] = await db
    .insert(users)
    .values({ email: `${label}-${crypto.randomUUID()}@test.invalid`, isAdultConfirmed: true })
    .returning()
  return u!
}
