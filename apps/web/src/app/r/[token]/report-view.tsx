'use client'

import type { CampaignReport, ReportClip, ReportMode, ReportStatus } from '@mde/campaigns'
import { formatDollars } from '@mde/money/dollars'
import { BarChart, LineChart } from '@mde/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PLATFORM_NAMES, PlatformIcon } from './platform-icon'

// The client's report page (client report brief, 2026-10-12). Every number is from the JSON endpoint,
// fetched again every 2 minutes while the tab is visible and whenever it comes back into focus.
const REFRESH_MS = 2 * 60_000

type Filters = {
  from: string
  to: string
  mode: ReportMode
  page: number
  platform: string
  status: '' | ReportStatus
}

/** 544K, 1.2M; whole numbers below 1,000. */
export function compact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1).replace(/\.0$/, '')}K`
  return n.toLocaleString('en-US')
}
const full = (n: number) => n.toLocaleString('en-US')
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  )
const whenFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

const card = 'rounded-card border border-solid border-line bg-white p-6 max-sm:p-4'
const h2 = 'm-0 mb-4 font-serif text-[26px] leading-tight font-normal'
const chip = (on: boolean) =>
  `cursor-pointer rounded-pill border border-solid px-3 py-[5px] text-[12px] font-medium ${
    on ? 'border-ink bg-ink text-cream' : 'border-line bg-white text-muted hover:text-ink'
  }`

function queryString(f: Filters) {
  const p = new URLSearchParams()
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.mode === 'paid') p.set('mode', 'paid')
  if (f.page > 1) p.set('page', String(f.page))
  if (f.platform) p.set('platform', f.platform)
  if (f.status) p.set('status', f.status)
  return p.toString()
}

export function ReportView({
  token,
  initial,
  initialFilters,
}: {
  token: string
  initial: CampaignReport
  initialFilters: Filters
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [report, setReport] = useState<CampaignReport>(initial)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const latest = useRef(queryString(initialFilters))

  const load = useCallback(
    async (f: Filters) => {
      const qs = queryString(f)
      latest.current = qs
      setState('loading')
      try {
        const res = await fetch(`/api/r/${token}/report${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as CampaignReport
        // A slower answer to an older query never overwrites a newer one.
        if (latest.current === qs) {
          setReport(data)
          setState('idle')
        }
      } catch {
        if (latest.current === qs) setState('error')
      }
    },
    [token],
  )

  // Filters change: fetch at once. Then every 2 minutes while visible, and on focus.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    void load(filters)
  }, [filters, load])
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const start = () => {
      stop()
      timer = setInterval(() => void load(filters), REFRESH_MS)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void load(filters)
        start()
      } else stop()
    }
    const onFocus = () => void load(filters)
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [filters, load])

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, page: 1, ...patch }))
  const r = report
  const b = r.budget
  const used = b.budgetCents > 0 ? Math.min(100, Math.round((b.spentCents / b.budgetCents) * 100)) : 0
  const spendTotal = r.spendByDay.reduce((s, d) => s + d.spendCents, 0)
  const spendTop = r.spendByDay.reduce<(typeof r.spendByDay)[number] | null>(
    (m, d) => (m === null || d.spendCents > m.spendCents ? d : m),
    null,
  )
  const viewsTotal = r.platforms.reduce((s, p) => s + p.views, 0)
  const clipsTotal = r.platforms.reduce((s, p) => s + p.clips, 0)
  const pages = Math.max(1, Math.ceil(r.submissions.total / r.submissions.pageSize))
  const platformsSeen = [
    ...new Set([...r.platforms.map((p) => p.platform), ...r.submissions.rows.map((c) => c.platform)]),
  ]

  return (
    <div className="mx-auto box-border max-w-[1100px] px-6 pt-10 pb-20 max-sm:px-4">
      {/* 1. Header */}
      <header className="flex items-start gap-6 max-sm:flex-col">
        {r.campaign.thumbnail ? (
          <img
            src={r.campaign.thumbnail}
            alt=""
            className="h-[120px] w-[96px] flex-none rounded-[14px] border border-solid border-line object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Campaign report</p>
          <h1 className="mt-2 mb-0 font-serif text-[44px] leading-none font-normal tracking-[-0.02em] max-sm:text-[32px]">
            {r.campaign.title}
          </h1>
          <p className="mt-3 mb-0 flex flex-wrap items-center gap-x-3 text-[14px] text-muted">
            {r.campaign.startAt ? <span>Started {dateFmt.format(new Date(r.campaign.startAt))}</span> : null}
            <span className="inline-flex items-center gap-2 text-ink">
              <span
                aria-hidden
                className="inline-block size-[7px] rounded-full"
                style={{ background: r.campaign.status === 'Live' ? '#2F7D4F' : '#8A8378' }}
              />
              {r.campaign.status}
            </span>
          </p>
        </div>
      </header>

      {/* Range and mode */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            From
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => set({ from: e.target.value })}
              className="h-10 rounded-input border border-solid border-line bg-white px-3 font-sans text-[14px] text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-muted">
            To
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set({ to: e.target.value })}
              className="h-10 rounded-input border border-solid border-line bg-white px-3 font-sans text-[14px] text-ink"
            />
          </label>
          <button
            type="button"
            onClick={() => set({ from: '', to: '' })}
            className={chip(!filters.from && !filters.to)}
          >
            Entire campaign
          </button>
        </div>
        <div
          role="group"
          aria-label="Which posts count"
          className="flex gap-[2px] rounded-pill border border-solid border-line bg-white p-[2px]"
        >
          {(
            [
              ['all', 'Paid + pending'],
              ['paid', 'Paid'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filters.mode === k}
              onClick={() => set({ mode: k })}
              className={`cursor-pointer rounded-pill border-0 px-4 py-[6px] font-sans text-[13px] font-medium ${
                filters.mode === k ? 'bg-ink text-cream' : 'bg-transparent text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 mb-0 text-[12px] text-muted-2" aria-live="polite">
        {state === 'error'
          ? 'The latest numbers could not be loaded. Showing the last ones received.'
          : `Showing ${dayLabel(r.range.from)} to ${dayLabel(r.range.to)}${state === 'loading' ? ', updating' : ''}.`}
      </p>

      {/* 2. Totals */}
      <section aria-label="Totals" className="mt-6 grid grid-cols-4 gap-4 max-md:grid-cols-2">
        {(
          [
            ['Views', r.totals.views],
            ['Likes', r.totals.likes],
            ['Comments', r.totals.comments],
            ['Shares', r.totals.shares],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={card}>
            <div className="text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">{label}</div>
            <div className="mt-2 font-serif text-[40px] leading-none tabular-nums" title={full(value)}>
              {compact(value)}
            </div>
          </div>
        ))}
      </section>

      {/* 3. Views over time */}
      <section className={`${card} mt-4`} aria-label="Views over time">
        <h2 className={h2}>Views over time</h2>
        <LineChart
          title="Cumulative views by day"
          summary={`Views grew from ${full(r.viewsByDay[0]?.views ?? 0)} to ${full(r.viewsByDay.at(-1)?.views ?? 0)} over ${r.viewsByDay.length} days.`}
          points={r.viewsByDay.map((d) => ({ label: dayLabel(d.day), value: d.views }))}
          format={full}
        />
        <div className="mt-6">
          <BarChart
            title="Clips submitted per day"
            summary={`${full(r.viewsByDay.reduce((s, d) => s + d.clips, 0))} clips submitted over ${r.viewsByDay.length} days.`}
            points={r.viewsByDay.map((d) => ({ label: dayLabel(d.day), value: d.clips }))}
            columns={['Date', 'Clips']}
          />
        </div>
      </section>

      {/* 4. Budget */}
      <section className={`${card} mt-4`} aria-label="Budget">
        <h2 className={h2}>Budget</h2>
        <div className="flex items-baseline justify-between gap-4 text-[14px]">
          <span className="font-medium tabular-nums">
            {formatDollars(b.spentCents)} / {formatDollars(b.budgetCents)}
          </span>
          <span className="text-muted tabular-nums">{used}% used</span>
        </div>
        <div className="mt-2 h-2 rounded-[4px] bg-field" role="img" aria-label={`${used}% of the budget used`}>
          <div className="h-full rounded-[4px] bg-ink" style={{ width: `${used}%` }} />
        </div>
        <dl className="mt-6 grid grid-cols-4 gap-4 max-md:grid-cols-2">
          {(
            [
              ['eCPM', b.ecpmCents === null ? 'No views yet' : formatDollars(b.ecpmCents)],
              ['Paid out', formatDollars(b.paidOutCents)],
              ['In payout hold', formatDollars(b.holdCents)],
              ['Remaining', formatDollars(b.remainingCents)],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="m-0 mt-1 text-[20px] font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 5. Platform stats */}
      <section className="mt-4 grid grid-cols-2 gap-4 max-md:grid-cols-1" aria-label="By platform">
        {(
          [
            ['Views by platform', 'views', viewsTotal],
            ['Posts by platform', 'clips', clipsTotal],
          ] as const
        ).map(([title, key, total]) => (
          <div key={key} className={card}>
            <h2 className={h2}>{title}</h2>
            <ul className="m-0 list-none p-0 text-[14px]">
              {r.platforms.map((p) => (
                <li
                  key={p.platform}
                  className="flex items-center gap-3 border-0 border-b border-solid border-line py-[10px]"
                >
                  <PlatformIcon platform={p.platform} />
                  <span className="flex-1">{PLATFORM_NAMES[p.platform] ?? p.platform}</span>
                  <span className="w-12 text-right text-muted tabular-nums">
                    {total > 0 ? Math.round((p[key] / total) * 100) : 0}%
                  </span>
                  <span className="w-20 text-right font-medium tabular-nums">{full(p[key])}</span>
                </li>
              ))}
              <li className="flex items-center gap-3 py-[10px] font-medium">
                <span className="flex-1">Total</span>
                <span className="w-20 text-right tabular-nums">{full(total)}</span>
              </li>
            </ul>
          </div>
        ))}
      </section>

      {/* 6. CPM by platform */}
      <section className={`${card} mt-4`} aria-label="CPM by platform">
        <h2 className={h2}>CPM by platform</h2>
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th className="border-0 border-b border-solid border-line py-2 font-medium">Platform</th>
              <th className="border-0 border-b border-solid border-line py-2 text-right font-medium">CPM</th>
              <th className="border-0 border-b border-solid border-line py-2 text-right font-medium">eCPM</th>
            </tr>
          </thead>
          <tbody>
            {r.platforms.map((p) => (
              <tr key={p.platform}>
                <td className="border-0 border-b border-solid border-line py-[10px]">
                  <span className="inline-flex items-center gap-2">
                    <PlatformIcon platform={p.platform} />
                    {PLATFORM_NAMES[p.platform] ?? p.platform}
                  </span>
                </td>
                <td className="border-0 border-b border-solid border-line py-[10px] text-right tabular-nums">
                  {formatDollars(r.campaign.rateCentsPer1000)}
                </td>
                <td className="border-0 border-b border-solid border-line py-[10px] text-right tabular-nums">
                  {p.ecpmCents === null ? 'No views yet' : formatDollars(p.ecpmCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 mb-0 text-[12px] text-muted-2">
          CPM is the campaign rate per 1,000 views. eCPM is what was spent on a platform divided by its views, times
          1,000.
        </p>
      </section>

      {/* 7. Spend */}
      <section className={`${card} mt-4`} aria-label="Spend">
        <h2 className={h2}>Spend</h2>
        <BarChart
          title="Daily spend (UTC)"
          summary={`Total spend ${formatDollars(spendTotal)} over ${r.spendByDay.length} days.`}
          points={r.spendByDay.map((d) => ({ label: dayLabel(d.day), value: d.spendCents, extra: full(d.clips) }))}
          format={formatDollars}
          columns={['Date', 'Spend', 'Clips']}
        />
        <p className="mt-3 mb-0 text-[13px] text-muted">
          Total spend {formatDollars(spendTotal)} over {r.spendByDay.length}{' '}
          {r.spendByDay.length === 1 ? 'day' : 'days'}.
          {spendTop ? ` Highest day: ${dayLabel(spendTop.day)} ${formatDollars(spendTop.spendCents)}` : ''}
        </p>
      </section>

      {/* 8. Clips */}
      <section className={`${card} mt-4`} aria-label="Top clips">
        <h2 className={h2}>Top clips</h2>
        {r.topClips.length === 0 ? (
          <p className="m-0 text-[14px] text-muted">No approved clips in this range yet.</p>
        ) : (
          <ol className="m-0 list-none p-0">
            {r.topClips.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center gap-4 border-0 border-b border-solid border-line py-3 text-[14px] max-sm:flex-wrap"
              >
                <span className="w-5 text-muted tabular-nums">{i + 1}</span>
                <PlatformIcon platform={c.platform} />
                <span className="min-w-[120px] flex-1 font-medium">{c.handle}</span>
                <span className="text-muted tabular-nums" title="Views">
                  {compact(c.views)} views
                </span>
                <span className="text-muted tabular-nums" title="Likes, comments and shares">
                  {compact(c.likes)} / {compact(c.comments)} / {compact(c.shares)}
                </span>
                <span className="text-muted">{c.postedAt ? dateFmt.format(new Date(c.postedAt)) : ''}</span>
                <a href={c.url} target="_blank" rel="noreferrer" className="font-medium text-ink">
                  Open
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={`${card} mt-4`} aria-label="All submissions">
        <h2 className={h2}>All submissions</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => set({ platform: '' })} className={chip(filters.platform === '')}>
            All platforms
          </button>
          {platformsSeen.map((p) => (
            <button key={p} type="button" onClick={() => set({ platform: p })} className={chip(filters.platform === p)}>
              {PLATFORM_NAMES[p] ?? p}
            </button>
          ))}
          <span className="w-2" aria-hidden />
          {(
            [
              ['', 'All statuses'],
              ['approved', 'Approved'],
              ['pending', 'Pending'],
              ['rejected', 'Rejected'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => set({ status: k })} className={chip(filters.status === k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">All submissions</caption>
            <thead>
              <tr className="text-left text-[12px] text-muted">
                {[
                  'Date',
                  'Platform',
                  'Clipper',
                  'Link',
                  'Status',
                  'Views',
                  'Likes',
                  'Comments',
                  'Shares',
                  'Payout',
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`border-0 border-b border-solid border-line py-2 pr-3 font-medium whitespace-nowrap ${i >= 5 ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.submissions.rows.map((c) => (
                <Row key={c.id} c={c} />
              ))}
              {r.submissions.rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-muted">
                    No submissions match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
          <span>
            {full(r.submissions.total)} {r.submissions.total === 1 ? 'submission' : 'submissions'}
          </span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              className={chip(false)}
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {r.submissions.page} of {pages}
            </span>
            <button
              type="button"
              disabled={filters.page >= pages}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              className={chip(false)}
            >
              Next
            </button>
          </span>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="mt-12 flex flex-col items-center gap-4 text-[12px] text-muted">
        <span>Last updated {r.lastUpdated ? whenFmt.format(new Date(r.lastUpdated)) : 'never'}</span>
        <img src="/designed/logo-nav-clear.png" alt="Maison d'Élites" className="h-[22px] w-auto" />
      </footer>
    </div>
  )
}

const STATUS_LABEL: Record<ReportStatus, string> = { approved: 'Approved', pending: 'Pending', rejected: 'Rejected' }

function Row({ c }: { c: ReportClip }) {
  const cell = 'border-0 border-b border-solid border-line py-[10px] pr-3 whitespace-nowrap'
  return (
    <tr>
      <td className={`${cell} text-muted`}>{dateFmt.format(new Date(c.submittedAt))}</td>
      <td className={cell}>
        <span className="inline-flex items-center gap-2">
          <PlatformIcon platform={c.platform} size={14} />
          {PLATFORM_NAMES[c.platform] ?? c.platform}
        </span>
      </td>
      <td className={`${cell} font-medium`}>{c.handle}</td>
      <td className={cell}>
        <a href={c.url} target="_blank" rel="noreferrer" className="text-ink">
          Open
        </a>
      </td>
      <td className={cell}>{STATUS_LABEL[c.status]}</td>
      <td className={`${cell} text-right tabular-nums`}>{full(c.views)}</td>
      <td className={`${cell} text-right tabular-nums`}>{full(c.likes)}</td>
      <td className={`${cell} text-right tabular-nums`}>{full(c.comments)}</td>
      <td className={`${cell} text-right tabular-nums`}>{full(c.shares)}</td>
      <td className={`${cell} text-right tabular-nums`}>
        {c.payout === 'none' ? '' : `${formatDollars(c.payoutCents)} ${c.payout === 'paid' ? 'paid' : 'pending'}`}
      </td>
    </tr>
  )
}
