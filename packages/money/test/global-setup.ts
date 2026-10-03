import postgres from 'postgres'
import { runMigrations } from '@mde/db/migrate'

const base = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/mde_test'
/** The money package has its own database so it never collides with other packages' tests. */
export const MONEY_TEST_DB = base.replace(/\/[^/]+$/, '/mde_test_money')

export default async function setup() {
  const admin = postgres(base.replace(/\/[^/]+$/, '/postgres'), { max: 1, onnotice: () => {} })
  const exists = await admin`select 1 from pg_database where datname = 'mde_test_money'`
  if (exists.length === 0) await admin.unsafe('create database mde_test_money')
  await admin.end()

  const sql = postgres(MONEY_TEST_DB, { max: 1, onnotice: () => {} })
  await sql.unsafe(
    'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;',
  )
  await sql.end()
  await runMigrations(MONEY_TEST_DB)
  process.env.MONEY_TEST_DATABASE_URL = MONEY_TEST_DB
}
