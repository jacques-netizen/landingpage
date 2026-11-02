import { migrate } from 'drizzle-orm/postgres-js/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REASON_CODES } from '@mde/config'
import { importArchivedClips } from './archived-clips-import'
import { createDb } from './client'
import { reasonCodes } from './schema'
import { seedSettingsDefaults } from './settings'

export async function runMigrations(url: string) {
  const { db, sql } = createDb(url, { max: 1, onnotice: () => {} })
  const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
  await migrate(db, { migrationsFolder: folder })
  // Reference data every environment needs. Existing rows (and staff edits to them) are kept.
  await seedSettingsDefaults(db)
  await db
    .insert(reasonCodes)
    .values(REASON_CODES.map(([code, label, creatorMessage]) => ({ code, label, creatorMessage })))
    .onConflictDoNothing()
  // One-off data the owner asked for (2026-11-02); never blocks a deploy.
  try {
    await importArchivedClips(db)
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'archived clips import failed', err: String(err) }))
  }
  await sql.end()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  await runMigrations(url)
  console.log('Migrations applied')
}
