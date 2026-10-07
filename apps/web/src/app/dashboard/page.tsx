import type { Metadata } from 'next'
import { PLATFORM_LABELS, type Platform } from '@mde/campaigns'
import { formatDollars } from '@mde/money/dollars'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppFrame } from '@/components/app-frame'
import { AppHeading, panel, StatusDot } from '@/components/app-ui'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { rating } from '@/designed/wallet-model'
import { creatorHome } from '@/server/creator-home'
import { getViewer } from '@/server/viewer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Home | Maison d'Élites" }

const count = (n: number) => n.toLocaleString('en-US')

// The creator's Home (testing report item 3): who they are, their tier and linked accounts, and their
// own totals. Not in the mockups, so it is built in the app screens' style; every figure is real.
export default async function DashboardPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/sign-in?next=/dashboard')
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  const me = await creatorHome(viewer.id)
  const tier = rating(me.countedViews)
  const stats: [string, string][] = [
    ['Total earnings', formatDollars(me.earnedCents)],
    ['Counted views', count(me.countedViews)],
    ['Submissions', count(me.submissions)],
    ['Campaigns joined', count(me.campaignsJoined)],
  ]
  return (
    <AppFrame theme={theme} active="home" signedIn>
      <AppHeading title="Home" lead="Your profile and your totals across every campaign." />
      <section className={`${panel} mb-4 flex flex-wrap items-center gap-6 p-6`} aria-label="Profile">
        <div className="min-w-0 flex-1">
          <div className="text-[22px] font-bold break-words">{me.name?.trim() || me.email}</div>
          {me.name?.trim() ? <div className="mt-1 text-[13px] text-[var(--t-muted)]">{me.email}</div> : null}
        </div>
        <div className="text-right">
          <div className="text-[12px] font-semibold text-[var(--t-muted)]">Tier</div>
          <div className="mt-1 text-[18px] font-bold text-[var(--t-accent-ink)]">{tier.label}</div>
          <div className="mt-1 text-[12px] text-[var(--t-muted)]">{tier.progress}</div>
        </div>
      </section>
      <section className="mb-4 grid grid-cols-4 gap-3 max-md:grid-cols-2" aria-label="Your totals">
        {stats.map(([label, value]) => (
          <div key={label} className={`${panel} p-5`}>
            <div className="text-[12px] font-semibold text-[var(--t-muted)]">{label}</div>
            <div className="mt-2 text-[26px] font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </section>
      <section className={`${panel} p-6`} aria-labelledby="linked-accounts">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="linked-accounts" className="m-0 text-[16px] font-bold">
            Linked accounts
          </h2>
          <a href="/accounts" className="text-[13px] font-semibold text-[var(--t-accent-ink)] no-underline">
            Manage accounts <span aria-hidden>→</span>
          </a>
        </div>
        {me.accounts.length === 0 ? (
          <p className="m-0 text-[14px] text-[var(--t-muted)]">
            No accounts linked yet. Link one to join campaigns and submit posts.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {me.accounts.map((a) => (
              <li
                key={`${a.platform}:${a.handle}`}
                className="flex items-center justify-between gap-3 border-0 border-t border-solid border-[var(--t-hair)] py-3 first:border-t-0"
              >
                <span className="text-[14px]">
                  <span className="font-semibold">{PLATFORM_LABELS[a.platform as Platform] ?? a.platform}</span>{' '}
                  <span className="text-[var(--t-muted)]">@{a.handle}</span>
                </span>
                <StatusDot tone={a.status === 'verified' ? 'good' : a.status === 'pending' ? 'wait' : 'bad'}>
                  {a.status === 'verified' ? 'Verified' : a.status === 'pending' ? 'Pending' : 'Needs attention'}
                </StatusDot>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppFrame>
  )
}
