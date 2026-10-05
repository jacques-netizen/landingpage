import type { Metadata } from 'next'
import { db } from '@mde/db'
import { getPreferences, verifyPreferencesToken } from '@mde/notifications'
import { EmptyState } from '@mde/ui'
import { cookies } from 'next/headers'
import { AppFrame } from '@/components/app-frame'
import { AppHeading, panel } from '@/components/app-ui'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { saveLinkedPreferencesAction } from '../notifications/actions'
import { PrefsForm } from '../notifications/prefs-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Email preferences | Maison d'Élites", robots: { index: false } }

// Reached from the link at the foot of every notification email, without signing in.
export default async function EmailPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string }>
}) {
  const { u = '', t = '' } = await searchParams
  const valid = /^[0-9a-f-]{36}$/i.test(u) && verifyPreferencesToken(u, t)
  const prefs = valid ? await getPreferences(db(), u) : null
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <AppFrame theme={theme} active="notifications">
      <AppHeading title="Email preferences" lead="Choose which emails we send you. Updates always show in the app." />
      <section className={`${panel} max-w-[560px] p-5`} aria-label="Email preferences">
        {prefs ? (
          <PrefsForm
            action={saveLinkedPreferencesAction.bind(null, u, t)}
            email={prefs.email}
            newCampaigns={prefs.newCampaigns}
          />
        ) : (
          <EmptyState
            tone="app"
            title="This link does not work."
            body="Sign in and open Notifications to change your email preferences."
          />
        )}
      </section>
    </AppFrame>
  )
}
