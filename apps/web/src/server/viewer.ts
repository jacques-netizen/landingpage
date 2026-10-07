import 'server-only'
import { canAccess, env, type Access, type StaffRole } from '@mde/config'
import { db, tables, writeAudit } from '@mde/db'
import { and, eq, gt } from 'drizzle-orm'
import { auth } from '@/auth'

export type Viewer = { id: string; email: string; name: string | null; roles: StaffRole[] }

/**
 * The owner's addresses from ADMIN_EMAIL get the admin role the first time they are seen signed in,
 * so a fresh deploy needs no command line. Signing in proves the address. Written to the audit log.
 */
async function withOwnerAdmin(
  userId: string,
  email: string,
  verified: boolean,
  roles: StaffRole[],
): Promise<StaffRole[]> {
  // Only a proven address: a new sign-up is signed in before its email link is used.
  if (roles.includes('admin') || !verified) return roles
  const owners = (env().ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!owners.includes(email.trim().toLowerCase())) return roles
  await db().transaction(async (tx) => {
    await tx.insert(tables.staffRoles).values({ userId, role: 'admin' }).onConflictDoNothing()
    await writeAudit(tx, {
      actorId: null,
      action: 'staff.grant',
      entity: 'user',
      entityId: userId,
      after: { role: 'admin', via: 'ADMIN_EMAIL' },
    })
  })
  return [...roles, 'admin']
}

/** The signed-in person and their staff roles, read on the server for every request. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  const [u] = await db().select().from(tables.users).where(eq(tables.users.id, id))
  if (!u || u.status === 'closed') return null
  const roles = await db()
    .select({ role: tables.staffRoles.role })
    .from(tables.staffRoles)
    .where(eq(tables.staffRoles.userId, id))
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    roles: await withOwnerAdmin(
      u.id,
      u.email,
      !!u.emailVerified,
      roles.map((r) => r.role as StaffRole),
    ),
  }
}

export const SESSION_COOKIES = ['__Secure-authjs.session-token', 'authjs.session-token']

/** Staff roles for a raw session token. Used by the proxy, which runs before rendering. */
export async function rolesForSessionToken(token: string): Promise<{ userId: string; roles: StaffRole[] } | null> {
  const rows = await db()
    .select({
      userId: tables.sessions.userId,
      email: tables.users.email,
      verified: tables.users.emailVerified,
      role: tables.staffRoles.role,
    })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.users.id, tables.sessions.userId))
    .leftJoin(tables.staffRoles, eq(tables.staffRoles.userId, tables.sessions.userId))
    .where(
      and(
        eq(tables.sessions.sessionToken, token),
        gt(tables.sessions.expires, new Date()),
        eq(tables.users.status, 'active'),
      ),
    )
  if (rows.length === 0) return null
  const { userId, email, verified } = rows[0]!
  const roles = rows.flatMap((r) => (r.role ? [r.role as StaffRole] : []))
  return { userId, roles: await withOwnerAdmin(userId, email, !!verified, roles) }
}

export function hasAccess(viewer: Pick<Viewer, 'roles'> | null, access: Access) {
  return !!viewer && canAccess(viewer.roles, access)
}
