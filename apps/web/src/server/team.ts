import 'server-only'
import { brand, env, STAFF_ROLES, type StaffRole } from '@mde/config'
import { db, tables, writeAudit } from '@mde/db'
import { and, asc, eq, sql } from 'drizzle-orm'
import { escapeHtml, sendEmail } from './email'

// The staff team: who has which role. Admins add and remove people here; every change is audited.
export const ROLE_LABEL: Record<StaffRole, { name: string; can: string }> = {
  reviewer: { name: 'Moderator', can: 'Reviews posts, answers appeals, warns creators.' },
  finance: { name: 'Finance', can: 'Clients, funding, campaigns and money, plus everything a moderator does.' },
  admin: { name: 'Admin', can: 'Everything, including the team and settings.' },
}

export class TeamError extends Error {}

export async function listTeam() {
  const rows = await db()
    .select({
      id: tables.users.id,
      email: tables.users.email,
      name: tables.users.name,
      role: tables.staffRoles.role,
      since: tables.staffRoles.createdAt,
    })
    .from(tables.staffRoles)
    .innerJoin(tables.users, eq(tables.users.id, tables.staffRoles.userId))
    .orderBy(asc(tables.users.email))
  const byUser = new Map<string, { id: string; email: string; name: string | null; roles: StaffRole[]; since: Date }>()
  for (const r of rows) {
    const u = byUser.get(r.id) ?? { id: r.id, email: r.email, name: r.name, roles: [], since: r.since }
    u.roles.push(r.role as StaffRole)
    if (r.since < u.since) u.since = r.since
    byUser.set(r.id, u)
  }
  return [...byUser.values()]
}

export const ownerEmails = () =>
  (env().ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

/** Give someone a role, creating their account if they have none, and email them how to sign in. */
export async function addTeamMember(adminId: string, rawEmail: string, role: string) {
  const email = rawEmail.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new TeamError('Enter an email address, like name@example.com.')
  if (!STAFF_ROLES.includes(role as StaffRole)) throw new TeamError('Choose a role.')
  const added = await db().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(tables.users)
      .where(sql`email = ${email}`)
    const user = existing ?? (await tx.insert(tables.users).values({ email }).returning())[0]!
    const [had] = await tx
      .select()
      .from(tables.staffRoles)
      .where(and(eq(tables.staffRoles.userId, user.id), eq(tables.staffRoles.role, role)))
    if (had) return false
    await tx.insert(tables.staffRoles).values({ userId: user.id, role })
    await writeAudit(tx, {
      actorId: adminId,
      action: 'staff.grant',
      entity: 'user',
      entityId: user.id,
      after: { role, email },
    })
    return true
  })
  if (!added) throw new TeamError(`${email} is already a ${ROLE_LABEL[role as StaffRole].name.toLowerCase()}.`)
  const { name } = brand()
  const url = `${env().APP_URL.replace(/\/$/, '')}/staff/sign-in`
  await sendEmail({
    to: email,
    subject: `You have been added to the ${name} team`,
    text: `You now have ${ROLE_LABEL[role as StaffRole].name} access to ${name}. Sign in with this email address at ${url}`,
    html: `<p style="font:15px/1.5 Archivo,Arial,sans-serif;color:#1A1510">You now have ${escapeHtml(ROLE_LABEL[role as StaffRole].name)} access to ${escapeHtml(name)}. Sign in with this email address.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#1A1510;color:#fff;font:500 15px Archivo,Arial,sans-serif;text-decoration:none">Staff sign in</a></p>`,
  }).catch((e) => console.error(JSON.stringify({ level: 'error', msg: 'team invite email failed', err: String(e) })))
}

export async function removeTeamRole(adminId: string, userId: string, role: string) {
  if (userId === adminId && role === 'admin') throw new TeamError('You cannot remove your own admin access.')
  await db().transaction(async (tx) => {
    const [u] = await tx.select().from(tables.users).where(eq(tables.users.id, userId))
    if (!u) throw new TeamError('This person does not exist.')
    if (role === 'admin' && ownerEmails().includes(u.email.toLowerCase()))
      throw new TeamError('This address is an owner (set in ADMIN_EMAIL on the server). Remove it there first.')
    const gone = await tx
      .delete(tables.staffRoles)
      .where(and(eq(tables.staffRoles.userId, userId), eq(tables.staffRoles.role, role)))
      .returning()
    if (!gone.length) return
    await writeAudit(tx, {
      actorId: adminId,
      action: 'staff.revoke',
      entity: 'user',
      entityId: userId,
      before: { role },
    })
    // Their open sessions keep working only for what they still have: roles are read on every request.
  })
}
