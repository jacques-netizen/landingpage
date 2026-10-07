import { CAMPAIGN_STATUS } from '@mde/campaigns/status'
import { campaignFigures } from '@mde/campaigns'
import { db, tables } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { CREATOR_STATE } from '@mde/submissions/states'
import { EmptyState, StatusBadge } from '@mde/ui'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/server/guard'
import { campaignMonitor } from '@/server/monitor'
import { AdminPage, LinkButton } from '../../../_components/ui'
import { CampaignActions } from '../../campaign-actions'

export const dynamic = 'force-dynamic'

const count = (n: number) => n.toLocaleString('en-US')
const STATE_ORDER = [
  'checking',
  'needs_review',
  'needs_info',
  'flagged',
  'approved',
  'earning',
  'final',
  'paid_out',
  'appealed',
  'rejected_auto',
  'rejected',
  'removed',
]
const STATE_STAFF_LABEL: Record<string, string> = {
  checking: 'Checking',
  needs_review: 'Waiting for review',
  needs_info: 'Needs info',
  flagged: 'Flagged',
  approved: 'Approved',
  earning: 'Earning',
  final: 'Final',
  paid_out: 'Paid out',
  appealed: 'Appeal open',
  rejected_auto: 'Rejected by checks',
  rejected: 'Rejected',
  removed: 'Removed',
}
const FLAG_LABEL: Record<string, string> = {
  view_jump: 'View jump',
  engagement_below_floor: 'Low engagement',
  duplicate_media: 'Same clip posted before',
  wrong_author: 'Wrong author',
  follower_drop: 'Follower drop',
}

// The campaign monitor (01_PRODUCT.md 8.4): budget gauge in dollars, posts by state, flagged posts,
// top creators and closing controls. Not in the mockups; staff screen style from 05_DESIGN_SYSTEM.md.
export default async function CampaignMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireStaff('staff', `/admin/campaigns/${id}/monitor`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [c] = await db().select().from(tables.campaigns).where(eq(tables.campaigns.id, id))
  if (!c) notFound()
  const [figures, m] = await Promise.all([campaignFigures(db(), [id]).then((f) => f.get(id)!), campaignMonitor(id)])
  const status = CAMPAIGN_STATUS[c.status]
  const used = c.budgetCents ? Math.min(100, Math.floor((figures.paidCents * 100) / c.budgetCents)) : 0
  const total = Object.values(m.byState).reduce((s, n) => s + n, 0)

  return (
    <AdminPage
      title={`${c.title}: monitor`}
      lead="Budget, posts by state, flags and the creators earning most."
      actions={
        <LinkButton href={`/admin/campaigns/${c.id}`} variant="secondary">
          Edit campaign
        </LinkButton>
      }
    >
      <section aria-labelledby="budget" className="border-0 border-b border-solid border-line pb-8">
        <div className="flex items-center gap-4">
          <h2 id="budget" className="m-0 font-app text-[16px] font-semibold">
            Budget
          </h2>
          <StatusBadge status={status?.dot ?? 'neutral'}>{status?.label ?? c.status}</StatusBadge>
        </div>
        <dl className="m-0 mt-5 grid grid-cols-3 gap-8">
          {[
            ['Budget', formatDollars(c.budgetCents)],
            ['Earned by creators', formatDollars(figures.paidCents)],
            ['Left', formatDollars(figures.leftCents)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[13px] text-muted-2">{k}</dt>
              <dd className="m-0 mt-1 font-app font-semibold text-[26px] tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 h-2 rounded-pill bg-line" role="img" aria-label={`${used}% of the budget earned`}>
          <div className="h-full rounded-pill bg-ink" style={{ width: `${used}%` }} />
        </div>
        <p className="mt-2 mb-0 text-[13px] text-muted-2">{used}% of the budget earned by creators.</p>
      </section>

      <section aria-labelledby="states" className="border-0 border-b border-solid border-line py-8">
        <h2 id="states" className="m-0 mb-4 font-app text-[16px] font-semibold">
          Posts by state
        </h2>
        {total === 0 ? (
          <EmptyState body="No posts submitted yet." />
        ) : (
          <dl className="m-0 grid grid-cols-4 gap-x-8 gap-y-4">
            {STATE_ORDER.filter((s) => m.byState[s]).map((s) => (
              <div key={s}>
                <dt className="text-[13px] text-muted-2">{STATE_STAFF_LABEL[s] ?? CREATOR_STATE[s]?.label ?? s}</dt>
                <dd className="m-0 mt-1 text-[20px] font-medium tabular-nums">{count(m.byState[s]!)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="flags" className="border-0 border-b border-solid border-line py-8">
        <h2 id="flags" className="m-0 mb-4 font-app text-[16px] font-semibold">
          Flagged posts
        </h2>
        {m.flags.length === 0 ? (
          <EmptyState body="No open flags." />
        ) : (
          <ul className="m-0 list-none p-0 text-[13px]">
            {m.flags.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-4 border-0 border-b border-solid border-line py-3"
              >
                <span>
                  <span className="font-medium">{FLAG_LABEL[f.kind] ?? f.kind}</span>
                  <span className="text-muted-2"> · {f.email}</span>
                </span>
                <a href={f.post_url} target="_blank" rel="noreferrer">
                  Open post
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="creators" className="border-0 border-b border-solid border-line py-8">
        <h2 id="creators" className="m-0 mb-4 font-app text-[16px] font-semibold">
          Top creators
        </h2>
        {m.topCreators.length === 0 ? (
          <EmptyState body="No creators earning yet." />
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">Top creators by earnings</caption>
            <thead>
              <tr className="text-left text-muted-2">
                <th scope="col" className="py-2 font-normal">
                  Creator
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Posts
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Counted views
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Earned
                </th>
              </tr>
            </thead>
            <tbody>
              {m.topCreators.map((t) => (
                <tr key={t.id} className="border-0 border-t border-solid border-line">
                  <td className="py-3">{t.name}</td>
                  <td className="py-3 text-right tabular-nums">{t.posts}</td>
                  <td className="py-3 text-right tabular-nums">{count(t.countedViews)}</td>
                  <td className="py-3 text-right tabular-nums">{formatDollars(t.earnedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="closing" className="pt-8">
        <h2 id="closing" className="m-0 mb-2 font-app text-[16px] font-semibold">
          Closing
        </h2>
        <p className="mt-0 mb-4 text-[13px] text-muted-2">
          {c.closedAt
            ? `Closed. Earnings are released after the review window${c.releaseAt ? `, on ${c.releaseAt.toISOString().slice(0, 10)}` : ''}.`
            : 'Closing stops new earnings and starts the review window before earnings are released.'}
        </p>
        <CampaignActions
          id={c.id}
          fundLabel=""
          can={{
            fund: false,
            publish: false,
            copy: false,
            close: ['live', 'closing'].includes(c.status),
            cancel: false,
          }}
        />
      </section>
    </AdminPage>
  )
}
