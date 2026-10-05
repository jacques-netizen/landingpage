// Everything the wallet screen shows, worked out from a creator's data. Pure, so it is tested alone and
// the same function serves the real page and the visual tests' fixture. Money is whole cents.

export type WalletPost = {
  id: string
  title: string
  platform: string
  state: string
  countedViews: number
  earnedCents: number
  submittedAt: Date
}

export type WalletBar = { cents: number; kind: 'available' | 'pending' | 'held' }

export type WalletData = {
  availableCents: number
  pendingCents: number
  paidCents: number
  /** All counted views and all earnings, for the effective rate per 1,000 views. */
  countedViewsAll: number
  earnedCentsAll: number
  bestCentsAll: number
  /** Counted views on approved posts, ever: what the rating is based on. */
  lifetimeCountedViews: number
  payout: { method: 'bank_transfer' | 'paypal'; last4: string | null } | null
  /** Recent posts, newest first. */
  posts: WalletPost[]
  /** Days (UTC, YYYY-MM-DD) with at least one post that passed the automatic checks. */
  postDays: string[]
  /** The last 12 days of earnings, oldest first. */
  bars: WalletBar[]
}

export type Period = 'month' | 'last' | 'all'
export const PERIOD_LABEL: Record<Period, string> = { month: 'This month', last: 'Last month', all: 'All time' }
export const NEXT_PERIOD: Record<Period, Period> = { month: 'last', last: 'all', all: 'month' }

export const fmt = (c: number) => '$' + Math.floor(c / 100).toLocaleString('en-US') + '.' + String(c % 100).padStart(2, '0')
const count = (n: number) => n.toLocaleString('en-US')

// Rating tiers by lifetime counted views. Each tier has two levels: I, then II from halfway.
export const TIERS = [
  { name: 'Bronze', from: 0 },
  { name: 'Silver', from: 10_000 },
  { name: 'Gold', from: 100_000 },
  { name: 'Platinum', from: 500_000 },
  { name: 'Diamond', from: 2_000_000 },
] as const

export function rating(views: number) {
  let i = 0
  while (i + 1 < TIERS.length && views >= TIERS[i + 1]!.from) i++
  const tier = TIERS[i]!
  const next = TIERS[i + 1]
  if (!next) return { label: `${tier.name.toUpperCase()} II`, progress: 'Top tier' }
  // Whole percent through the tier, rounded down, so 100% is never shown before the next tier.
  const pct = Math.floor(((views - tier.from) * 100) / (next.from - tier.from))
  return { label: `${tier.name.toUpperCase()} ${pct >= 50 ? 'II' : 'I'}`, progress: `${pct}% to ${next.name}` }
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

/** Consecutive days with a post, ending today, or yesterday when today has none yet. */
export function streakDays(postDays: string[], now: Date) {
  const days = new Set(postDays)
  let d = days.has(dayKey(now)) ? now : addDays(now, -1)
  let n = 0
  while (days.has(dayKey(d))) {
    n++
    d = addDays(d, -1)
  }
  return n
}

/** Monday to Sunday of the current week (UTC): true where the creator posted. */
export function weekPosted(postDays: string[], now: Date) {
  const days = new Set(postDays)
  const monday = addDays(now, -((now.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => days.has(dayKey(addDays(monday, i))))
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC']
export function dayLabel(d: Date, now: Date) {
  return dayKey(d) === dayKey(now) ? 'TODAY' : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

const APPROVED = ['approved', 'earning', 'final', 'paid_out']
const DECIDED = [...APPROVED, 'flagged', 'rejected', 'removed']
const SHOWN = [...APPROVED, 'flagged']
const PLATFORM_SHORT: Record<string, string> = { tiktok: 'TT', instagram: 'IG', youtube: 'YT', x: 'X' }

export function inPeriod(d: Date, period: Period, now: Date) {
  if (period === 'all') return true
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const start = period === 'month' ? Date.UTC(y, m, 1) : Date.UTC(y, m - 1, 1)
  const end = period === 'month' ? Date.UTC(y, m + 1, 1) : Date.UTC(y, m, 1)
  return d.getTime() >= start && d.getTime() < end
}

export const WEEKLY_POST_GOAL = 5
const RING = 276.5 // 2 x pi x 44, the ring's circumference in the mockup

export function walletModel(data: WalletData, opts: { now: Date; period: Period; colours: { soft: string; hair2: string } }) {
  const { now, period, colours } = opts
  const row = (p: WalletPost) => {
    const status = p.state === 'paid_out' ? 'Available' : p.state === 'flagged' ? 'Flagged' : 'Pending'
    return {
      name: p.title,
      pf: PLATFORM_SHORT[p.platform] ?? p.platform.slice(0, 2).toUpperCase(),
      meta: `${count(p.countedViews)} views`,
      status,
      dot: { Available: '#4FB286', Flagged: '#E26B5E', Pending: '#E0A94A' }[status],
      amt: (status === 'Flagged' ? 'Held ' : '+') + fmt(p.earnedCents),
    }
  }
  // Last posts: the newest day's posts, then the next day that has posts, six rows at most.
  const shown = data.posts.filter((p) => SHOWN.includes(p.state))
  const dayA = shown[0] ? dayKey(shown[0].submittedAt) : null
  const rowsA = shown.filter((p) => dayKey(p.submittedAt) === dayA).slice(0, 6)
  const rest = shown.filter((p) => dayKey(p.submittedAt) !== dayA)
  const dayB = rest[0] ? dayKey(rest[0].submittedAt) : null
  const rowsB = rest.filter((p) => dayKey(p.submittedAt) === dayB).slice(0, 6 - rowsA.length)

  const inP = data.posts.filter((p) => p.state !== 'rejected_auto' && inPeriod(p.submittedAt, period, now))
  const approved = inP.filter((p) => APPROVED.includes(p.state)).length
  const flagged = inP.filter((p) => p.state === 'flagged').length
  const decided = inP.filter((p) => DECIDED.includes(p.state)).length
  const views = inP.filter((p) => SHOWN.includes(p.state)).reduce((s, p) => s + p.countedViews, 0)
  const streak = streakDays(data.postDays, now)
  const r = rating(data.lifetimeCountedViews)
  const maxBar = Math.max(1, ...data.bars.map((b) => b.cents))

  return {
    availableFmt: fmt(data.availableCents),
    availWhole: '$' + Math.floor(data.availableCents / 100).toLocaleString('en-US'),
    availCents: '.' + String(data.availableCents % 100).padStart(2, '0'),
    pendingFmt: fmt(data.pendingCents),
    paidFmt: fmt(data.paidCents),
    // What the creator has earned per 1,000 counted views, rounded down.
    rateFmt: fmt(data.countedViewsAll ? Math.floor((data.earnedCentsAll * 1000) / data.countedViewsAll) : 0),
    bestFmt: fmt(data.bestCentsAll),
    payoutLabel: data.payout
      ? `${data.payout.method === 'paypal' ? 'PayPal' : 'Bank transfer'}${data.payout.last4 ? `, ending ${data.payout.last4}` : ''}`
      : 'No payout method yet',
    streakLabel: `${streak} ${streak === 1 ? 'day' : 'days'}, goal ${WEEKLY_POST_GOAL} posts`,
    streakDays: weekPosted(data.postDays, now).map((on) => (on ? '#D8C58F' : colours.soft)),
    hasRows: shown.length > 0,
    groupA: rowsA[0] ? dayLabel(rowsA[0].submittedAt, now) : '',
    groupB: rowsB[0] ? dayLabel(rowsB[0].submittedAt, now) : '',
    rowsA: rowsA.map(row),
    rowsB: rowsB.map(row),
    periodLabel: PERIOD_LABEL[period],
    approvedPct: `${decided ? Math.round((approved * 100) / decided) : 0}%`,
    ringDash: `${decided ? Math.round((approved * RING) / decided) : 0} ${RING}`,
    approvedLabel: `${approved} APPROVED`,
    flaggedLabel: `${flagged} FLAGGED`,
    viewsFmt: count(views),
    postsCount: String(inP.length),
    tierLabel: r.label,
    tierProgress: r.progress,
    // Heights against the biggest day, 70% at most as in the mockup.
    bars: data.bars.map((b) => ({
      h: `${Math.round((b.cents * 70) / maxBar)}%`,
      bg: b.kind === 'available' ? '#4FB286' : b.kind === 'pending' ? '#E0A94A' : colours.hair2,
    })),
  }
}
