import { eq } from 'drizzle-orm'
import { forbidden, redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { hasRole, isStaff, type StaffRole } from '@mde/config'
import { staffRoles, users } from '@mde/db'
import { auth } from '@/auth'
import { getDb } from '@/lib/db'

export type StaffContext = { userId: string; email: string; roles: string[] }

/** The signed in staff member, or null. Roles are read from the database on every request. */
export async function getStaff(): Promise<
  { kind: 'anonymous' } | { kind: 'not_staff' } | { kind: 'staff'; staff: StaffContext }
> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { kind: 'anonymous' }
  const db = getDb()
  const [user] = await db
    .select({ email: users.email, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user || user.status === 'closed') return { kind: 'anonymous' }
  const rows = await db
    .select({ role: staffRoles.role })
    .from(staffRoles)
    .where(eq(staffRoles.userId, userId))
  const roles = rows.map((r) => r.role)
  if (!isStaff(roles)) return { kind: 'not_staff' }
  return { kind: 'staff', staff: { userId, email: user.email, roles } }
}

/**
 * Call at the top of every /admin page and layout. A page cannot rely on its layout alone,
 * because layouts and pages render separately. Anonymous visitors go to sign in, signed in
 * people without the role get a 403.
 */
export async function requireStaffPage(min: StaffRole = 'reviewer'): Promise<StaffContext> {
  const result = await getStaff()
  if (result.kind === 'anonymous') redirect('/sign-in')
  if (result.kind === 'not_staff' || !hasRole(result.staff.roles, min)) forbidden()
  return result.staff
}

type Handler<C> = (req: Request, ctx: C & { staff: StaffContext }) => Promise<Response> | Response

/** Wraps an /api/v1/admin route handler. 401 when not signed in, 403 without the role. */
export function withStaff<C = unknown>(min: StaffRole, handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const result = await getStaff()
    if (result.kind === 'anonymous') {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Sign in first.' } },
        { status: 401 },
      )
    }
    if (result.kind === 'not_staff' || !hasRole(result.staff.roles, min)) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'You do not have access to this.' } },
        { status: 403 },
      )
    }
    return handler(req, { ...ctx, staff: result.staff })
  }
}
