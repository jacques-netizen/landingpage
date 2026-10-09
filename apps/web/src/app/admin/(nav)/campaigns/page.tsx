import { CAMPAIGN_STATUS } from '@mde/campaigns/status'
import { campaignFigures } from '@mde/campaigns'
import { db } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { EmptyState } from '@mde/ui'
import type { ReactNode } from 'react'
import { campaignsForStaff } from '@/server/admin-queries'
import { campaignListCounts } from '@/server/campaign-overview'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { AdminPage, LinkButton, Notice } from '../_components/ui'
import { PlatformTag } from './[id]/parts'

const ACTIVE = ['live', 'closing']
const COMPLETED = ['closed', 'cancelled']
// Shown on the creators' campaigns screen: public, and live or ended (ended ones under Past campaigns).
const DISCOVERABLE = ['live', 'closing', 'closed']

type Filters = { q?: string; show?: string; access?: string; discovery?: string; deleted?: string }

const day = (d: Date | null) =>
  d
    ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null
const n = (v: number) => v.toLocaleString('en-US')

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'neutral'; children: ReactNode }) {
  const c = { ok: '#4FB286', warn: '#E0A94A', bad: '#E5675C', neutral: '#9A958C' }[tone]
  return (
    <span
      className="inline-flex items-center rounded-pill border border-solid px-[10px] py-[2px] text-[11px] font-semibold whitespace-nowrap"
      style={{ color: c, borderColor: c, background: `${c}1F` }}
    >
      {children}
    </span>
  )
}

/** Approved, pending and denied counts in green, amber and red. */
function Split({ approved, pending, denied, of }: { approved: number; pending: number; denied: number; of: string }) {
  const chip = (v: number, c: string, label: string) => (
    <span
      title={`${n(v)} ${label}`}
      className="rounded-[6px] px-[7px] py-[1px] text-[11px] font-semibold tabular-nums"
      style={{ color: c, background: `${c}26` }}
    >
      {n(v)}
    </span>
  )
  return (
    <span className="mt-1 flex gap-1" aria-label={`${of}: ${approved} approved, ${pending} pending, ${denied} denied`}>
      {chip(approved, '#4FB286', 'approved')}
      {chip(pending, '#E0A94A', 'pending')}
      {chip(denied, '#E5675C', 'denied')}
    </span>
  )
}

// The staff campaigns overview (testing report, 2026-10-08): one row per campaign with its picture,
// dates, platforms, state, posts and pages split by outcome, and its budget. Search by title and filter
// by All / Active / Completed, access and discovery.
export default async function CampaignsAdminPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const { q, show = 'all', access = 'all', discovery = 'all', deleted } = await searchParams
  const viewer = await requireStaff('staff', '/admin/campaigns')
  const d = db()
  const all = await campaignsForStaff(d)
  const term = q?.trim().toLowerCase() ?? ''
  const campaigns = all.filter(
    (c) =>
      (!term || c.title.toLowerCase().includes(term)) &&
      (show === 'active' ? ACTIVE.includes(c.status) : show === 'completed' ? COMPLETED.includes(c.status) : true) &&
      (access === 'all' || c.visibility === access) &&
      (discovery === 'all' ||
        (discovery === 'visible') === (c.visibility === 'public' && DISCOVERABLE.includes(c.status))),
  )
  const [figures, counts] = await Promise.all([
    campaignFigures(
      d,
      campaigns.map((c) => c.id),
    ),
    campaignListCounts(),
  ])
  const zero = { total: 0, approved: 0, pending: 0, denied: 0 }
  const href = (patch: Partial<Filters>) => {
    const p = new URLSearchParams()
    const next = { q, show, access, discovery, ...patch }
    for (const [k, v] of Object.entries(next)) if (v && v !== 'all') p.set(k, v)
    const s = p.toString()
    return s ? `/admin/campaigns?${s}` : '/admin/campaigns'
  }
  const select = 'h-9 rounded-[10px] border border-solid border-line bg-field px-3 text-[13px] text-ink'

  return (
    <AdminPage
      title="Campaigns"
      lead="Every campaign at a glance. Open one to see and manage every post."
      actions={hasAccess(viewer, 'money') ? <LinkButton href="/admin/campaigns/new">New campaign</LinkButton> : null}
    >
      {deleted ? (
        <Notice kind="ok">
          {deleted === 'removed'
            ? 'Campaign deleted.'
            : 'Campaign deleted. It was closed first and its records are kept for the books.'}
        </Notice>
      ) : null}

      <form action="/admin/campaigns" className="mb-3 flex gap-2">
        {show !== 'all' ? <input type="hidden" name="show" value={show} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ''}
          aria-label="Search campaigns by title"
          placeholder="Search campaigns by title"
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-solid border-line bg-field px-3 text-[13px] text-ink"
        />
        <select name="access" defaultValue={access} aria-label="Access" className={select}>
          <option value="all">Access: All</option>
          <option value="public">Access: Public</option>
          <option value="private">Access: Private</option>
        </select>
        <select name="discovery" defaultValue={discovery} aria-label="Discovery" className={select}>
          <option value="all">Discovery: All</option>
          <option value="visible">Discovery: Visible</option>
          <option value="hidden">Discovery: Hidden</option>
        </select>
        <button
          type="submit"
          className="h-10 cursor-pointer rounded-[10px] border border-solid border-line bg-field-2 px-4 text-[13px] text-ink"
        >
          Search
        </button>
      </form>
      <nav aria-label="Campaigns by state" className="mb-4 flex gap-2">
        {(
          [
            ['all', 'All'],
            ['active', 'Active'],
            ['completed', 'Completed'],
          ] as const
        ).map(([k, label]) => (
          <a
            key={k}
            href={href({ show: k })}
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
          body={all.length === 0 ? 'No campaigns yet. Start one from a template.' : 'No campaigns match these filters.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-solid border-line">
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">Campaigns</caption>
            <thead className="bg-field">
              <tr className="text-left text-[12px] text-muted">
                {['Campaign', 'Status', 'Access', 'Discovery', 'Operational', 'Submissions', 'Pages', 'Budget'].map(
                  (h) => (
                    <th key={h} scope="col" className="px-3 py-3 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const f = figures.get(c.id)!
                const k = counts.get(c.id) ?? { posts: zero, pages: zero }
                const used = Math.min(100, c.budgetCents > 0 ? Math.round((f.paidCents / c.budgetCents) * 100) : 0)
                const state = ACTIVE.includes(c.status)
                  ? (['Active', 'ok'] as const)
                  : COMPLETED.includes(c.status)
                    ? (['Completed', 'neutral'] as const)
                    : (['Draft', 'warn'] as const)
                const visible = c.visibility === 'public' && DISCOVERABLE.includes(c.status)
                const op = CAMPAIGN_STATUS[c.status]
                return (
                  <tr key={c.id} className="border-0 border-t border-solid border-line align-middle">
                    <td className="min-w-[280px] px-3 py-3">
                      <a href={`/admin/campaigns/${c.id}`} className="flex gap-3 text-ink no-underline">
                        {c.coverImageUrl ? (
                          <img
                            src={c.coverImageUrl}
                            alt=""
                            className="h-[96px] w-[72px] flex-none rounded-[10px] object-cover"
                          />
                        ) : (
                          <span className="flex h-[96px] w-[72px] flex-none items-center justify-center rounded-[10px] bg-field text-[11px] text-muted">
                            No picture
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-[14px] font-semibold hover:text-gold-soft">{c.title}</span>
                          <span className="mt-1 block text-[11px] text-muted">Created {day(c.createdAt)}</span>
                          <span className="block text-[11px] text-muted">
                            {c.startAt ? `Starts ${day(c.startAt)}` : 'Starts when published'}
                          </span>
                          <span className="mt-2 flex gap-1">
                            {c.platforms.map((p) => (
                              <PlatformTag key={p} platform={p} small />
                            ))}
                          </span>
                        </span>
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <Pill tone={state[1]}>{state[0]}</Pill>
                    </td>
                    <td className="px-3 py-3">
                      <Pill tone={c.visibility === 'public' ? 'ok' : 'neutral'}>
                        {c.visibility === 'public' ? 'Public' : 'Private'}
                      </Pill>
                    </td>
                    <td className="px-3 py-3">
                      <Pill tone={visible ? 'ok' : 'neutral'}>{visible ? 'Visible' : 'Hidden'}</Pill>
                    </td>
                    <td className="px-3 py-3">
                      <Pill tone={op?.dot ?? 'neutral'}>{(op?.label ?? c.status).toUpperCase()}</Pill>
                    </td>
                    <td className="px-3 py-3">
                      <a href={`/admin/campaigns/${c.id}?tab=submissions`} className="text-ink no-underline">
                        <span className="text-[16px] font-bold tabular-nums">{n(k.posts.total)}</span>{' '}
                        <span className="text-[11px] text-muted">posts</span>
                      </a>
                      <Split {...k.posts} of="Posts" />
                    </td>
                    <td className="px-3 py-3">
                      <a href={`/admin/campaigns/${c.id}?tab=pages`} className="text-ink no-underline">
                        <span className="text-[16px] font-bold tabular-nums">{n(k.pages.total)}</span>{' '}
                        <span className="text-[11px] text-muted">pages</span>
                      </a>
                      <Split {...k.pages} of="Pages" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-[200px] rounded-[10px] border border-solid border-line bg-field px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[15px] font-bold text-[#4FB286] tabular-nums">
                            {formatDollars(c.budgetCents)}
                          </span>
                          <span className="text-[11px] text-muted tabular-nums">
                            {formatDollars(c.rateCentsPer1000)}/1k
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="h-[5px] flex-1 rounded-[3px] bg-field-2" aria-hidden>
                            <span className="block h-full rounded-[3px] bg-[#4FB286]" style={{ width: `${used}%` }} />
                          </span>
                          <span className="text-[10px] text-muted tabular-nums">{used}%</span>
                        </div>
                        <div className="mt-1 flex justify-between gap-2 text-[11px] tabular-nums">
                          <span className="text-muted">
                            Used: <span className="text-ink">{formatDollars(f.paidCents)}</span>
                          </span>
                          <span className="text-[#4FB286]">{formatDollars(f.leftCents)} left</span>
                        </div>
                      </div>
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
