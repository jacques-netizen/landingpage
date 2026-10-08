import type { Metadata } from 'next'
import { PLATFORM_LABELS, type Platform } from '@mde/campaigns'
import { formatDollars } from '@mde/money/dollars'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppFrame } from '@/components/app-frame'
import { panel, StatusDot } from '@/components/app-ui'
import { AvatarImage } from '@/components/avatar-image'
import { ACCOUNT_LINKING } from '@/lib/features'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { rating } from '@/designed/wallet-model'
import { creatorHome, type Split } from '@/server/creator-home'
import { myCampaigns } from '@/server/my-campaigns'
import { getViewer } from '@/server/viewer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Home | Maison d'Élites" }

const count = (n: number) => n.toLocaleString('en-US')
const GOOD = '#4FB286'
const WAIT = '#E0A94A'
const BAD = '#E5675C'

function Chips({ split, label }: { split: Split; label: string }) {
  const chip = (n: number, colour: string, word: string) => (
    <span
      className="inline-flex h-8 items-center gap-2 rounded-[10px] px-3 text-[13px] font-bold tabular-nums"
      style={{ background: `${colour}26`, color: colour }}
      title={`${word} ${label}`}
    >
      <span aria-hidden className="size-[7px] rounded-full" style={{ background: colour }} />
      <span className="sr-only">{word}: </span>
      {count(n)}
    </span>
  )
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {chip(split.approved, GOOD, 'Approved')}
      {chip(split.pending, WAIT, 'Pending')}
      {chip(split.rejected, BAD, 'Rejected')}
    </div>
  )
}

function Tile({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-solid border-[var(--t-hair)] bg-[var(--t-side)] p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--t-muted)]">
        {label}
        {action}
      </div>
      <div className="mt-2 text-[24px] font-bold tabular-nums">{children}</div>
    </div>
  )
}

// The creator's Home (testing report item 3, laid out like the reference Kymen sent on 2026-10-07):
// profile, earnings, views and submissions, then active campaigns. Every figure is the creator's own.
export default async function DashboardPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/sign-in?next=/dashboard')
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  const [me, joined] = await Promise.all([creatorHome(viewer.id), myCampaigns(viewer.id)])
  const name = me.username ?? me.email.split('@')[0]!
  const tier = rating(me.countedViews)
  const decided = me.posts.approved + me.posts.rejected
  const approval = decided ? `${Math.round((me.posts.approved * 100) / decided)}%` : 'N/A'
  const active = joined.filter((c) => c.status === 'live' || c.status === 'closing').slice(0, 4)
  const viewsTotal = me.views.approved + me.views.pending + me.views.rejected
  const postsTotal = me.posts.approved + me.posts.pending + me.posts.rejected

  return (
    <AppFrame theme={theme} active="home" signedIn>
      <h1 className="m-0 mb-5 px-2 pt-2 text-[40px] leading-[1.05] font-bold tracking-[-0.02em] max-sm:text-[30px]">
        Welcome back, {name}
      </h1>

      <div className="grid grid-cols-[1.1fr_1fr] gap-4 max-lg:grid-cols-1">
        <section
          aria-label="Profile"
          className={`${panel} p-6`}
          style={{ backgroundImage: 'linear-gradient(120deg, transparent 45%, rgba(216,197,143,0.16))' }}
        >
          <div className="flex items-center gap-5">
            <AvatarImage src={me.image} name={name} size={104} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[26px] font-bold">{name}</span>
                <a
                  href="/profile"
                  aria-label="Edit profile"
                  className="text-[18px] text-[var(--t-muted)] no-underline hover:text-[var(--t-accent-ink)]"
                >
                  ✎
                </a>
              </div>
              <div className="mt-1 text-[14px] text-[var(--t-muted)]">
                Member since{' '}
                {me.memberSince.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex h-8 items-center rounded-pill border border-solid border-[var(--t-glass-line)] px-3 text-[13px] font-semibold">
                  Approval rate: {approval}
                </span>
                <span className="inline-flex h-8 items-center rounded-pill border border-solid border-[rgba(216,197,143,0.5)] px-3 text-[13px] font-semibold text-[var(--t-accent-ink)]">
                  {tier.label}
                </span>
              </div>
            </div>
          </div>

          {!ACCOUNT_LINKING ? (
            <a
              href="/campaigns"
              className="mt-5 flex items-center justify-between gap-4 rounded-[16px] border border-solid border-[rgba(216,197,143,0.45)] bg-[rgba(216,197,143,0.1)] px-5 py-4 text-[var(--t-text)] no-underline"
            >
              <span>
                <span className="block text-[16px] font-bold">Join a campaign to get started</span>
                <span className="mt-1 block text-[13px] text-[var(--t-muted)]">
                  Post on your own account and submit the link to start earning
                </span>
              </span>
              <span aria-hidden className="text-[20px] text-[var(--t-accent-ink)]">
                →
              </span>
            </a>
          ) : me.accounts.length === 0 ? (
            <a
              href="/accounts"
              className="mt-5 flex items-center justify-between gap-4 rounded-[16px] border border-solid border-[rgba(216,197,143,0.45)] bg-[rgba(216,197,143,0.1)] px-5 py-4 text-[var(--t-text)] no-underline"
            >
              <span>
                <span className="block text-[16px] font-bold">Connect an account to get started</span>
                <span className="mt-1 block text-[13px] text-[var(--t-muted)]">
                  Link your social accounts to start earning
                </span>
              </span>
              <span aria-hidden className="text-[20px] text-[var(--t-accent-ink)]">
                →
              </span>
            </a>
          ) : (
            <ul className="m-0 mt-5 flex list-none flex-col p-0" aria-label="Linked accounts">
              {me.accounts.map((a) => (
                <li
                  key={`${a.platform}:${a.handle}`}
                  className="flex items-center justify-between gap-3 border-0 border-t border-solid border-[var(--t-hair)] py-[10px] text-[14px] first:border-t-0"
                >
                  <span>
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

          <div className="mt-5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            {ACCOUNT_LINKING ? <Tile label="Followers">{count(me.followers)}</Tile> : null}
            {!ACCOUNT_LINKING ? <Tile label="Approved posts">{count(me.posts.approved)}</Tile> : null}
            {!ACCOUNT_LINKING ? <Tile label="In review">{count(me.posts.pending)}</Tile> : null}
            {ACCOUNT_LINKING ? (
              <Tile
                label="Pages"
                action={
                  <a href="/accounts" aria-label="Link an account" className="text-[var(--t-accent-ink)] no-underline">
                    ⊕
                  </a>
                }
              >
                {count(me.accounts.length)}
              </Tile>
            ) : null}
            <Tile label="Campaigns">{count(me.campaignsJoined)}</Tile>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section aria-label="Earnings" className={`${panel} flex flex-wrap items-center justify-between gap-5 p-6`}>
            <div>
              <div className="text-[14px] font-semibold text-[var(--t-muted)]">Total earnings</div>
              <div className="mt-2 text-[44px] leading-none font-bold text-[var(--t-accent-ink)] tabular-nums">
                {formatDollars(me.earnedCents)}
              </div>
              <div className="mt-3 text-[14px] text-[var(--t-muted)]">
                Pending earnings{' '}
                <span className="font-bold text-[#E0A94A] tabular-nums">{formatDollars(me.pendingCents)}</span>
              </div>
            </div>
            <a
              href="/my-campaigns"
              className="flex h-12 items-center rounded-[14px] bg-gold-soft px-6 text-[15px] font-bold text-[#1A1510] no-underline hover:text-[#1A1510]"
            >
              My campaigns
            </a>
          </section>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <section aria-label="Total views" className={`${panel} p-6`}>
              <div className="text-[14px] font-semibold text-[var(--t-muted)]">Total views</div>
              <div className="mt-2 text-[32px] font-bold tabular-nums">{count(viewsTotal)}</div>
              <Chips split={me.views} label="views" />
            </section>
            <section aria-label="Submissions" className={`${panel} p-6`}>
              <div className="text-[14px] font-semibold text-[var(--t-muted)]">Submissions</div>
              <div className="mt-2 text-[32px] font-bold tabular-nums">{count(postsTotal)}</div>
              <Chips split={me.posts} label="submissions" />
            </section>
          </div>
        </div>
      </div>

      <section aria-labelledby="active-campaigns" className="mt-8 px-2">
        <div className="mb-3 flex items-baseline gap-4">
          <h2 id="active-campaigns" className="m-0 text-[24px] font-bold">
            Active
          </h2>
          <a href="/my-campaigns" className="text-[14px] font-semibold text-[var(--t-accent-ink)] no-underline">
            View all ›
          </a>
        </div>
        {active.length === 0 ? (
          <p className="m-0 text-[14px] text-[var(--t-muted)]">
            No active campaigns yet.{' '}
            <a href="/campaigns" className="text-[var(--t-accent-ink)]">
              Browse campaigns
            </a>
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {active.map((c) => (
              <a
                key={c.id}
                href={`/campaigns/${c.id}`}
                className={`${panel} block p-4 text-[var(--t-text)] no-underline`}
              >
                <div className="truncate text-[15px] font-bold">{c.title}</div>
                <div className="mt-1 text-[12px] text-[var(--t-muted)]">
                  {formatDollars(c.rateCentsPer1000)} per 1,000 views
                </div>
                <div className="mt-3 text-[13px]">
                  {c.posts} posts · {formatDollars(c.earnedCents)} earned
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </AppFrame>
  )
}
