import postgres from 'postgres'
import { runMigrations } from '../src/migrate'

// Start every test run from an empty schema, then apply the committed migrations.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde_test'
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  await sql.unsafe('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;')
  await sql.end()
  await runMigrations(url)
}
