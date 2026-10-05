// Give a person a staff role, creating their account if needed. The way the first admin is made on a
// fresh production database; after that, admins manage staff in the app.
//   pnpm staff:grant someone@example.com admin
import { STAFF_ROLES, type StaffRole } from '@mde/config'
import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { writeAudit } from './audit'
import { staffRoles, users } from './schema'

const [email, role] = process.argv.slice(2)
if (!email || !email.includes('@') || !STAFF_ROLES.includes(role as StaffRole)) {
  console.error(`Usage: pnpm staff:grant <email> <${STAFF_ROLES.join('|')}>`)
  process.exit(1)
}
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
const { db, sql } = createDb(url, { max: 1, onnotice: () => {} })
const address = email.trim().toLowerCase()
await db.transaction(async (tx) => {
  const [existing] = await tx.select().from(users).where(eq(users.email, address))
  const user = existing ?? (await tx.insert(users).values({ email: address, emailVerified: null }).returning())[0]!
  await tx
    .insert(staffRoles)
    .values({ userId: user.id, role: role as StaffRole })
    .onConflictDoNothing()
  await writeAudit(tx, {
    actorId: null,
    action: 'staff.grant',
    entity: 'user',
    entityId: user.id,
    after: { role, via: 'command line' },
  })
})
console.log(`${address} now has the ${role} role. They sign in with a magic link at /sign-in.`)
await sql.end()
