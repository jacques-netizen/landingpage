import { createDb } from '../client'
import { seedBase } from './base'
import { seedDev } from './dev'

const { db, sql } = createDb(undefined, { max: 1 })
try {
  await seedBase(db)
  console.log('Base data ready (settings, reason codes, platform accounts)')
  if (process.argv.includes('--base-only')) process.exit(0)
  const existing = await sql`select count(*)::int as n from users where email like '%@seed.invalid'`
  if ((existing[0]?.n ?? 0) > 0) {
    console.log('Dev seed data already present. Run db:reset first to rebuild it.')
  } else {
    await seedDev(db)
    console.log('Dev seed data created (fake, marked @seed.invalid)')
  }
} finally {
  await sql.end()
}
