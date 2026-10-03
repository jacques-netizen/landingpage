import postgres from 'postgres'
import { runMigrations } from '../src/migrate'

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/mde_test'

/** Rebuilds the test database from the committed migrations before the run. Never touches DATABASE_URL. */
export default async function setup() {
  const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} })
  await admin.unsafe(
    'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;',
  )
  await admin.end()
  await runMigrations(TEST_DATABASE_URL)
  process.env.TEST_DATABASE_URL = TEST_DATABASE_URL
}
