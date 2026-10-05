import postgres from 'postgres'
import { runMigrations } from '../../db/src/migrate'

/** Create the database if needed, empty it, and apply the committed migrations. */
export async function prepareDatabase(url: string) {
  const admin = postgres(url.replace(/\/[^/]+$/, '/postgres'), { max: 1, onnotice: () => {} })
  const name = url.split('/').pop()!
  const exists = await admin`select 1 from pg_database where datname = ${name}`
  if (exists.length === 0) await admin.unsafe(`create database "${name}"`)
  await admin.end()
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  await sql.unsafe('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;')
  await sql.end()
  await runMigrations(url)
}

export default async function setup() {
  await prepareDatabase(process.env.MONEY_TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde_test_money')
}
