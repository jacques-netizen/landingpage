import type { Metadata } from 'next'
import { db } from '@mde/db'
import { getPreferences, listNotifications, markAllRead } from '@mde/notifications'
import { EmptyState } from '@mde/ui'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppFrame } from '@/components/app-frame'
import { AppHeading, panel } from '@/components/app-ui'
import { LocalDateTime } from '@/components/local-time'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { getViewer } from '@/server/viewer'
import { savePreferencesAction } from './actions'
import { PrefsForm } from './prefs-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Notifications | Maison d'Élites" }

// Every notification, newest first, and the email preferences (03_SYSTEMS.md section 9). Opening the
// page marks them read; the ones that were new keep a dot for this visit. Not in the mockups, so it is
// built in the campaign page's style.
export default async function NotificationsPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/sign-in?next=/notifications')
  const d = db()
  const [rows, prefs] = await Promise.all([listNotifications(d, viewer.id), getPreferences(d, viewer.id)])
  await markAllRead(d, viewer.id)
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)

  return (
    <AppFrame theme={theme} active="notifications" signedIn>
      <AppHeading title="Notifications" lead="Decisions on your posts, earnings, appeals and new campaigns." />
      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4 max-lg:grid-cols-1">
        <section className={`${panel} p-2`} aria-label="Your notifications">
          {rows.length === 0 ? (
            <EmptyState tone="app" title="Nothing yet." body="Updates on your posts and earnings appear here." />
          ) : (
            <ul className="m-0 list-none p-0">
              {rows.map((n) => (
                <li
                  key={n.id}
                  className="border-0 border-b border-solid border-[var(--t-hair)] px-4 py-4 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="m-0 flex items-center gap-2 text-[15px] font-semibold">
                      {!n.readAt ? (
                        <span aria-label="New" className="size-[7px] flex-none rounded-full bg-[#D8C58F]" />
                      ) : null}
                      {n.link ? (
                        <a href={n.link} className="text-[var(--t-text)] no-underline hover:text-[var(--t-accent-ink)]">
                          {n.title}
                        </a>
                      ) : (
                        n.title
                      )}
                    </p>
                    <span className="flex-none text-[12px] text-[var(--t-muted)]">
                      <LocalDateTime iso={n.createdAt.toISOString()} />
                    </span>
                  </div>
                  {n.body ? <p className="mt-1 mb-0 text-[14px] text-[var(--t-muted)]">{n.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${panel} self-start p-5`} aria-label="Email preferences">
          <h2 className="m-0 mb-4 text-[18px] font-bold">Email preferences</h2>
          <PrefsForm
            action={savePreferencesAction}
            email={prefs?.email ?? true}
            newCampaigns={prefs?.newCampaigns ?? true}
          />
        </section>
      </div>
    </AppFrame>
  )
}
