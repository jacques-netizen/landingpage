import { rmSync } from 'node:fs'
import postgres from 'postgres'
import { createDb } from '@mde/db'
import { runMigrations } from '@mde/db/migrate'
import { seedBase } from '@mde/db/seed'

export default async function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/mde_test'
  const admin = postgres(url, { max: 1, onnotice: () => {} })
  await admin.unsafe(
    'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;',
  )
  await admin.end()
  await runMigrations(url)
  const { db, sql } = createDb(url, { max: 1 })
  await seedBase(db)
  await sql.end()
  rmSync('/tmp/mde-e2e-outbox.jsonl', { force: true })
}
