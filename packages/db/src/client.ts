import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = ReturnType<typeof createDb>['db']

export function createDb(url = process.env.DATABASE_URL, options: { max?: number } = {}) {
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = postgres(url, { max: options.max ?? 10, onnotice: () => {} })
  const db = drizzle(sql, { schema })
  return { db, sql }
}
