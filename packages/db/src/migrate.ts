import { migrate } from 'drizzle-orm/postgres-js/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REASON_CODES } from '@mde/config'
import { importArchivedClips } from './archived-clips-import'
import { createDb } from './client'
import { deploys, reasonCodes } from './schema'
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
  // Record the deploy (owner, 2026-11-09): which commit is going live, from which branch, by whom. Railway
  // sets these for a deploy from GitHub; elsewhere (local, CI) nothing is recorded. Never blocks a deploy.
  try {
    const sha = process.env.RAILWAY_GIT_COMMIT_SHA
    if (sha)
      await db
        .insert(deploys)
        .values({
          commitSha: sha,
          branch: process.env.RAILWAY_GIT_BRANCH || null,
          message: (process.env.RAILWAY_GIT_COMMIT_MESSAGE ?? '').split('\n')[0]!.slice(0, 300) || null,
          author: process.env.RAILWAY_GIT_AUTHOR || null,
          railwayDeploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null,
        })
        .onConflictDoNothing()
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'deploy record failed', err: String(err) }))
  }
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
