// Every music number the report and the admin show (build proposal section 6). Pure, so it is tested on
// fixed data. Days are UTC "YYYY-MM-DD" strings. A missing day is a gap, never a zero.
import { MANUAL_SOURCES, type Source } from './metrics'

export type Row = {
  date: string
  value: number
  isCumulative: boolean
  source: Source
  periodStart?: string | null
  periodEnd?: string | null
}
export type Day = { date: string; value: number }

const DAY_MS = 86_400_000
export const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)

/**
 * Daily values from running totals: today's total minus yesterday's, only where both days exist.
 * A total that went down is kept as a negative day and listed in `drops` for the data health list.
 */
export function dailyFromCumulative(points: Day[]): { daily: Day[]; drops: string[] } {
  const byDate = new Map(points.map((p) => [p.date, p.value]))
  const dates = [...byDate.keys()].sort()
  const daily: Day[] = []
  const drops: string[] = []
  for (const d of dates) {
    const prev = byDate.get(addDays(d, -1))
    if (prev === undefined) continue
    const v = byDate.get(d)! - prev
    if (v < 0) drops.push(d)
    daily.push({ date: d, value: v })
  }
  return { daily, drops }
}

/** Daily values from rows that each count one day, or one period (a week export): spread evenly. */
export function dailyFromPeriods(rows: Row[]): Day[] {
  const out = new Map<string, number>()
  for (const r of rows) {
    const start = r.periodStart ?? r.date
    const end = r.periodEnd ?? r.date
    const n = daysBetween(start, end) + 1
    if (n < 1) continue
    for (let i = 0; i < n; i++) {
      const d = addDays(start, i)
      out.set(d, (out.get(d) ?? 0) + r.value / n)
    }
  }
  return [...out.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date))
}

/** One daily series per source, worked out the way each source gives its numbers. */
export function dailyBySource(rows: Row[]): Map<Source, Day[]> {
  const out = new Map<Source, Day[]>()
  const sources = [...new Set(rows.map((r) => r.source))]
  for (const s of sources) {
    const mine = rows.filter((r) => r.source === s)
    const cumulative = mine.filter((r) => r.isCumulative)
    const periodic = mine.filter((r) => !r.isCumulative)
    const days = [...dailyFromCumulative(cumulative).daily, ...dailyFromPeriods(periodic)]
    out.set(s, days)
  }
  return out
}

/** Typed-in numbers win over a provider's for the same day (build proposal 7.4). */
export function mergeDaily(bySource: Map<Source, Day[]>): { daily: Day[]; sources: Source[] } {
  const order = [...bySource.keys()].sort((a, b) => rank(a) - rank(b))
  const pick = new Map<string, { value: number; source: Source }>()
  for (const s of order)
    for (const d of bySource.get(s)!) if (!pick.has(d.date)) pick.set(d.date, { value: d.value, source: s })
  const daily = [...pick.entries()]
    .map(([date, v]) => ({ date, value: v.value }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return { daily, sources: [...new Set([...pick.values()].map((v) => v.source))] }
}
const rank = (s: Source) => (MANUAL_SOURCES.includes(s) ? 0 : 1)

/** The level on each day (followers, videos using the sound so far), typed-in numbers first. */
export function mergeLevels(rows: Row[]): { points: Day[]; sources: Source[] } {
  const sorted = [...rows].sort((a, b) => rank(a.source) - rank(b.source))
  const pick = new Map<string, { value: number; source: Source }>()
  for (const r of sorted) if (!pick.has(r.date)) pick.set(r.date, { value: r.value, source: r.source })
  const points = [...pick.entries()]
    .map(([date, v]) => ({ date, value: v.value }))
    .sort((a, b) => a.date.localeCompare(b.date))
  return { points, sources: [...new Set([...pick.values()].map((v) => v.source))] }
}

export type BaselineStatus = 'ready' | 'short' | 'unavailable'
export type Baseline = {
  status: BaselineStatus
  from: string
  to: string
  /** Days in the period that have a value. */
  days: number
  /** Average per day; null when no day has a value. */
  average: number | null
}

/** Before launch: the `baselineDays` days up to the day before launch. 7 or more days with data is enough. */
export function baseline(daily: Day[], launch: string, baselineDays: number): Baseline {
  const from = addDays(launch, -baselineDays)
  const to = addDays(launch, -1)
  const inside = daily.filter((d) => d.date >= from && d.date <= to)
  const average = inside.length ? inside.reduce((a, d) => a + d.value, 0) / inside.length : null
  const status: BaselineStatus = inside.length >= 7 ? 'ready' : inside.length > 0 ? 'short' : 'unavailable'
  return { status, from, to, days: inside.length, average }
}

export type SinceLaunch = { from: string; to: string; days: number; average: number | null; total: number | null }

/** From launch to `to` (or the last day with data). */
export function sinceLaunch(daily: Day[], launch: string, to?: string | null): SinceLaunch {
  const inside = daily.filter((d) => d.date >= launch && (!to || d.date <= to))
  const total = inside.length ? inside.reduce((a, d) => a + d.value, 0) : null
  return {
    from: launch,
    to: inside.length ? inside[inside.length - 1]!.date : (to ?? launch),
    days: inside.length,
    average: total === null ? null : total / inside.length,
    total,
  }
}

export type FlowSummary = {
  baseline: Baseline
  since: SinceLaunch
  /** Average per day since launch compared with before, as a whole percent. Null without a usable "before". */
  changePercent: number | null
  /** Per day: actual minus the "before" average, added up. Negative allowed. Null without a usable "before". */
  extraTotal: number | null
}

export function flowSummary(daily: Day[], launch: string, baselineDays: number, to?: string | null): FlowSummary {
  const b = baseline(daily, launch, baselineDays)
  const s = sinceLaunch(daily, launch, to)
  const usable = b.status === 'ready' && b.average !== null && b.average > 0 && s.average !== null
  return {
    baseline: b,
    since: s,
    changePercent: usable ? Math.round((s.average! / b.average! - 1) * 100) : null,
    extraTotal: usable ? Math.round(s.total! - b.average! * s.days) : null,
  }
}

export type LevelChange = { before: Day | null; latest: Day | null; change: number | null }

/** The last value before launch against the newest one. */
export function levelChange(points: Day[], launch: string): LevelChange {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const before = [...sorted].reverse().find((p) => p.date < launch) ?? null
  const latest = sorted.length ? sorted[sorted.length - 1]! : null
  return {
    before,
    latest,
    change: before && latest && latest.date >= launch ? latest.value - before.value : null,
  }
}

export type SoundUse = {
  total: Day | null
  /** The count on launch day, or the nearest earlier day. Null when counting started after launch. */
  atLaunch: Day | null
  newSinceLaunch: number | null
  /** Campaign posts the sound check matched. */
  campaignVideos: number
  /** New since launch minus the campaign's matched posts, never below zero. */
  outsideCampaign: number | null
  /** True when some campaign posts were not checked, so "outside" is an estimate ("about"). */
  outsideIsEstimate: boolean
}

export function soundUse(points: Day[], launch: string, sound: { matched: number; unchecked: number }): SoundUse {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const total = sorted.length ? sorted[sorted.length - 1]! : null
  const atLaunch = [...sorted].reverse().find((p) => p.date <= launch) ?? null
  const newSince = total && atLaunch && total.date > atLaunch.date ? total.value - atLaunch.value : null
  return {
    total,
    atLaunch,
    newSinceLaunch: newSince,
    campaignVideos: sound.matched,
    outsideCampaign: newSince === null ? null : Math.max(0, newSince - sound.matched),
    outsideIsEstimate: sound.unchecked > 0,
  }
}

export type ChartRow = {
  date: string
  chartPlatform: string
  chartName: string
  country: string | null
  city: string | null
  position: number
  source: string
}
export type ChartRun = {
  chartPlatform: string
  chartName: string
  country: string | null
  city: string | null
  bestPosition: number
  firstDate: string
  source: string
}

/** Each chart once: its best place and first day. "Already charting" when it was on the chart before launch. */
export function chartRuns(rows: ChartRow[], launch: string): { sinceLaunch: ChartRun[]; beforeLaunch: ChartRun[] } {
  const key = (r: ChartRow) => [r.chartPlatform, r.chartName, r.country ?? '', r.city ?? ''].join('|')
  const runs = new Map<string, ChartRun>()
  for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = key(r)
    const cur = runs.get(k)
    if (!cur)
      runs.set(k, {
        chartPlatform: r.chartPlatform,
        chartName: r.chartName,
        country: r.country,
        city: r.city,
        bestPosition: r.position,
        firstDate: r.date,
        source: r.source,
      })
    else cur.bestPosition = Math.min(cur.bestPosition, r.position)
  }
  const all = [...runs.values()].sort((a, b) => a.bestPosition - b.bestPosition)
  return {
    sinceLaunch: all.filter((r) => r.firstDate >= launch),
    beforeLaunch: all.filter((r) => r.firstDate < launch),
  }
}
