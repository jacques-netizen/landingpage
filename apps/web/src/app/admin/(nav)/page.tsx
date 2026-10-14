import { formatDollars } from '@mde/money/dollars'
import { EmptyState } from '@mde/ui'
import type { ReactNode } from 'react'
import { db } from '@mde/db'
import { unreadCount } from '@mde/notifications'
import { requireStaff } from '@/server/guard'
import { PLATFORM_LABELS } from '@mde/campaigns/templates'
import { platformsWithoutProvider } from '@/server/providers'
import { workerStatus } from '@/server/worker-status'
import { staffDashboard } from '@/server/dashboard'
import { AdminPage, Notice } from './_components/ui'

export const dynamic = 'force-dynamic'

const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mb-10">
      <h2 className="m-0 mb-3 font-app text-[16px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

// What needs staff attention now (01_PRODUCT.md 8.4). Not in the mockups; staff style from 05 section 8.
// Payouts waiting joins this page with payouts (Phase 6).
export default async function AdminDashboard() {
  const viewer = await requireStaff()
  const now = new Date()
  const [d, unread] = await Promise.all([staffDashboard(now), unreadCount(db(), viewer.id)])
  const missingProviders = platformsWithoutProvider()
  const worker = await workerStatus()
  return (
    <AdminPage
      title="Dashboard"
      lead="What needs attention today."
      actions={
        <a href="/admin/notifications" className="text-[14px]">
          Notifications{unread ? ` (${unread} new)` : ''}
        </a>
      }
    >
      {worker.minutesAgo === null || worker.minutesAgo > 10 ? (
        <Notice kind="bad">
          The worker has not reported{worker.lastSeen ? ` for ${worker.minutesAgo} minutes` : ' since it was deployed'}.
          View checks, releases and emails run on the worker service in Railway: check that it is running and has the
          same settings as the web service.
        </Notice>
      ) : null}
      {worker.tracking
        .filter((c) => c.checksUnavailable24h > 0 && c.checksWithViews24h === 0)
        .map((c) => (
          <Notice key={c.id} kind="bad">
            The data provider refused every view check on {c.title} in the last 24 hours ({c.checksUnavailable24h}{' '}
            checks). Its last answer: {c.lastProviderError ?? 'no detail'}. No views are counted until this is fixed.
          </Notice>
        ))}
      {worker.stale.length ? (
        <Notice kind="bad">
          No view snapshot for over 3 hours on {worker.stale.map((c) => c.title).join(', ')}. Open the campaign and use
          Refresh stats now, then check the worker.
        </Notice>
      ) : null}
      {d.proofsWaiting ? (
        <Notice kind="ok">
          {d.proofsWaiting} view {d.proofsWaiting === 1 ? 'proof is' : 'proofs are'} waiting for a decision.{' '}
          <a href="/admin/review/proofs" className="text-ink">
            Open view proofs
          </a>
          .
        </Notice>
      ) : null}
      {missingProviders.length ? (
        <Notice kind="bad">
          No data provider is set up for {missingProviders.map((p) => PLATFORM_LABELS[p] ?? p).join(', ')}. Posts there
          are kept for review without their stats and no views are counted until one is. Set DATA_PROVIDER_API_KEY
          {missingProviders.includes('youtube') ? ' and YOUTUBE_API_KEY' : ''} on the server.
        </Notice>
      ) : null}
      <Section title="Posts waiting for review">
        {d.waiting === 0 ? (
          <EmptyState body="The review queue is empty." />
        ) : (
          <p className="m-0 text-[14px]">
            <a href="/admin/review" className="font-medium">
              {d.waiting.toLocaleString('en-US')} {d.waiting === 1 ? 'post' : 'posts'} waiting
            </a>
            {d.flagged ? `, ${d.flagged} flagged` : ''}.
            {d.oldestWaiting ? <span className="text-muted-2"> Oldest submitted {when(d.oldestWaiting)}.</span> : null}
          </p>
        )}
      </Section>

      <Section title="Appeals due within 24 hours">
        {d.appeals.length === 0 ? (
          <EmptyState body="No appeal is due within 24 hours." />
        ) : (
          <ul className="m-0 list-none p-0 text-[14px]">
            {d.appeals.map((a) => (
              <li key={a.id} className="border-0 border-t border-solid border-line py-3 first:border-t-0">
                <a href={`/admin/appeals/${a.id}`} className="font-medium">
                  {a.name ?? a.email}
                </a>{' '}
                <span className="text-muted-2">{a.campaignTitle}.</span>{' '}
                <span className={a.dueAt <= now ? 'font-medium text-bad' : 'font-medium text-[#B26A00]'}>
                  {a.dueAt <= now ? 'Late, was due' : 'Reply by'} {when(a.dueAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Campaigns near the end of their budget">
        {d.nearEnd.length === 0 ? (
          <EmptyState body="No live campaign has 10% or less of its budget left." />
        ) : (
          <ul className="m-0 list-none p-0 text-[14px]">
            {d.nearEnd.map((c) => (
              <li key={c.id} className="border-0 border-t border-solid border-line py-3 first:border-t-0">
                <a href={`/admin/campaigns/${c.id}/monitor`} className="font-medium">
                  {c.title}
                </a>{' '}
                <span className="text-muted-2">
                  {formatDollars(c.leftCents)} left of {formatDollars(c.budgetCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AdminPage>
  )
}
