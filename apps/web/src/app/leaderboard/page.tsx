import type { Metadata } from 'next'
import { EmptyState } from '@mde/ui'
import { cookies } from 'next/headers'
import { AppFrame } from '@/components/app-frame'
import { AppHeading, panel } from '@/components/app-ui'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { leaderboard } from '@/server/creator-home'
import { getViewer } from '@/server/viewer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Leaderboard | Maison d'Élites" }

const count = (n: number) => n.toLocaleString('en-US')

// Testing report item 13. Not in the mockups, so it is built in the app screens' style. Creators are
// ranked by counted views on approved posts; a private profile shows without its name.
export default async function LeaderboardPage() {
  const [viewer, jar] = await Promise.all([getViewer(), cookies()])
  const theme = readThemeCookie(jar.get(THEME_COOKIE)?.value)
  const rows = await leaderboard()
  const cell = 'border-0 border-t border-solid border-[var(--t-hair)] px-3 py-[14px] text-[13px]'
  return (
    <AppFrame theme={theme} active="leaderboard" signedIn={!!viewer}>
      <AppHeading title="Leaderboard" lead="Creators ranked by counted views on approved posts, all time." />
      <section className={`${panel} p-2`} aria-label="Leaderboard">
        {rows.length === 0 ? (
          <EmptyState
            tone="app"
            title="No one on the board yet."
            body="Creators appear here once their first post is approved and counted."
          />
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse font-app">
              <caption className="sr-only">Creators ranked by counted views</caption>
              <thead>
                <tr className="text-left text-[12px] text-[var(--t-muted)]">
                  <th scope="col" className="w-[64px] px-3 py-3 font-semibold">
                    Rank
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Creator
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Approved posts
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Counted views
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const you = r.creatorId === viewer?.id
                  return (
                    <tr key={r.creatorId} style={you ? { background: 'rgba(216,197,143,0.12)' } : undefined}>
                      <td className={`${cell} font-bold tabular-nums`}>{r.rank}</td>
                      <td className={`${cell} font-semibold`}>
                        {r.name}
                        {you ? <span className="ml-2 text-[var(--t-accent-ink)]">You</span> : null}
                      </td>
                      <td className={`${cell} text-right tabular-nums`}>{count(r.posts)}</td>
                      <td className={`${cell} text-right font-semibold tabular-nums`}>{count(r.views)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppFrame>
  )
}
