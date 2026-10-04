import 'server-only'
import { canAccess, type Access, type StaffRole } from '@mde/config'
import { db, tables } from '@mde/db'
import { and, eq, gt } from 'drizzle-orm'
import { auth } from '@/auth'

export type Viewer = { id: string; email: string; name: string | null; roles: StaffRole[] }

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
  return { id: u.id, email: u.email, name: u.name, roles: roles.map((r) => r.role as StaffRole) }
}

export const SESSION_COOKIES = ['__Secure-authjs.session-token', 'authjs.session-token']

/** Staff roles for a raw session token. Used by the proxy, which runs before rendering. */
export async function rolesForSessionToken(token: string): Promise<{ userId: string; roles: StaffRole[] } | null> {
  const rows = await db()
    .select({ userId: tables.sessions.userId, role: tables.staffRoles.role })
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
  return { userId: rows[0]!.userId, roles: rows.flatMap((r) => (r.role ? [r.role as StaffRole] : [])) }
}

export function hasAccess(viewer: Pick<Viewer, 'roles'> | null, access: Access) {
  return !!viewer && canAccess(viewer.roles, access)
}
