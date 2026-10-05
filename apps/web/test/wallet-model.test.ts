import { describe, expect, it } from 'vitest'
import {
  dayLabel,
  inPeriod,
  rating,
  streakDays,
  walletModel,
  weekPosted,
  type WalletData,
} from '../src/designed/wallet-model'
import { SAMPLE_NOW, SAMPLE_WALLET } from '../src/designed/wallet-sample'

const colours = { soft: 'S', hair2: 'H' }

describe('wallet model', () => {
  it('reproduces every number in the wallet mockup from the sample data', () => {
    const m = walletModel(SAMPLE_WALLET, { now: SAMPLE_NOW, period: 'month', colours })
    expect(m).toMatchObject({
      availableFmt: '$184.20',
      availWhole: '$184',
      availCents: '.20',
      pendingFmt: '$62.40',
      paidFmt: '$0.00',
      rateFmt: '$2.00',
      bestFmt: '$120.00',
      payoutLabel: 'Bank transfer, ending 0000',
      streakLabel: '4 days, goal 5 posts',
      streakDays: ['#D8C58F', '#D8C58F', '#D8C58F', '#D8C58F', 'S', 'S', 'S'],
      groupA: 'TODAY',
      groupB: '27 SEPT',
      periodLabel: 'This month',
      approvedPct: '83%',
      ringDash: '230 276.5',
      approvedLabel: '5 APPROVED',
      flaggedLabel: '1 FLAGGED',
      viewsFmt: '158,200',
      postsCount: '6',
      tierLabel: 'GOLD II',
      tierProgress: '68% to Platinum',
    })
    expect(m.rowsA.map((r) => [r.name, r.pf, r.meta, r.amt, r.status])).toEqual([
      ['Sample clip 01', 'TT', '31,200 views', '+$62.40', 'Pending'],
      ['Sample clip 02', 'IG', '60,000 views', '+$120.00', 'Available'],
      ['Sample clip 03', 'TT', '28,100 views', '+$56.20', 'Available'],
    ])
    expect(m.rowsB[0]).toMatchObject({ pf: 'YT', amt: 'Held $8.00', status: 'Flagged', dot: '#E26B5E' })
    expect(m.bars.map((b) => b.h)).toEqual([
      '30%',
      '44%',
      '36%',
      '52%',
      '40%',
      '60%',
      '48%',
      '70%',
      '54%',
      '40%',
      '30%',
      '24%',
    ])
  })

  it('rates tiers by lifetime counted views, two levels each', () => {
    expect(rating(0)).toEqual({ label: 'BRONZE I', progress: '0% to Silver' })
    expect(rating(5_000)).toEqual({ label: 'BRONZE II', progress: '50% to Silver' })
    expect(rating(99_999).label).toBe('SILVER II')
    expect(rating(100_000)).toEqual({ label: 'GOLD I', progress: '0% to Platinum' })
    expect(rating(2_000_000)).toEqual({ label: 'DIAMOND II', progress: 'Top tier' })
  })

  it("counts a streak back from today, or from yesterday before today's post", () => {
    const now = new Date('2026-10-08T09:00:00Z')
    expect(streakDays(['2026-10-06', '2026-10-07', '2026-10-08'], now)).toBe(3)
    expect(streakDays(['2026-10-06', '2026-10-07'], now)).toBe(2)
    expect(streakDays(['2026-10-05', '2026-10-07'], now)).toBe(1)
    expect(streakDays([], now)).toBe(0)
    // Thursday 8 October 2026: Monday to Sunday of that week.
    expect(weekPosted(['2026-10-05', '2026-10-08', '2026-10-12'], now)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
      false,
    ])
  })

  it('labels days and periods in UTC', () => {
    const now = new Date('2026-10-08T09:00:00Z')
    expect(dayLabel(new Date('2026-10-08T23:00:00Z'), now)).toBe('TODAY')
    expect(dayLabel(new Date('2026-09-27T10:00:00Z'), now)).toBe('27 SEPT')
    expect(inPeriod(new Date('2026-10-01T00:00:00Z'), 'month', now)).toBe(true)
    expect(inPeriod(new Date('2026-09-30T23:59:59Z'), 'month', now)).toBe(false)
    expect(inPeriod(new Date('2026-09-30T23:59:59Z'), 'last', now)).toBe(true)
  })

  it('shows zeros and an empty state for a new creator', () => {
    const empty: WalletData = {
      ...SAMPLE_WALLET,
      availableCents: 0,
      pendingCents: 0,
      countedViewsAll: 0,
      earnedCentsAll: 0,
      bestCentsAll: 0,
      lifetimeCountedViews: 0,
      payout: null,
      posts: [],
      postDays: [],
      bars: [],
    }
    const m = walletModel(empty, { now: SAMPLE_NOW, period: 'month', colours })
    expect(m).toMatchObject({
      hasRows: false,
      rateFmt: '$0.00',
      approvedPct: '0%',
      ringDash: '0 276.5',
      payoutLabel: 'No payout method yet',
      streakLabel: '0 days, goal 5 posts',
    })
  })
})
