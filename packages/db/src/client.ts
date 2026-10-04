import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = PostgresJsDatabase<typeof schema>
// A transaction handle has the same query API as the database.
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx

const globalForDb = globalThis as unknown as { __mdeDb?: Db; __mdeSql?: postgres.Sql }

export function createDb(url: string, options: postgres.Options<Record<string, never>> = {}) {
  const client = postgres(url, { max: 10, ...options })
  return { db: drizzle(client, { schema, casing: undefined }), sql: client }
}

// One pool per process. Reused across Next.js hot reloads in development.
export function db(): Db {
  if (!globalForDb.__mdeDb) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    const { db: d, sql } = createDb(url)
    globalForDb.__mdeDb = d
    globalForDb.__mdeSql = sql
  }
  return globalForDb.__mdeDb
}

export { schema }
