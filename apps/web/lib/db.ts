import { createDb } from '@mde/db'

type Handle = ReturnType<typeof createDb>
const globalForDb = globalThis as unknown as { __mdeDb?: Handle }

/** One connection pool per server process. Created on first use so builds do not need a database. */
export function getDb() {
  globalForDb.__mdeDb ??= createDb(process.env.DATABASE_URL, { max: 10 })
  return globalForDb.__mdeDb.db
}
