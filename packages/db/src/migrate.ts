import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import { createDb } from './client'

export async function runMigrations(url = process.env.DATABASE_URL) {
  const { db, sql } = createDb(url, { max: 1 })
  try {
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  } finally {
    await sql.end()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations()
    .then(() => console.log('Migrations applied'))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
