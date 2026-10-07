import { PLATFORM_LABELS } from '@mde/campaigns/templates'
import { db } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { SUSPENSION_SUGGESTED_AT } from '@mde/review'
import { CREATOR_STATE, listReasonCodes } from '@mde/submissions'
import { EmptyState } from '@mde/ui'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { creatorDetail } from '@/server/creators'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { AdminPage } from '../../_components/ui'
import { NotesForm, SuspendForm, WarnForm } from './forms'

export const dynamic = 'force-dynamic'

const day = (d: Date) => d.toISOString().slice(0, 10)
const platform = (p: string) => PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] ?? p
const PAYOUT: Record<string, string> = {
  none: 'Not set up',
  pending: 'Waiting for verification',
  verified: 'Verified',
  restricted: 'Restricted',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="border-0 border-b border-solid border-line py-6 text-[14px]">
      <h2 className="m-0 mb-3 font-app text-[16px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

const th = 'py-2 text-left font-normal text-muted-2'
const td = 'border-0 border-t border-solid border-line py-2'

// One creator for staff: accounts, submissions, earnings, warnings, payout status and notes, with
// warn, suspend and restore (01_PRODUCT.md 8.4, 03_SYSTEMS.md section 8). Not in the mockups; staff style.
export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await requireStaff('staff', `/admin/creators/${id}`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const c = await creatorDetail(id)
  if (!c) notFound()
  const reasons = await listReasonCodes(db())
  const now = new Date()
  const active = c.strikes.filter((w) => !w.expiresAt || w.expiresAt > now).length
  const suspended = c.user.status === 'suspended'

  return (
    <AdminPage
      title={c.user.name ?? c.user.email}
      lead={`${c.user.email} · joined ${day(c.user.createdAt)} · ${suspended ? 'Suspended' : c.user.status === 'closed' ? 'Closed' : 'Active'}`}
    >
      {active >= SUSPENSION_SUGGESTED_AT && !suspended ? (
        <p role="status" className="m-0 mb-2 text-[14px] font-medium text-bad">
          {active} active strikes. Consider suspending this creator.
        </p>
      ) : null}

      <Section title="Earnings">
        <dl className="m-0 grid grid-cols-4 gap-4 max-md:grid-cols-2">
          {[
            ['Earned', c.money.earnedCents],
            ['Pending', c.money.pendingCents],
            ['Available', c.money.availableCents],
            ['Paid out', c.money.paidOutCents],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[13px] text-muted-2">{k}</dt>
              <dd className="m-0 mt-1 text-[18px] tabular-nums">{formatDollars(v as number)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 mb-0 text-[13px]">
          Payouts: {PAYOUT[c.profile.payoutStatus] ?? c.profile.payoutStatus}. Tax form:{' '}
          {c.profile.taxStatus === 'not_collected' ? 'not collected' : c.profile.taxStatus}.
        </p>
      </Section>

      <Section title="Accounts">
        {c.accounts.length === 0 ? (
          <EmptyState body="No linked accounts." />
        ) : (
          <ul className="m-0 list-none p-0">
            {c.accounts.map((a) => (
              <li key={a.id} className="py-1">
                {platform(a.platform)} @{a.handle} · {a.status === 'verified' ? 'Verified' : a.status}
                {a.followers !== null ? ` · ${a.followers.toLocaleString('en-US')} followers` : ''}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Submissions">
        {c.posts.length === 0 ? (
          <EmptyState body="No submissions yet." />
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">Submissions, newest first</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Campaign
                </th>
                <th scope="col" className={th}>
                  State
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Counted views
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Earned
                </th>
                <th scope="col" className={th}>
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody>
              {c.posts.map((p) => (
                <tr key={p.id}>
                  <td className={td}>
                    <a href={`/admin/submissions/${p.id}`}>{p.campaignTitle}</a>{' '}
                    <span className="text-muted-2">{platform(p.platform)}</span>
                  </td>
                  <td className={td}>{CREATOR_STATE[p.state]?.label ?? p.state}</td>
                  <td className={`${td} text-right tabular-nums`}>{p.countedViews.toLocaleString('en-US')}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatDollars(p.earnedCents)}</td>
                  <td className={td}>{day(p.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Warnings">
        <p className="m-0 mb-3">
          {active} active {active === 1 ? 'strike' : 'strikes'}. A warning counts as a strike for the strike period in
          settings.
        </p>
        {c.strikes.length ? (
          <ul className="m-0 mb-6 list-none p-0">
            {c.strikes.map((w) => (
              <li key={w.id} className="py-1">
                {w.reason ?? 'Warning'} · {day(w.createdAt)} ·{' '}
                {w.expiresAt && w.expiresAt <= now
                  ? 'expired'
                  : w.expiresAt
                    ? `active until ${day(w.expiresAt)}`
                    : 'active'}
                {w.note ? <span className="text-muted-2"> · {w.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        <WarnForm id={c.user.id} reasons={reasons.map((r) => ({ value: r.code, label: r.label }))} />
      </Section>

      {hasAccess(viewer, 'admin') && c.user.status !== 'closed' ? (
        <Section title={suspended ? 'Restore' : 'Suspend'}>
          <p className="m-0 mb-4 text-muted-2">
            {suspended
              ? 'Restoring lets them submit posts and withdraw again.'
              : 'A suspended creator cannot submit posts or withdraw. Earnings already pending are kept.'}
          </p>
          <SuspendForm id={c.user.id} suspended={suspended} />
        </Section>
      ) : null}

      <Section title="Notes">
        <NotesForm id={c.user.id} notes={c.profile.staffNotes} />
      </Section>
    </AdminPage>
  )
}
