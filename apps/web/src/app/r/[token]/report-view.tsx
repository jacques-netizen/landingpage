'use client'

import type { CampaignReport, ReportClip, ReportMode, ReportSort, ReportStatus } from '@mde/campaigns'
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
  sort: ReportSort
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
  if (f.sort !== 'views') p.set('sort', f.sort)
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
  // Pages fetched so far for the submissions grid; "Show all" appends the next one.
  const [extra, setExtra] = useState<ReportClip[]>([])
  const shownClips = [...report.submissions.rows, ...extra]
  const showMore = () => setFilters((f) => ({ ...f, page: f.page + 1 }))
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
          if (f.page > 1) {
            // A further page of the same list: keep the earlier cards and add these.
            setExtra((x) => [...x, ...data.submissions.rows])
            setReport((old) => ({ ...data, submissions: { ...data.submissions, rows: old.submissions.rows } }))
          } else {
            setExtra([])
            setReport(data)
          }
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
      timer = setInterval(() => void load({ ...filters, page: 1 }), REFRESH_MS)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void load({ ...filters, page: 1 })
        start()
      } else stop()
    }
    const onFocus = () => void load({ ...filters, page: 1 })
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
        <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px]">
          <span className="font-medium tabular-nums">
            {formatDollars(b.spentCents)} / {formatDollars(b.budgetCents)}
          </span>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <span className="text-muted tabular-nums">{used}% used</span>
        </p>
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

      {/* 8. Submissions: a card per clip with the clip itself, its figures and the clipper. */}
      <section className={`${card} mt-4`} aria-label="Submissions">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className={`${h2} mb-1`}>Submissions</h2>
            <p className="m-0 text-[14px] text-muted">
              <span className="font-medium text-ink">{full(r.counts.submitted)}</span> submitted ·{' '}
              <span className="font-medium text-ink">{full(r.counts.approved)}</span> approved ·{' '}
              <span className="font-medium text-ink">{full(r.counts.pending)}</span> pending review
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              Sort
              <select
                value={filters.sort}
                onChange={(e) => set({ sort: e.target.value as Filters['sort'] })}
                className="h-9 rounded-pill border border-solid border-line bg-white px-3 font-sans text-[13px] font-medium text-ink"
              >
                <option value="views">Most views</option>
                <option value="newest">Newest</option>
                <option value="spend">Most spend</option>
              </select>
            </label>
            <a
              href={`/api/r/${token}/report.csv${queryString({ ...filters, page: 1 }) ? `?${queryString({ ...filters, page: 1 })}` : ''}`}
              className="text-[13px] font-medium text-ink"
            >
              Export CSV
            </a>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
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
        {shownClips.length === 0 ? (
          <p className="mt-6 mb-0 text-[14px] text-muted">No submissions match.</p>
        ) : (
          <ul className="mt-5 grid list-none grid-cols-3 gap-4 p-0 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {shownClips.map((c) => (
              <ClipCard key={c.id} c={c} minViews={r.campaign.minViewsToEarn} />
            ))}
          </ul>
        )}
        <div className="mt-5 flex items-center justify-between text-[13px] text-muted">
          <span>
            Showing {full(shownClips.length)} of {full(r.submissions.total)}
          </span>
          {shownClips.length < r.submissions.total ? (
            <button type="button" disabled={state === 'loading'} onClick={() => showMore()} className={chip(false)}>
              Show all
            </button>
          ) : null}
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

/** One clip: the video (or its picture, or the platform's own player for YouTube), its figures, the clipper. */
/** The platform's own player for the post, which is how the clip is shown wherever it is embedded. */
function embedUrl(c: ReportClip) {
  switch (c.platform) {
    case 'tiktok':
      return `https://www.tiktok.com/embed/v2/${c.platformPostId}`
    case 'instagram':
      return `https://www.instagram.com/p/${c.platformPostId}/embed/`
    case 'youtube':
      return `https://www.youtube.com/embed/${c.platformPostId}?playsinline=1`
    case 'x':
      return `https://platform.twitter.com/embed/Tweet.html?id=${c.platformPostId}&theme=light&dnt=true`
    default:
      return c.url
  }
}

/** The payout, or the short reason there is none yet. */
function spendLabel(c: ReportClip, minViews: number) {
  if (c.payoutCents > 0) return formatDollars(c.payoutCents)
  if (c.status === 'rejected') return 'Not paid'
  if (c.status === 'pending') return 'In review'
  if (minViews > 0 && c.countedViews < minViews) return `Below ${compact(minViews)} min`
  if (c.countedViews === 0) return 'No views since submitted'
  return formatDollars(0)
}

function ClipCard({ c, minViews }: { c: ReportClip; minViews: number }) {
  return (
    <li className="flex overflow-hidden rounded-card border border-solid border-line bg-white">
      <div className="relative aspect-[9/16] w-[46%] flex-none bg-ink">
        <iframe
          title={`${c.handle} on ${PLATFORM_NAMES[c.platform] ?? c.platform}`}
          src={embedUrl(c)}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
          style={c.thumbnail ? { background: `#1A1510 url(${JSON.stringify(c.thumbnail)}) center / cover` } : undefined}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col text-[13px]">
        <dl className="m-0 flex-1">
          {(
            [
              ['Views', full(c.views)],
              ['Comments', full(c.comments)],
              ['Likes', full(c.likes)],
              ['Spend', spendLabel(c, minViews)],
            ] as const
          ).map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between gap-2 border-0 border-b border-solid border-line px-4 py-3"
            >
              <dt className="text-muted">{k}</dt>
              <dd className="m-0 font-mono tabular-nums">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <dt className="text-muted">Status</dt>
            <dd className="m-0">{STATUS_LABEL[c.status]}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-2 border-0 border-t border-solid border-line px-4 py-3 text-[12px]">
          <span className="min-w-0 flex-1 truncate font-medium" title={c.handle}>
            {c.handle}
          </span>
          <PlatformIcon platform={c.platform} size={14} />
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className="text-ink"
            aria-label={`Open on ${PLATFORM_NAMES[c.platform] ?? c.platform}`}
          >
            {PLATFORM_NAMES[c.platform] ?? c.platform} ↗
          </a>
        </div>
      </div>
    </li>
  )
}
