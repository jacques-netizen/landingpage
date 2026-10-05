import postgres from 'postgres'
import { runMigrations } from '../../db/src/migrate'

export default async function setup() {
  const url = process.env.MONEY_TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde_test_money'
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
