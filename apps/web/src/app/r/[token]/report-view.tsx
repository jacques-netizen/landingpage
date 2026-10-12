'use client'

import type { CampaignReport, ReportClip, ReportMode, ReportSort, ReportStatus } from '@mde/campaigns'
import { formatDollars } from '@mde/money/dollars'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PLATFORM_NAMES, PlatformIcon } from './platform-icon'

// The client's report, built from the owner's "Client Report" mockup (2026-10-12): a sticky section nav
// on the left, the campaign with its figures, submissions as cards, platform donuts, spend, settings and
// clips, and a floating filter bar. Every number is from the JSON endpoint, fetched again every 2
// minutes while the tab is visible and whenever it comes back into focus.
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

// The mockup's palette.
const C = {
  page: '#F2EEE6',
  card: '#FAF8F3',
  line: '#E0D6C6',
  hair: '#E8E1D3',
  ink: '#1A1510',
  muted: '#8A8378',
  dim: '#5F5950',
  gold: '#C9A85C',
  green: '#3E8F6A',
}
const PLATFORM_COLOR: Record<string, string> = { instagram: C.gold, tiktok: C.ink, youtube: '#B0785A', x: '#2E6DB4' }
const ROW_COLOR = { Views: '#2E6DB4', Comments: '#B0785A', Likes: '#B04A6A', Spend: C.ink } as const
const AVATARS = [
  'linear-gradient(135deg,#C9A85C,#7A4E8C)',
  'linear-gradient(135deg,#4FB286,#2E6DB4)',
  'linear-gradient(135deg,#B0785A,#4FB286)',
  'linear-gradient(135deg,#E8A7A0,#C9A85C)',
  'linear-gradient(135deg,#2E6DB4,#4FB286)',
  'linear-gradient(135deg,#B04A6A,#C9A85C)',
]
const avatar = (handle: string) => AVATARS[[...handle].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATARS.length]!

/** 544K, 1.2M; whole numbers below 1,000. */
export function compact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1).replace(/\.0$/, '')}K`
  return n.toLocaleString('en-US')
}
const full = (n: number) => n.toLocaleString('en-US')
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const shortDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dayLabel = (iso: string) => shortDay.format(new Date(`${iso}T00:00:00Z`))
const usDate = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', timeZone: 'UTC' })
const whenFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

const serif = "'EB Garamond', Georgia, serif"
const mono = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const card: React.CSSProperties = { borderRadius: 14, border: `1px solid ${C.line}`, background: C.card }
const cardHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  padding: '18px 24px',
  borderBottom: `1px solid ${C.line}`,
  fontSize: 16,
}
const sectionTitle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontWeight: 700,
  fontSize: 17,
  letterSpacing: '0.08em',
}
const smooth = 'transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out'

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

/** A line with a soft area under it, in the mockup's 1000 by 300 box, with dashed ticks and labels. */
function LineArea({
  values,
  labels,
  color,
  fill,
  format,
  x0 = 40,
}: {
  values: number[]
  labels: string[]
  color: string
  fill: string
  format: (n: number) => string
  x0?: number
}) {
  const h = 300
  const top = 20
  const bot = 260
  const maxV = Math.max(1, ...values)
  const minV = Math.min(0, ...values)
  const n = Math.max(1, values.length)
  const w = 1000 - x0
  const y = (v: number) => bot - ((v - minV) / (maxV - minV || 1)) * (bot - top)
  const pts = values.map((v, i) => [x0 + (n === 1 ? w : (i / (n - 1)) * w), y(v)] as const)
  const d = pts.length ? `M${pts.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(' L')}` : ''
  const zero = y(0)
  const area = pts.length ? `${d} L${(x0 + w).toFixed(1)} ${zero.toFixed(1)} L${x0} ${zero.toFixed(1)}Z` : ''
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => minV + t * (maxV - minV))
  const first = labels[0]
  const mid = labels[Math.floor((labels.length - 1) / 2)]
  const last = labels[labels.length - 1]
  return (
    <div style={{ padding: '22px 20px 14px' }}>
      <svg
        viewBox={`0 0 1000 ${h}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        preserveAspectRatio="none"
        aria-hidden
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x0} x2={1000} y1={y(t)} y2={y(t)} stroke={C.line} strokeDasharray="4 5" />
            <text x={0} y={y(t) + 4} fontFamily={mono} fontSize={13} fill={C.muted}>
              {format(Math.round(t))}
            </text>
          </g>
        ))}
        {area ? <path d={area} fill={fill} /> : null}
        {d ? (
          <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: `10px 0 0 ${x0}px`,
          fontSize: 15,
          color: C.muted,
        }}
      >
        <span>{first ?? ''}</span>
        <span>{labels.length > 2 ? mid : ''}</span>
        <span>{labels.length > 1 ? last : ''}</span>
      </div>
    </div>
  )
}

function Donut({
  title,
  total,
  rows,
}: {
  title: string
  total: string
  rows: { label: string; pct: number; value: string; color: string }[]
}) {
  const circ = 2 * Math.PI * 44
  let acc = 0
  return (
    <div style={card} className={`${smooth} hover:shadow-[0_12px_32px_rgba(26,21,16,0.06)]`}>
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.line}`, fontWeight: 600, fontSize: 16 }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
        <div style={{ borderRight: `1px solid ${C.line}` }}>
          {rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) 64px 70px 14px',
                gap: 10,
                alignItems: 'center',
                padding: '0 24px',
                height: 80,
                borderBottom: `1px solid ${C.hair}`,
                fontSize: 16,
              }}
            >
              <span>{r.label}</span>
              <span style={{ fontFamily: mono, color: C.muted, textAlign: 'right' }}>{r.pct.toFixed(1)}%</span>
              <span style={{ fontFamily: mono, textAlign: 'right' }}>{r.value}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, justifySelf: 'end' }} />
            </div>
          ))}
          {rows.length === 0 ? <div style={{ padding: 24, color: C.muted, fontSize: 15 }}>Nothing yet.</div> : null}
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}
        >
          <svg
            viewBox="0 0 120 120"
            style={{ width: '100%', maxWidth: 200, height: 'auto', transform: 'rotate(-90deg)' }}
            aria-hidden
          >
            <circle cx={60} cy={60} r={44} fill="none" stroke={C.hair} strokeWidth={22} />
            {rows.map((r) => {
              const f = r.pct / 100
              const el = (
                <circle
                  key={r.label}
                  cx={60}
                  cy={60}
                  r={44}
                  fill="none"
                  stroke={r.color}
                  strokeWidth={22}
                  strokeDasharray={`${(circ * f).toFixed(2)} ${circ.toFixed(2)}`}
                  strokeDashoffset={(-acc * circ).toFixed(2)}
                  className={smooth}
                />
              )
              acc += f
              return el
            })}
          </svg>
          <div style={{ position: 'absolute', font: `400 36px ${serif}` }}>{total}</div>
        </div>
      </div>
    </div>
  )
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
  const [extra, setExtra] = useState<ReportClip[]>([])
  const [spendView, setSpendView] = useState<'chart' | 'table'>('chart')
  const [clipPage, setClipPage] = useState(1)
  const [clipPageSize, setClipPageSize] = useState(10)
  const [section, setSection] = useState('campaign')
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
        if (latest.current === qs) {
          if (f.page > 1) {
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
    const fresh = () => void load({ ...filters, page: 1 })
    const start = () => {
      stop()
      timer = setInterval(fresh, REFRESH_MS)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fresh()
        start()
      } else stop()
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', fresh)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', fresh)
    }
  }, [filters, load])

  // Scroll spy for the section nav.
  const SECTIONS = useMemo(
    () =>
      [
        ['campaign', 'Campaign'],
        ['submissions', 'Submissions'],
        ['platforms', 'Platform Stats'],
        ['spend', 'Spend'],
        ['settings', 'Settings'],
        ['clips', 'Clips'],
      ] as const,
    [],
  )
  useEffect(() => {
    const onScroll = () => {
      let cur: string = SECTIONS[0][0]
      for (const [id] of SECTIONS) {
        const el = document.getElementById(`sec-${id}`)
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) cur = id
      }
      setSection(cur)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [SECTIONS])
  const goTo = (id: string) => {
    const el = document.getElementById(`sec-${id}`)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 40, behavior: 'smooth' })
  }

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, page: 1, ...patch }))
  const r = report
  const b = r.budget
  const used = b.budgetCents > 0 ? Math.min(100, (b.spentCents / b.budgetCents) * 100) : 0
  const spendTotal = r.spendByDay.reduce((s, d) => s + d.spendCents, 0)
  const viewsTotal = r.platforms.reduce((s, p) => s + p.views, 0)
  const clipsTotal = r.platforms.reduce((s, p) => s + p.clips, 0)
  const shown = [...r.submissions.rows, ...extra]
  const platformsSeen = ['instagram', 'tiktok', 'youtube', 'x'].filter((p) =>
    [
      ...r.platforms.map((x) => x.platform),
      ...shown.map((c) => c.platform),
      ...r.clipsByPlatformDay.map((x) => x.platform),
    ].includes(p),
  )
  const maxEcpm = Math.max(1, ...r.platforms.map((p) => p.ecpmCents ?? 0))
  const rangeLabel = !filters.from && !filters.to ? 'all' : filters.from && !filters.to ? 'recent' : 'custom'
  const today = new Date().toISOString().slice(0, 10)
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

  // The clips table pages through the cards already loaded, 10 at a time.
  const clipPages = Math.max(1, Math.ceil(shown.length / clipPageSize))
  const clipRows = shown.slice((clipPage - 1) * clipPageSize, clipPage * clipPageSize)

  // Stacked bars: two-day groups of submissions per platform.
  const groups = useMemo(() => {
    const days = [...new Set(r.clipsByPlatformDay.map((x) => x.day))].sort()
    const out: { label: string; by: Record<string, number> }[] = []
    for (let i = 0; i < days.length; i += 2) {
      const pair = days.slice(i, i + 2)
      const by: Record<string, number> = {}
      for (const x of r.clipsByPlatformDay) if (pair.includes(x.day)) by[x.platform] = (by[x.platform] ?? 0) + x.clips
      out.push({ label: dayLabel(pair[0]!), by })
    }
    return out
  }, [r.clipsByPlatformDay])
  const groupMax = Math.max(1, ...groups.map((g) => Object.values(g.by).reduce((a, v) => a + v, 0)))

  const kpiIcons: Record<string, string> = {
    Views: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    Likes: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
    Comments: 'M4 5h16v11H9l-5 4z',
    Shares: 'M14 5l7 6-7 6v-4C8 13 5 15 3 19c1-6 4-10 11-11z',
    Submitted: 'M4 5h16v14H4zM4 9h16M9 5v14',
  }

  const [player, setPlayer] = useState<ReportClip | null>(null)

  return (
    <div
      className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)] max-lg:grid-cols-1"
      style={{ background: C.page, color: C.ink, fontFamily: 'Archivo, system-ui, sans-serif' }}
    >
      {/* Section nav */}
      <aside
        className="sticky top-0 box-border flex h-screen flex-col max-lg:static max-lg:h-auto max-lg:flex-row max-lg:items-center max-lg:gap-6 max-lg:overflow-x-auto"
        style={{ padding: '40px 36px', borderRight: `1px solid ${C.line}`, background: C.page }}
      >
        <img
          src="/designed/logo-nav-clear.png"
          alt="Maison d'Élites"
          style={{ height: 24, width: 'auto', objectFit: 'contain', objectPosition: 'left', display: 'block' }}
        />
        <nav
          aria-label="Report sections"
          className="my-auto flex flex-col gap-2 max-lg:my-0 max-lg:flex-row max-lg:gap-5"
        >
          {SECTIONS.map(([id, label]) => {
            const on = section === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTo(id)}
                aria-current={on ? 'true' : undefined}
                className={`${smooth} flex cursor-pointer items-center gap-3 border-0 bg-transparent p-0 py-2 text-left font-[inherit] whitespace-nowrap hover:text-[#1A1510]`}
                style={{ fontSize: 17, color: on ? C.ink : C.muted, fontWeight: on ? 500 : 400 }}
              >
                <span
                  className={`${smooth} max-lg:hidden`}
                  style={{
                    width: 12,
                    height: 2,
                    background: C.gold,
                    opacity: on ? 1 : 0,
                    transform: on ? 'scaleX(1)' : 'scaleX(0.4)',
                  }}
                />
                {label}
              </button>
            )
          })}
        </nav>
        <div className="max-lg:hidden" style={{ font: `500 11px ${mono}`, letterSpacing: '0.18em', color: C.muted }}>
          SHARED REPORT
          <div style={{ marginTop: 8, letterSpacing: 0, fontSize: 11 }}>
            Updated {r.lastUpdated ? whenFmt.format(new Date(r.lastUpdated)) : 'never'}
            {state === 'loading' ? ' · updating' : state === 'error' ? ' · could not refresh' : ''}
          </div>
        </div>
      </aside>

      <main
        className="flex min-w-0 flex-col gap-16 px-14 pt-12 pb-36 max-lg:px-5 max-lg:pt-6"
        style={{ paddingBottom: 140 }}
      >
        {/* Campaign */}
        <section id="sec-campaign" aria-label="Campaign" className="flex flex-col gap-7">
          <div className="flex flex-wrap items-start gap-8">
            <div className="min-w-0 flex-[1_1_360px]">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 18 }}>
                <img
                  src="/designed/camp-logo.png"
                  alt=""
                  style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.line}` }}
                />
                <span style={{ fontWeight: 600 }}>Maison d’Élites</span>
                <span style={{ color: C.muted }}>Campaign Report</span>
              </div>
              <h1
                style={{
                  margin: '22px 0 0',
                  font: `400 clamp(36px,5vw,56px)/1.05 ${serif}`,
                  letterSpacing: '-0.01em',
                  textWrap: 'balance',
                }}
              >
                {r.campaign.title}
              </h1>
              <div
                style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, color: C.muted }}
              >
                {r.campaign.startAt ? dateFmt.format(new Date(r.campaign.startAt)) : 'Not started'} <span>→</span>
                <span
                  style={{
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 8,
                    background: C.hair,
                    color: C.ink,
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 16,
                  }}
                >
                  {r.campaign.status}
                </span>
              </div>
            </div>
            {r.campaign.thumbnail ? (
              <img
                src={r.campaign.thumbnail}
                alt=""
                style={{
                  flex: '0 1 440px',
                  width: '100%',
                  maxWidth: 440,
                  aspectRatio: '16 / 9',
                  objectFit: 'cover',
                  borderRadius: 16,
                  border: `1px solid ${C.line}`,
                  display: 'block',
                }}
              />
            ) : null}
          </div>
          <div style={{ height: 1, background: C.line }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16 }}>
            {(
              [
                ['Views', compact(r.totals.views), full(r.totals.views)],
                ['Likes', compact(r.totals.likes), full(r.totals.likes)],
                ['Comments', compact(r.totals.comments), full(r.totals.comments)],
                ['Shares', compact(r.totals.shares), full(r.totals.shares)],
                ['Submitted', compact(r.counts.submitted), full(r.counts.submitted)],
              ] as const
            ).map(([label, v, title]) => (
              <div
                key={label}
                style={{ ...card, padding: '26px 24px' }}
                className={`${smooth} hover:-translate-y-[1px] hover:shadow-[0_12px_32px_rgba(26,21,16,0.06)]`}
              >
                <div style={{ font: `400 40px/1 ${serif}` }} title={title}>
                  {v}
                </div>
                <div
                  style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: C.muted }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d={kpiIcons[label]} />
                  </svg>
                  {label}
                </div>
              </div>
            ))}
          </div>
          <div style={card}>
            <LineArea
              values={r.viewsByDay.map((d) => d.views)}
              labels={r.viewsByDay.map((d) => dayLabel(d.day))}
              color={C.gold}
              fill="rgba(201,168,92,0.14)"
              format={compact}
            />
          </div>
          <div style={card}>
            <div style={cardHead}>
              <span style={{ fontWeight: 600 }}>Campaign Budget</span>
              <span style={{ fontSize: 17, color: C.muted }}>Entire campaign</span>
            </div>
            <div
              style={{ padding: '22px 24px', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 24 }}
            >
              {(
                [
                  ['Total budget', formatDollars(b.budgetCents)],
                  ['Spent', formatDollars(b.spentCents)],
                  ['Remaining', formatDollars(b.remainingCents)],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 15, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {k}
                  </div>
                  <div style={{ marginTop: 8, font: `400 28px ${serif}` }}>{v}</div>
                </div>
              ))}
              <div
                style={{ gridColumn: '1/-1', height: 6, borderRadius: 3, background: C.hair }}
                role="img"
                aria-label={`${used.toFixed(1)}% of the budget used`}
              >
                <div
                  className={smooth}
                  style={{ height: '100%', borderRadius: 3, background: C.gold, width: `${used}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Submissions */}
        <section id="sec-submissions" aria-label="Submissions" className="flex flex-col gap-[18px]">
          <div style={sectionTitle}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M4 5h16v14H4zM4 9h16M9 5v14" />
            </svg>
            SUBMISSIONS
          </div>
          <div style={{ fontSize: 17, color: C.muted }}>
            <b style={{ color: C.ink, fontWeight: 600 }}>{full(r.counts.submitted)}</b> submitted ·{' '}
            <b style={{ color: C.ink, fontWeight: 600 }}>{full(r.counts.approved)}</b> approved ·{' '}
            <b style={{ color: C.ink, fontWeight: 600 }}>{full(r.counts.pending)}</b> pending review
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              value={filters.sort}
              onChange={(e) => set({ sort: e.target.value as ReportSort })}
              aria-label="Sort submissions"
              className={`${smooth} cursor-pointer appearance-none hover:border-[#C9A85C]`}
              style={{
                height: 46,
                padding: '0 36px 0 18px',
                borderRadius: 10,
                border: `1px solid ${C.line}`,
                background: `${C.card} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%238A8378' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 14px center`,
                fontSize: 16,
                color: C.ink,
                fontFamily: 'inherit',
              }}
            >
              <option value="views">Most Views</option>
              <option value="newest">Newest</option>
              <option value="spend">Most Spend</option>
            </select>
            <div style={{ display: 'flex', gap: 26, fontSize: 16 }}>
              <a
                href={`/api/r/${token}/report.csv${queryString({ ...filters, page: 1 }) ? `?${queryString({ ...filters, page: 1 })}` : ''}`}
                className={`${smooth} no-underline hover:text-[#8A8378]`}
                style={{ color: C.ink }}
              >
                Export CSV
              </a>
              {shown.length < r.submissions.total ? (
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                  disabled={state === 'loading'}
                  className={`${smooth} cursor-pointer border-0 bg-transparent p-0 font-[inherit] hover:text-[#8A8378]`}
                  style={{ fontSize: 16, color: C.ink }}
                >
                  Show all →
                </button>
              ) : null}
            </div>
          </div>
          {shown.length === 0 ? (
            <div style={{ ...card, padding: '28px 24px', color: C.muted, fontSize: 16 }}>
              No submissions in these dates yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
              {shown.map((c) => (
                <SubmissionCard
                  key={c.id}
                  c={c}
                  token={token}
                  minViews={r.campaign.minViewsToEarn}
                  onPlay={setPlayer}
                />
              ))}
            </div>
          )}
          <div
            style={{
              ...card,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              padding: '18px 22px',
              fontSize: 16,
            }}
          >
            <span>
              You are seeing{' '}
              {filters.sort === 'views' ? 'top' : filters.sort === 'newest' ? 'the newest' : 'the highest spend'}{' '}
              submissions for the selected dates.
            </span>
            <span style={{ color: C.dim }}>{full(r.totals.clips)} clips with views or spend in these dates →</span>
          </div>
        </section>

        {/* Platform stats */}
        <section id="sec-platforms" aria-label="Platform stats" className="flex flex-col gap-[18px]">
          <div style={sectionTitle}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
            </svg>
            PLATFORM STATS
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(420px,100%),1fr))', gap: 18 }}
          >
            <Donut
              title="Views"
              total={compact(viewsTotal)}
              rows={r.platforms.map((p) => ({
                label: PLATFORM_NAMES[p.platform] ?? p.platform,
                pct: viewsTotal ? (p.views / viewsTotal) * 100 : 0,
                value: compact(p.views),
                color: PLATFORM_COLOR[p.platform] ?? C.muted,
              }))}
            />
            <Donut
              title="Posts"
              total={full(clipsTotal)}
              rows={r.platforms.map((p) => ({
                label: PLATFORM_NAMES[p.platform] ?? p.platform,
                pct: clipsTotal ? (p.clips / clipsTotal) * 100 : 0,
                value: full(p.clips),
                color: PLATFORM_COLOR[p.platform] ?? C.muted,
              }))}
            />
          </div>
          <div style={card}>
            <div style={cardHead}>
              <span style={{ fontWeight: 600 }}>CPM by Platform</span>
              <span style={{ fontSize: 17, color: C.muted }}>Selected dates</span>
            </div>
            <div style={{ padding: '14px 24px 10px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '150px minmax(0,1fr) 80px 80px',
                  gap: 20,
                  fontSize: 16,
                  color: C.muted,
                  padding: '8px 0',
                }}
              >
                <span />
                <span />
                <span style={{ textAlign: 'right' }}>CPM</span>
                <span style={{ textAlign: 'right' }}>eCPM</span>
              </div>
              {r.platforms.map((p) => (
                <div
                  key={p.platform}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '150px minmax(0,1fr) 80px 80px',
                    gap: 20,
                    alignItems: 'center',
                    height: 64,
                    fontSize: 16,
                  }}
                >
                  <span>{PLATFORM_NAMES[p.platform] ?? p.platform}</span>
                  <div style={{ height: 6, borderRadius: 3, background: C.hair }}>
                    <div
                      className={smooth}
                      style={{
                        height: '100%',
                        borderRadius: 3,
                        background: PLATFORM_COLOR[p.platform] ?? C.muted,
                        width: `${((p.ecpmCents ?? 0) / maxEcpm) * 100}%`,
                      }}
                    />
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: mono, color: C.muted }}>
                    {formatDollars(r.campaign.rateCentsPer1000)}
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: mono, fontWeight: 600 }}>
                    {p.ecpmCents === null ? '—' : formatDollars(p.ecpmCents)}
                  </span>
                </div>
              ))}
              {r.platforms.length === 0 ? (
                <div style={{ padding: '12px 0 16px', color: C.muted, fontSize: 15 }}>No views yet.</div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Spend */}
        <section id="sec-spend" aria-label="Spend" className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-baseline gap-[14px]">
            <span style={sectionTitle}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="M3 7h18v12H3zM3 11h18M7 15h3" />
              </svg>
              SPEND
            </span>
            <span style={{ fontSize: 17, color: C.muted }}>
              Spend counts money when it is reserved for a clip. Returns count on the day they happen.
            </span>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(420px,100%),1fr))', gap: 18 }}
          >
            <div style={card}>
              <div style={{ ...cardHead, padding: '14px 24px' }}>
                <span style={{ fontWeight: 600 }}>Top accounts</span>
                <span style={{ fontSize: 15, color: C.muted }}>Highest first</span>
              </div>
              {r.accounts.map((a) => (
                <div
                  key={a.handle}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) 110px 70px 100px',
                    gap: 14,
                    alignItems: 'center',
                    padding: '0 24px',
                    height: 64,
                    borderBottom: `1px solid ${C.hair}`,
                    fontSize: 16,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span
                      style={{ width: 22, height: 22, borderRadius: '50%', background: avatar(a.handle), flex: 'none' }}
                    />
                    <span
                      style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {a.handle}
                    </span>
                    <span style={{ color: C.muted, flex: 'none' }}>
                      {a.posts} {a.posts === 1 ? 'post' : 'posts'}
                    </span>
                  </span>
                  <div style={{ height: 5, borderRadius: 3, background: C.hair }}>
                    <div
                      className={smooth}
                      style={{ height: '100%', borderRadius: 3, background: C.ink, width: `${a.share}%` }}
                    />
                  </div>
                  <span style={{ fontFamily: mono, color: C.muted, textAlign: 'right' }}>{a.share}%</span>
                  <span style={{ fontFamily: mono, fontWeight: 600, textAlign: 'right' }}>
                    {formatDollars(a.spentCents)}
                  </span>
                </div>
              ))}
              {r.accounts.length === 0 ? (
                <div style={{ padding: 24, color: C.muted, fontSize: 15 }}>No spend yet.</div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 24px', fontSize: 16 }}>
                <span style={{ color: C.muted }}>Total spend</span>
                <span style={{ fontFamily: mono, fontWeight: 600 }}>{formatDollars(spendTotal)}</span>
              </div>
            </div>
            <div>
              <div style={card}>
                <div style={{ ...cardHead, padding: '14px 24px' }}>
                  <span style={{ fontWeight: 600 }}>Daily Spend</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 16, color: C.muted }}>
                    Total {formatDollars(spendTotal)}
                    <span
                      role="group"
                      aria-label="Show as"
                      style={{ display: 'flex', border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}
                    >
                      {(['chart', 'table'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={spendView === k}
                          onClick={() => setSpendView(k)}
                          className={`${smooth} cursor-pointer border-0 font-[inherit]`}
                          style={{
                            padding: '8px 12px',
                            background: spendView === k ? C.ink : 'transparent',
                            color: spendView === k ? C.page : C.muted,
                            fontSize: 15,
                          }}
                        >
                          {k === 'chart' ? 'Chart' : 'Table'}
                        </button>
                      ))}
                    </span>
                  </span>
                </div>
                {spendView === 'chart' ? (
                  <LineArea
                    values={r.spendByDay.map((d) => d.spendCents)}
                    labels={r.spendByDay.map((d) => dayLabel(d.day))}
                    color={C.green}
                    fill="rgba(79,178,134,0.12)"
                    format={(c) => (c === 0 ? '$0' : `${c < 0 ? '-' : ''}$${compact(Math.abs(Math.round(c / 100)))}`)}
                    x0={60}
                  />
                ) : (
                  <div>
                    {r.spendByDay.map((d) => (
                      <div
                        key={d.day}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0 24px',
                          height: 52,
                          alignItems: 'center',
                          borderBottom: `1px solid ${C.hair}`,
                          fontSize: 16,
                        }}
                      >
                        <span>{dayLabel(d.day)}</span>
                        <span style={{ fontFamily: mono }}>{formatDollars(d.spendCents)}</span>
                      </div>
                    ))}
                    {r.spendByDay.length === 0 ? (
                      <div style={{ padding: 24, color: C.muted, fontSize: 15 }}>No spend yet.</div>
                    ) : null}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 14, fontSize: 15, lineHeight: 1.5, color: C.muted }}>
                A day can be negative when more was returned than reserved. Dates are UTC.
              </div>
            </div>
          </div>
        </section>

        {/* Settings */}
        <section id="sec-settings" aria-label="Settings" className="flex flex-col gap-[18px]">
          <div style={sectionTitle}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" />
            </svg>
            SETTINGS
          </div>
          <div style={card}>
            <div style={cardHead}>
              <span style={{ fontWeight: 600 }}>Campaign settings</span>
              <span style={{ fontSize: 17, color: C.muted }}>Current as of {dateFmt.format(new Date())}</span>
            </div>
            <div style={{ margin: 24, border: `1px solid ${C.hair}`, borderRadius: 10, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) 140px 160px',
                  gap: 16,
                  padding: '14px 28px',
                  fontSize: 16,
                  color: C.muted,
                  background: '#F4F0E7',
                }}
              >
                <span>Platform</span>
                <span style={{ textAlign: 'right' }}>CPM</span>
                <span style={{ textAlign: 'right' }}>Budget</span>
              </div>
              {platformsSeen.map((p) => (
                <div
                  key={p}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) 140px 160px',
                    gap: 16,
                    alignItems: 'center',
                    padding: '0 28px',
                    height: 60,
                    borderTop: `1px solid ${C.hair}`,
                    fontSize: 16,
                  }}
                >
                  <span>{PLATFORM_NAMES[p] ?? p}</span>
                  <span style={{ textAlign: 'right', fontFamily: mono }}>
                    {formatDollars(r.campaign.rateCentsPer1000)}
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: mono }}>{formatDollars(b.budgetCents)}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 24px 20px', fontSize: 14, color: C.muted }}>
              One budget for the whole campaign, shared across its platforms.
              {r.campaign.minViewsToEarn > 0
                ? ` A post earns from ${compact(r.campaign.minViewsToEarn)} counted views.`
                : ''}
            </div>
          </div>
        </section>

        {/* Clips */}
        <section id="sec-clips" aria-label="Clips" className="flex flex-col gap-[18px]">
          <div style={sectionTitle}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M3 6h18v12H3zM10 9v6l5-3z" />
            </svg>
            CLIPS
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px 24px',
                borderBottom: `1px solid ${C.line}`,
                fontSize: 16,
              }}
            >
              <span style={{ fontWeight: 600 }}>Top clips</span>
              <span
                role="group"
                aria-label="Order"
                style={{ display: 'flex', background: '#EDE7DA', borderRadius: 8, padding: 3 }}
              >
                {(
                  [
                    ['views', 'All dates'],
                    ['newest', 'By day'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={filters.sort === k}
                    onClick={() => set({ sort: k })}
                    className={`${smooth} cursor-pointer border-0 font-[inherit]`}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 6,
                      background: filters.sort === k ? '#fff' : 'transparent',
                      color: filters.sort === k ? C.ink : C.muted,
                      fontSize: 16,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 960 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '170px 90px minmax(200px,1fr) 80px 70px 90px 70px 80px',
                    gap: 12,
                    padding: '14px 24px',
                    fontSize: 16,
                    color: C.muted,
                    borderBottom: `1px solid ${C.line}`,
                  }}
                >
                  <span>Account</span>
                  <span>Platform</span>
                  <span>Post</span>
                  <span>Views {filters.sort === 'views' ? '↓' : ''}</span>
                  <span>Likes</span>
                  <span>Comments</span>
                  <span>Shares</span>
                  <span>Date</span>
                </div>
                {clipRows.map((c) => (
                  <div
                    key={c.id}
                    className={`${smooth} hover:bg-[#F4F0E7]`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '170px 90px minmax(200px,1fr) 80px 70px 90px 70px 80px',
                      gap: 12,
                      alignItems: 'center',
                      padding: '16px 24px',
                      borderBottom: `1px solid ${C.hair}`,
                      fontSize: 16,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: avatar(c.handle),
                          flex: 'none',
                        }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.handle}
                      </span>
                    </span>
                    <span style={{ color: C.dim, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <PlatformIcon platform={c.platform} size={14} />
                      {PLATFORM_NAMES[c.platform] ?? c.platform}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                      <div className={`${smooth} hover:scale-[1.03]`} style={{ width: 60, flex: 'none' }}>
                        <ClipFrame c={c} token={token} radius={8} playSize={28} inline={false} onOpen={setPlayer} />
                      </div>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${smooth} hover:text-[#1A1510]`}
                        style={{
                          color: C.dim,
                          fontSize: 15,
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                        }}
                      >
                        {c.url.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    </span>
                    <span style={{ fontFamily: mono }}>{full(c.views)}</span>
                    <span style={{ fontFamily: mono }}>{full(c.likes)}</span>
                    <span style={{ fontFamily: mono }}>{full(c.comments)}</span>
                    <span style={{ fontFamily: mono }}>{full(c.shares)}</span>
                    <span style={{ color: C.dim, fontSize: 15 }}>
                      {usDate.format(new Date(c.postedAt ?? c.submittedAt))}
                    </span>
                  </div>
                ))}
                {clipRows.length === 0 ? (
                  <div style={{ padding: 24, color: C.muted, fontSize: 15 }}>No clips in these dates yet.</div>
                ) : null}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: '18px 24px',
                fontSize: 16,
                color: C.muted,
              }}
            >
              <span>
                Showing{' '}
                <b style={{ color: C.ink, fontWeight: 600 }}>
                  {shown.length ? (clipPage - 1) * clipPageSize + 1 : 0} to{' '}
                  {Math.min(shown.length, clipPage * clipPageSize)}
                </b>{' '}
                of {full(r.submissions.total)} clips
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span
                  role="group"
                  aria-label="Clip pages"
                  style={{ display: 'flex', border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}
                >
                  {['‹', ...Array.from({ length: Math.min(clipPages, 5) }, (_, i) => String(i + 1)), '›'].map((l) => {
                    const on = l === String(clipPage)
                    const go = () => {
                      if (l === '‹') setClipPage((p) => Math.max(1, p - 1))
                      else if (l === '›') setClipPage((p) => Math.min(clipPages, p + 1))
                      else setClipPage(Number(l))
                    }
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={go}
                        aria-current={on ? 'page' : undefined}
                        className={`${smooth} cursor-pointer border-0 font-[inherit]`}
                        style={{
                          minWidth: 40,
                          height: 40,
                          background: on ? C.ink : 'transparent',
                          color: on ? C.page : C.ink,
                          fontSize: 16,
                        }}
                      >
                        {l}
                      </button>
                    )
                  })}
                </span>
                <select
                  value={clipPageSize}
                  onChange={(e) => {
                    setClipPageSize(Number(e.target.value))
                    setClipPage(1)
                  }}
                  aria-label="Clips per page"
                  className="cursor-pointer appearance-none"
                  style={{
                    height: 42,
                    padding: '0 30px 0 14px',
                    borderRadius: 8,
                    border: `1px solid ${C.line}`,
                    background: `transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%231A1510' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 12px center`,
                    color: C.ink,
                    fontSize: 16,
                    fontFamily: 'inherit',
                  }}
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      Show {n}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>
          <div style={card}>
            <div style={{ ...cardHead, padding: '16px 24px' }}>
              <span>
                <span style={{ fontWeight: 600 }}>Platforms</span>{' '}
                <span style={{ fontFamily: mono, fontSize: 15, color: C.muted, marginLeft: 8 }}>2-day groups</span>
              </span>
              <span style={{ display: 'flex', gap: 22, fontSize: 16 }}>
                {platformsSeen.map((p) => (
                  <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{ width: 8, height: 8, borderRadius: '50%', background: PLATFORM_COLOR[p] ?? C.muted }}
                    />
                    {PLATFORM_NAMES[p] ?? p}
                  </span>
                ))}
              </span>
            </div>
            <div style={{ padding: '22px 20px 14px' }}>
              <svg
                viewBox="0 0 1000 272"
                style={{ width: '100%', height: 'auto', display: 'block' }}
                preserveAspectRatio="none"
                aria-hidden
              >
                {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                  <g key={t}>
                    <line
                      x1={40}
                      x2={1000}
                      y1={260 - t * 240}
                      y2={260 - t * 240}
                      stroke={C.line}
                      strokeDasharray="4 5"
                    />
                    <text x={0} y={264 - t * 240} fontFamily={mono} fontSize={13} fill={C.muted}>
                      {Math.round(t * groupMax)}
                    </text>
                  </g>
                ))}
                {groups.map((g, i) => {
                  const slot = 960 / Math.max(1, groups.length)
                  const w = Math.min(64, Math.max(3, slot - 8))
                  const x = 40 + i * slot + (slot - w) / 2
                  let yTop = 260
                  return platformsSeen.map((p) => {
                    const h = ((g.by[p] ?? 0) / groupMax) * 240
                    yTop -= h
                    return (
                      <rect
                        key={`${g.label}-${p}`}
                        x={x}
                        y={yTop}
                        width={w}
                        height={h}
                        fill={PLATFORM_COLOR[p] ?? C.muted}
                        className={smooth}
                      />
                    )
                  })
                })}
              </svg>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0 0 40px',
                  fontSize: 15,
                  color: C.muted,
                }}
              >
                <span>{groups[0]?.label ?? ''}</span>
                <span>{groups.length > 2 ? groups[Math.floor((groups.length - 1) / 2)]!.label : ''}</span>
                <span>{groups.length > 1 ? groups[groups.length - 1]!.label : ''}</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating filters */}
      <div
        className="fixed bottom-7 left-1/2 z-20 flex -translate-x-1/2 items-center gap-[10px] rounded-full p-[10px] max-sm:bottom-3 max-sm:max-w-[calc(100vw-24px)] max-sm:flex-wrap max-sm:justify-center"
        style={{
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: `1px solid ${C.line}`,
          boxShadow: '0 20px 50px rgba(26,21,16,0.14)',
        }}
      >
        <select
          value={rangeLabel}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'all') set({ from: '', to: '' })
            else if (v === '7') set({ from: daysAgo(6), to: today })
            else if (v === '30') set({ from: daysAgo(29), to: today })
          }}
          aria-label="Dates"
          className="cursor-pointer appearance-none"
          style={{
            height: 46,
            padding: '0 36px 0 20px',
            borderRadius: 999,
            border: `1px solid ${C.line}`,
            background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%238A8378' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 16px center`,
            fontSize: 16,
            fontWeight: 500,
            color: C.ink,
            fontFamily: 'inherit',
          }}
        >
          <option value="all">All Time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          {rangeLabel === 'custom' || rangeLabel === 'recent' ? <option value="custom">Selected dates</option> : null}
        </select>
        <select
          value={filters.mode}
          onChange={(e) => set({ mode: e.target.value as ReportMode })}
          aria-label="Which posts count"
          className="cursor-pointer appearance-none"
          style={{
            height: 46,
            padding: '0 36px 0 20px',
            borderRadius: 999,
            border: `1px solid ${C.line}`,
            background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%238A8378' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 16px center`,
            fontSize: 16,
            fontWeight: 500,
            color: C.ink,
            fontFamily: 'inherit',
          }}
        >
          <option value="all">Paid + pending</option>
          <option value="paid">Paid</option>
        </select>
        <span style={{ width: 1, height: 28, background: C.line, margin: '0 4px' }} />
        {platformsSeen.map((p) => {
          const on = filters.platform === '' || filters.platform === p
          const ab = { instagram: 'IG', tiktok: 'TT', youtube: 'YT', x: 'X' }[p] ?? p.slice(0, 2).toUpperCase()
          return (
            <button
              key={p}
              type="button"
              title={PLATFORM_NAMES[p] ?? p}
              aria-pressed={filters.platform === p}
              onClick={() => set({ platform: filters.platform === p ? '' : p })}
              className={`${smooth} cursor-pointer hover:scale-105`}
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                border: `1px solid ${C.line}`,
                background: on ? C.ink : '#fff',
                color: on ? C.page : C.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: `600 11px ${mono}`,
                letterSpacing: '0.04em',
              }}
            >
              {ab}
            </button>
          )
        })}
      </div>
      {player ? <PlayerOverlay c={player} token={token} onClose={() => setPlayer(null)} /> : null}
    </div>
  )
}

/** The payout, or the short reason there is none yet. */
function spendLabel(c: ReportClip, minViews: number) {
  if (c.payoutCents > 0) return formatDollars(c.payoutCents)
  if (c.status === 'rejected') return 'Not paid'
  if (c.status === 'pending') return 'In review'
  if (minViews > 0 && c.countedViews < minViews) return `Below ${compact(minViews)} min`
  if (c.countedViews === 0) return 'No views yet'
  return formatDollars(0)
}

/** The platform's own player for the post, the way the clip is shown wherever it is embedded. */
function embedUrl(c: ReportClip, play: boolean) {
  switch (c.platform) {
    case 'tiktok':
      return `https://www.tiktok.com/embed/v2/${c.platformPostId}`
    case 'instagram':
      return `https://www.instagram.com/p/${c.platformPostId}/embed/`
    case 'youtube':
      return `https://www.youtube.com/embed/${c.platformPostId}?playsinline=1${play ? '&autoplay=1' : ''}`
    case 'x':
      return `https://platform.twitter.com/embed/Tweet.html?id=${c.platformPostId}&theme=light&dnt=true`
    default:
      return c.url
  }
}

/** The platform's player at the size it is designed for; the frame scales it from here when it must. */
const PLAYER_W = 325
const PLAYER_H = 578

/** The clip's file or picture, streamed through the app so the platforms' expiring links never break the page. */
const mediaSrc = (token: string, c: ReportClip, kind: 'video' | 'image') => `/api/r/${token}/media/${c.id}?kind=${kind}`

/** Only one clip plays at a time. */
function pauseOthers(except: HTMLVideoElement | null) {
  for (const v of Array.from(document.querySelectorAll('video'))) if (v !== except && !v.paused) v.pause()
}

/**
 * The clip in a 9:16 frame, the video itself with its picture as the poster. A click plays it in place,
 * with sound; another click pauses. A post with no video file shows its picture and opens the platform's
 * player; one with neither shows that player scaled into the frame, so nothing is ever blank.
 */
function ClipFrame({
  c,
  token,
  radius = 10,
  playSize = 52,
  inline = true,
  onOpen,
}: {
  c: ReportClip
  token: string
  radius?: number
  playSize?: number
  inline?: boolean
  onOpen?: (c: ReportClip) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [scale, setScale] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [broken, setBroken] = useState(false)
  const hasVideo = !!c.video && !broken
  const scaled = !hasVideo && !c.thumbnail
  useEffect(() => {
    if (!scaled || !ref.current) return
    const el = ref.current
    const fit = () => setScale(el.clientWidth / PLAYER_W)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scaled])
  const activate = () => {
    if (hasVideo && inline) {
      const v = video.current
      if (!v) return
      if (v.paused) {
        pauseOthers(v)
        v.play().catch(() => setBroken(true))
      } else v.pause()
    } else onOpen?.(c)
  }
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={playing ? `Pause ${c.handle}'s clip` : `Play ${c.handle}'s clip`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      className="group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#C9A85C]"
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '9 / 16',
        borderRadius: radius,
        overflow: 'hidden',
        background: C.ink,
      }}
    >
      {hasVideo ? (
        <video
          ref={video}
          src={mediaSrc(token, c, 'video')}
          poster={c.thumbnail ? mediaSrc(token, c, 'image') : undefined}
          playsInline
          loop
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setBroken(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : c.thumbnail ? (
        <img
          src={mediaSrc(token, c, 'image')}
          alt=""
          className={`${smooth} group-hover:scale-[1.03]`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : scale > 0 ? (
        <iframe
          title={`${c.handle} on ${PLATFORM_NAMES[c.platform] ?? c.platform}`}
          src={embedUrl(c, false)}
          loading="lazy"
          tabIndex={-1}
          aria-hidden
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: PLAYER_W,
            height: PLAYER_H,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            background: C.ink,
          }}
        />
      ) : null}
      <span
        className={smooth}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: playing ? 0 : 1,
          background: 'linear-gradient(180deg, rgba(26,21,16,0) 55%, rgba(26,21,16,0.45) 100%)',
        }}
      >
        <span
          className={`${smooth} group-hover:scale-110`}
          style={{
            width: playSize,
            height: playSize,
            borderRadius: '50%',
            background: 'rgba(26,21,16,0.55)',
            border: '1px solid rgba(255,255,255,0.35)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width={playSize * 0.36} height={playSize * 0.36} viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </div>
  )
}

/** The clip full size over the page: the video itself, or the platform's player when there is no file. */
function PlayerOverlay({ c, token, onClose }: { c: ReportClip; token: string; onClose: () => void }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    pauseOthers(null)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  const hasVideo = !!c.video && !broken
  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-label={`${c.handle}'s clip`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(26,21,16,0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'reportFadeIn .2s ease-out',
      }}
    >
      <style>{`@keyframes reportFadeIn{from{opacity:0}to{opacity:1}}@keyframes reportRiseIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 380px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          animation: 'reportRiseIn .25s ease-out',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, fontSize: 15 }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: avatar(c.handle), flex: 'none' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
              {c.handle}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlatformIcon platform={c.platform} size={14} />
              {PLATFORM_NAMES[c.platform] ?? c.platform}
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`${smooth} cursor-pointer hover:bg-[rgba(255,255,255,0.18)]`}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 18,
              lineHeight: 1,
              flex: 'none',
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            width: '100%',
            height: hasVideo ? 'auto' : 'min(78vh, 720px)',
            aspectRatio: hasVideo ? '9 / 16' : undefined,
            maxHeight: '78vh',
            borderRadius: 16,
            overflow: 'hidden',
            background: C.ink,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}
        >
          {hasVideo ? (
            <video
              key={c.id}
              src={mediaSrc(token, c, 'video')}
              poster={c.thumbnail ? mediaSrc(token, c, 'image') : undefined}
              controls
              autoPlay
              playsInline
              loop
              onError={() => setBroken(true)}
              style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', background: C.ink }}
            />
          ) : (
            <iframe
              key={c.id}
              title={`${c.handle} on ${PLATFORM_NAMES[c.platform] ?? c.platform}`}
              src={embedUrl(c, true)}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ width: '100%', height: '100%', border: 0, display: 'block', background: C.ink }}
            />
          )}
        </div>
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className={`${smooth} no-underline hover:text-[#fff]`}
          style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center' }}
        >
          Open on {PLATFORM_NAMES[c.platform] ?? c.platform} ↗
        </a>
      </div>
    </div>,
    document.body,
  )
}

/** A submission card: the clip in its frame on the left, its figures on the right. Play opens the player. */
function SubmissionCard({
  c,
  token,
  minViews,
  onPlay,
}: {
  c: ReportClip
  token: string
  minViews: number
  onPlay: (c: ReportClip) => void
}) {
  const rows = [
    ['Views', full(c.views)],
    ['Comments', full(c.comments)],
    ['Likes', full(c.likes)],
    ['Spend', spendLabel(c, minViews)],
  ] as const
  return (
    <div
      className={`${smooth} hover:-translate-y-[1px] hover:shadow-[0_14px_36px_rgba(26,21,16,0.08)]`}
      style={{
        ...card,
        display: 'grid',
        gridTemplateColumns: '176px minmax(0,1fr)',
        overflow: 'hidden',
      }}
    >
      <div style={{ margin: 10, marginRight: 0 }}>
        <ClipFrame c={c} token={token} onOpen={onPlay} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 16px 14px', minWidth: 0 }}>
        {rows.map(([l, v]) => (
          <div
            key={l}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 0',
              borderBottom: `1px solid ${C.hair}`,
              fontSize: 16,
              gap: 8,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.dim }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROW_COLOR[l], flex: 'none' }} />
              {l}
            </span>
            <span style={{ fontFamily: mono, fontSize: 15, textAlign: 'right', minWidth: 0 }}>{v}</span>
          </div>
        ))}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
            color: C.dim,
            gap: 8,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: avatar(c.handle), flex: 'none' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.handle}</span>
          </span>
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className={`${smooth} no-underline hover:text-[#1A1510]`}
            style={{ flex: 'none', color: C.dim }}
          >
            {PLATFORM_NAMES[c.platform] ?? c.platform} ↗
          </a>
        </div>
      </div>
    </div>
  )
}
