import { createDb } from './client'
import { runMigrations } from './migrate'

if (process.env.NODE_ENV === 'production')
  throw new Error('Refusing to reset a production database')
const { sql } = createDb(undefined, { max: 1 })
await sql.unsafe(
  'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;',
)
await sql.end()
await runMigrations()
console.log('Database reset and migrated')
