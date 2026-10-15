import { formatDollars } from '@mde/money/dollars'
import { EmptyState } from '@mde/ui'
import { db } from '@mde/db'
import { unreadCount } from '@mde/notifications'
import { PLATFORM_LABELS } from '@mde/campaigns/templates'
import { homeCampaigns, type HomeStatus } from '@/server/admin-home'
import { staffDashboard } from '@/server/dashboard'
import { requireStaff } from '@/server/guard'
import { platformsWithoutProvider } from '@/server/providers'
import { workerStatus } from '@/server/worker-status'
import { AdminPage, Notice } from './_components/ui'

export const dynamic = 'force-dynamic'

const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
const n = (v: number) => v.toLocaleString('en-US')
const TONE: Record<HomeStatus, string> = { live: '#4FB286', ended: '#9A958C', draft: '#E0A94A' }
const FILTERS: [string, string][] = [
  ['live', 'Live'],
  ['ended', 'Ended'],
  ['draft', 'Drafts'],
  ['all', 'All'],
]

/** How long ago, e.g. "13m ago", "4h ago". */
function ago(d: Date | null, now: number) {
  if (!d) return 'Never'
  const m = Math.max(0, Math.round((now - d.getTime()) / 60_000))
  return m < 60 ? `${m}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}

// The staff home (owner brief, 2026-10-15): the campaigns, the ones needing attention first, with what
// is waiting on each. Every review action lives inside a campaign; a row opens its workspace.
export default async function AdminHome({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const viewer = await requireStaff()
  const { show: showParam } = await searchParams
  const show = FILTERS.some(([k]) => k === showParam) ? showParam! : 'live'
  const now = new Date()
  const [rows, d, unread, worker] = await Promise.all([
    homeCampaigns(now),
    staffDashboard(now),
    unreadCount(db(), viewer.id),
    workerStatus(),
  ])
  const missingProviders = platformsWithoutProvider()
  const campaigns = rows.filter((c) => show === 'all' || c.status === show)
  const hidden = rows.length - campaigns.length
  const waitingElsewhere = rows.filter((c) => c.status !== show && show !== 'all' && c.waiting + c.verifications > 0)
  return (
    <AdminPage
      title="Campaigns"
      lead="What needs attention, campaign by campaign. Open one to review its clips and verifications."
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
      {missingProviders.length ? (
        <Notice kind="bad">
          No data provider is set up for {missingProviders.map((p) => PLATFORM_LABELS[p] ?? p).join(', ')}. Posts there
          are kept for review without their stats and no views are counted until one is. Set DATA_PROVIDER_API_KEY
          {missingProviders.includes('youtube') ? ' and YOUTUBE_API_KEY' : ''} on the server.
        </Notice>
      ) : null}
      {d.appeals.length ? (
        <Notice kind="ok">
          {d.appeals.length} {d.appeals.length === 1 ? 'appeal is' : 'appeals are'} due within 24 hours
          {d.appeals.some((a) => a.dueAt <= now) ? ', some already late' : ''}.{' '}
          <a href="/admin/appeals" className="text-ink">
            Open appeals
          </a>
          .
        </Notice>
      ) : null}
      {waitingElsewhere.length ? (
        <Notice kind="ok">
          {waitingElsewhere.map((c) => c.title).join(', ')} {waitingElsewhere.length === 1 ? 'has' : 'have'} posts or
          verifications waiting but {waitingElsewhere.length === 1 ? 'is' : 'are'} not live.{' '}
          <a href="/admin?show=all" className="text-ink">
            Show all campaigns
          </a>
          .
        </Notice>
      ) : null}

      <nav aria-label="Campaigns by state" className="mb-4 flex gap-2">
        {FILTERS.map(([k, label]) => (
          <a
            key={k}
            href={k === 'live' ? '/admin' : `/admin?show=${k}`}
            aria-current={show === k ? 'true' : undefined}
            className={`rounded-pill border border-solid px-4 py-[6px] text-[13px] no-underline ${
              show === k ? 'border-gold-soft bg-[rgba(216,197,143,0.12)] text-gold-soft' : 'border-line text-muted-2'
            }`}
          >
            {label}
          </a>
        ))}
      </nav>

      {campaigns.length === 0 ? (
        <EmptyState
          body={
            rows.length === 0
              ? 'No campaigns yet. Start one from Campaigns.'
              : `No ${show === 'all' ? '' : `${show} `}campaigns.${hidden ? ` ${hidden} under other filters.` : ''}`
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-solid border-line">
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">Campaigns, the ones needing attention first</caption>
            <thead className="bg-field">
              <tr className="text-left text-[12px] text-muted">
                {[
                  'Campaign',
                  'Status',
                  'Submissions waiting',
                  'Verifications waiting',
                  'Budget',
                  'Views',
                  'Last scrape',
                ].map((h) => (
                  <th key={h} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const used = c.budgetCents > 0 ? Math.min(100, Math.round((c.spentCents / c.budgetCents) * 100)) : 0
                const attention = c.waiting + c.verifications > 0
                const open = `/admin/campaigns/${c.id}`
                return (
                  <tr
                    key={c.id}
                    className={`border-0 border-t border-solid border-line align-middle ${attention ? 'bg-[rgba(216,197,143,0.04)]' : ''}`}
                  >
                    <td className="min-w-[240px] px-3 py-3">
                      <a href={open} className="text-[14px] font-semibold text-ink no-underline hover:text-gold-soft">
                        {c.title}
                      </a>
                      <div className="mt-[2px] text-[11px] text-muted">
                        {c.clientName ?? 'No client'}
                        {c.demo ? ' · demo' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-flex items-center rounded-pill border border-solid px-[10px] py-[2px] text-[11px] font-semibold whitespace-nowrap"
                        style={{
                          color: TONE[c.status],
                          borderColor: TONE[c.status],
                          background: `${TONE[c.status]}1F`,
                        }}
                      >
                        {c.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <a
                        href={`${open}?tab=review`}
                        className={`text-[15px] font-bold tabular-nums no-underline ${c.waiting ? 'text-pending' : 'text-muted'}`}
                      >
                        {n(c.waiting)}
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <a
                        href={`${open}?tab=verifications`}
                        className={`text-[15px] font-bold tabular-nums no-underline ${c.verifications ? 'text-pending' : 'text-muted'}`}
                      >
                        {n(c.verifications)}
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-[180px]">
                        <div className="flex justify-between gap-2 text-[11px] tabular-nums">
                          <span className="text-ink">{formatDollars(c.spentCents)}</span>
                          <span className="text-muted">of {formatDollars(c.budgetCents)}</span>
                        </div>
                        <span className="mt-1 block h-[4px] rounded-[2px] bg-field-2" aria-hidden>
                          <span className="block h-full rounded-[2px] bg-[#4FB286]" style={{ width: `${used}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[14px] font-semibold tabular-nums">{n(c.views)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={c.stale ? 'font-semibold text-bad' : 'text-muted-2'}
                        title={c.lastScrapeAt ? when(c.lastScrapeAt) : undefined}
                      >
                        {c.status === 'live' || c.lastScrapeAt ? ago(c.lastScrapeAt, now.getTime()) : 'Not tracked'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  )
}
