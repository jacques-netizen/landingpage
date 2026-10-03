// Usage: pnpm --filter @mde/db tsx src/grant-staff.ts <email> <reviewer|finance|admin>
// The first admin has to be made from the command line. Later changes go through the admin screens.
import { eq } from 'drizzle-orm'
import { staffRoles as roles } from '@mde/config'
import { createDb } from './client'
import { grantStaffRole } from './staff'
import { users } from './schema'

const [email, role] = process.argv.slice(2)
if (!email || !role || !(roles as readonly string[]).includes(role)) {
  console.error('Usage: grant-staff <email> <reviewer|finance|admin>')
  process.exit(1)
}
const { db, sql } = createDb()
try {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (!user) throw new Error(`No user with email ${email}. They need to sign up first.`)
  await grantStaffRole(db, { userId: user.id, role: role as (typeof roles)[number], actorId: null })
  console.log(`Granted ${role} to ${email}`)
} finally {
  await sql.end()
}
