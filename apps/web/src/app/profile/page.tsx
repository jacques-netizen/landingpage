import type { Metadata } from 'next'
import { db, tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppFrame } from '@/components/app-frame'
import { AppHeading } from '@/components/app-ui'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { getViewer } from '@/server/viewer'
import { ProfileForms } from './profile-forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Profile | Maison d'Élites" }

// The creator's profile: picture, username, Discord username and password (owner request,
// 2026-10-07). Not in the mockups, so it is built in the app screens' style.
export default async function ProfilePage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/sign-in?next=/profile')
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  const [u] = await db()
    .select({
      username: tables.users.username,
      discord: tables.users.discordUsername,
      image: tables.users.image,
      hasPassword: tables.users.passwordHash,
    })
    .from(tables.users)
    .where(eq(tables.users.id, viewer.id))
  return (
    <AppFrame theme={theme} active="home" signedIn>
      <AppHeading title="Profile" lead="How staff and other creators see you." />
      <ProfileForms
        email={viewer.email}
        username={u?.username ?? ''}
        discord={u?.discord ?? ''}
        image={u?.image ?? null}
        hasPassword={!!u?.hasPassword}
      />
    </AppFrame>
  )
}
