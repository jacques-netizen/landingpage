import type { Metadata } from 'next'
import { db } from '@mde/db'
import { CREATOR_FILTERS, CREATOR_STATE, listCreatorSubmissions } from '@mde/submissions'
import { EmptyState } from '@mde/ui'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppFrame } from '@/components/app-frame'
import { AppHeading, panel } from '@/components/app-ui'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { reasonMessages } from '@/server/submissions'
import { getViewer } from '@/server/viewer'
import { SubmissionsTable } from './submissions-table'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Submissions | Maison d'Élites" }

// Every post the creator submitted, filterable by state; a row opens the detail drawer (01_PRODUCT.md 8.2).
// Not in the mockups, so it is built in the campaign page's style.
export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; open?: string }>
}) {
  const viewer = await getViewer()
  if (!viewer) redirect('/sign-in?next=/submissions')
  const { state, open } = await searchParams
  const filter = CREATOR_FILTERS.find((f) => f.key === state)
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  const [rows, messages] = await Promise.all([
    listCreatorSubmissions(db(), viewer.id, filter?.states),
    reasonMessages(),
  ])

  const pill = (key: string | null, label: string) => {
    const on = (filter?.key ?? null) === key
    return (
      <a
        key={label}
        href={key ? `/submissions?state=${key}` : '/submissions'}
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
    <AppFrame theme={theme} active="submissions" signedIn>
      <AppHeading title="Submissions" lead="Every post you have submitted, with its checks, views and earnings." />
      <nav aria-label="Filter by state" className="mb-4 flex flex-wrap gap-1 px-1">
        {pill(null, 'All')}
        {CREATOR_FILTERS.map((f) => pill(f.key, f.label))}
      </nav>
      <section className={`${panel} p-2 max-sm:p-1`} aria-label="Your submissions">
        {rows.length === 0 ? (
          <EmptyState
            tone="app"
            title={filter ? `Nothing ${filter.label.toLowerCase()}.` : 'No submissions yet.'}
            body={filter ? 'Try another filter.' : 'Join a campaign, post on your account, then submit the link.'}
            action={
              filter ? undefined : (
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
          <SubmissionsTable
            theme={theme === 'light' ? 'glass' : 'dark'}
            openId={open}
            rows={rows.map((r) => ({
              id: r.id,
              campaignTitle: r.campaignTitle,
              platform: r.platform,
              postUrl: r.postUrl,
              stateLabel: CREATOR_STATE[r.state]?.label ?? r.state,
              stateTone: CREATOR_STATE[r.state]?.tone ?? 'off',
              reason: r.reasonCode && r.reasonCode !== 'other' ? (messages[r.reasonCode] ?? null) : null,
              latestViews: r.latestViews,
              countedViews: r.countedViews,
              earnedCents: r.earnedCents,
              submittedAt: r.submittedAt.toISOString(),
            }))}
          />
        )}
      </section>
    </AppFrame>
  )
}
