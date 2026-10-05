import type { Metadata } from 'next'
import { formatDollars } from '@mde/money/dollars'
import { EmptyState } from '@mde/ui'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppFrame } from '@/components/app-frame'
import { AppHeading, panel, StatusDot } from '@/components/app-ui'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { myCampaigns } from '@/server/my-campaigns'
import { getViewer } from '@/server/viewer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "My campaigns | Maison d'Élites" }

const count = (n: number) => n.toLocaleString('en-US')
const ACTIVE = ['live', 'closing']

// Campaigns joined, with posts, counted views and earnings per campaign; filters active and closed
// (01_PRODUCT.md 8.2). Not in the mockups, so it is built in the campaign page's style.
export default async function MyCampaignsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const viewer = await getViewer()
  if (!viewer) redirect('/sign-in?next=/my-campaigns')
  const { show = 'active' } = await searchParams
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  const all = await myCampaigns(viewer.id)
  const rows = all.filter((c) => (show === 'closed' ? !ACTIVE.includes(c.status) : ACTIVE.includes(c.status)))

  const pill = (key: string, label: string) => {
    const on = show === key
    return (
      <a
        key={key}
        href={`/my-campaigns?show=${key}`}
        aria-current={on ? 'true' : undefined}
        className="flex h-[34px] items-center gap-2 rounded-pill px-[14px] text-[13px] font-semibold no-underline"
        style={{
          background: on ? 'rgba(216,197,143,0.2)' : 'transparent',
          color: on ? 'var(--t-accent-ink)' : 'var(--t-muted)',
        }}
      >
        <span aria-hidden className="size-[5px] rounded-full" style={{ background: 'currentColor' }} />
        {label}
      </a>
    )
  }

  return (
    <AppFrame theme={theme} active="my-campaigns" signedIn>
      <AppHeading
        title="My campaigns"
        lead="Campaigns you have joined, with your posts, counted views and earnings in each."
      />
      <nav aria-label="Filter campaigns" className="mb-4 flex gap-1 px-1">
        {pill('active', 'Active')}
        {pill('closed', 'Closed')}
      </nav>
      <section className={`${panel} p-2`} aria-label="Campaigns you joined">
        {rows.length === 0 ? (
          <EmptyState
            tone="app"
            title={show === 'closed' ? 'No closed campaigns yet.' : 'No active campaigns.'}
            body={
              show === 'closed'
                ? 'Campaigns you joined appear here once they close.'
                : 'Join a campaign to start posting and earning.'
            }
            action={
              show === 'closed' ? undefined : (
                <a
                  href="/campaigns"
                  className="flex h-11 items-center gap-2 rounded-[14px] bg-gold-soft px-[22px] text-[14px] font-bold text-ink no-underline hover:text-ink"
                >
                  Browse campaigns <span aria-hidden>→</span>
                </a>
              )
            }
          />
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse font-app">
              <caption className="sr-only">Campaigns you joined</caption>
              <thead>
                <tr className="text-left text-[12px] text-[var(--t-muted)]">
                  <th scope="col" className="px-3 py-3 font-semibold">
                    Campaign
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Posts
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Counted views
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">
                    Earnings
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="border-0 border-t border-solid border-[var(--t-hair)] px-3 py-[14px]">
                      <a
                        href={`/campaigns/${c.id}`}
                        className="text-[14px] font-semibold text-[var(--t-text)] no-underline hover:text-[var(--t-accent-ink)]"
                      >
                        {c.title}
                      </a>
                      <div className="mt-1 flex items-center gap-3 text-[12px] text-[var(--t-muted)]">
                        <StatusDot tone={c.status === 'live' ? 'good' : c.status === 'closing' ? 'wait' : 'off'}>
                          {c.status === 'live'
                            ? 'Live'
                            : c.status === 'closing'
                              ? 'Closing'
                              : c.status === 'closed'
                                ? 'Closed'
                                : 'Ended'}
                        </StatusDot>
                        <span>{formatDollars(c.rateCentsPer1000)} per 1,000 views</span>
                      </div>
                    </td>
                    <td className="border-0 border-t border-solid border-[var(--t-hair)] px-3 py-[14px] text-right text-[13px] tabular-nums">
                      {c.posts}
                    </td>
                    <td className="border-0 border-t border-solid border-[var(--t-hair)] px-3 py-[14px] text-right text-[13px] tabular-nums">
                      {count(c.countedViews)}
                    </td>
                    <td className="border-0 border-t border-solid border-[var(--t-hair)] px-3 py-[14px] text-right text-[13px] font-semibold tabular-nums">
                      {formatDollars(c.earnedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppFrame>
  )
}
