import { formatDollars } from '@mde/money/dollars'
import { EmptyState } from '@mde/ui'
import type { ReactNode } from 'react'
import { requireStaff } from '@/server/guard'
import { staffDashboard } from '@/server/dashboard'
import { AdminPage } from './_components/ui'

export const dynamic = 'force-dynamic'

const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mb-10">
      <h2 className="m-0 mb-3 font-serif text-[20px] font-normal">{title}</h2>
      {children}
    </section>
  )
}

// What needs staff attention now (01_PRODUCT.md 8.4). Not in the mockups; staff style from 05 section 8.
// Payouts waiting joins this page with payouts (Phase 6).
export default async function AdminDashboard() {
  await requireStaff()
  const now = new Date()
  const d = await staffDashboard(now)
  return (
    <AdminPage title="Dashboard" lead="What needs attention today.">
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
