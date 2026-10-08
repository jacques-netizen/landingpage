'use client'


import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppFrame } from '@/components/app-frame'
import { PayoutMethodDialog } from './payout-method-dialog'
import { WithdrawDialog } from './withdraw-dialog'
import type { WithdrawalFeeSettings } from '@mde/money/quote'
import { makeCopy } from './runtime'
import { saveThemeCookie, themeSwitch, THEMES, type ThemeName } from './themes'
import { WalletDesign } from './wallet'
import { walletContent } from './wallet.content'
import { NEXT_PERIOD, walletModel, type Period, type WalletData } from './wallet-model'

type Props = {
  state: 'data' | 'loading' | 'error'
  data: WalletData | null
  theme: ThemeName
  /** The clock the model reads. Visual tests pass a fixed one. */
  now?: string
  tab?: 'tx' | 'wd'
  /** Show the "Withdrawal requested" banner (the mockup's withdraw-done state). */
  done?: boolean
  overrides?: Record<string, string>
  onRetry?: () => void
  /** Withdrawal fee settings, for the fee shown before confirming. */
  fees?: WithdrawalFeeSettings
}

const NO_FEES: WithdrawalFeeSettings = { withdrawal_fee_bps: 0, withdrawal_fee_min_cents: 0, withdrawal_min_cents: 2000 }

const EMPTY: WalletData = {
  availableCents: 0,
  pendingCents: 0,
  paidCents: 0,
  countedViewsAll: 0,
  earnedCentsAll: 0,
  bestCentsAll: 0,
  lifetimeCountedViews: 0,
  payout: null,
  posts: [],
  postDays: [],
  bars: [],
}

// The wallet ("Creator Site v1", screen wallet). Values are built as the mockup's script builds them,
// from the creator's real balances and posts (wallet-model.ts).
export function WalletView({
  state,
  data,
  theme: initialTheme,
  now,
  tab = 'tx',
  done = false,
  overrides = {},
  onRetry,
  fees = NO_FEES,
}: Props) {
  const router = useRouter()
  const [th, setTh] = useState<ThemeName>(initialTheme)
  const [wt, setWt] = useState<'tx' | 'wd'>(tab)
  const [period, setPeriod] = useState<Period>('month')
  const [banner, setBanner] = useState(done)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [addMethod, setAddMethod] = useState(false)
  const hasMethod = !!data?.payout
  const T = THEMES[th]
  const dk = th === 'dark'
  const m = walletModel(data ?? EMPTY, { now: now ? new Date(now) : new Date(), period, colours: T })
  // Without data (the loading screen) figures are unknown: blank rather than wrong.
  const known = !!data
  const blank = (s: string) => (known ? s : '')

  // Overview lists posts; Withdrawals lists withdrawals in the same rows.
  const onWd = wt === 'wd'
  const hasRows = state === 'data' && (onWd ? m.withdrawalRows.length > 0 : m.hasRows)
  const emptyView = state === 'data' && !hasRows

  const v = {
    T,
    wz: 'var(--mde-app-zoom)',
    goHome: () => router.push('/'),
    navLinks: [
      ['Campaigns', '/campaigns'],
      ['Wallet', '/wallet'],
    ].map(([label, href]) => ({ label, go: () => router.push(href!) })),
    themes: themeSwitch(th, (t) => {
      setTh(t)
      saveThemeCookie(t)
    }),
    wtabs: (
      [
        ['tx', 'Overview'],
        ['wd', 'Withdrawals'],
      ] as const
    ).map(([k, label]) => ({
      label,
      go: () => setWt(k),
      bg: wt === k ? T.soft : 'transparent',
      fg: wt === k ? T.text : T.muted,
    })),
    // The mockup's Data / Loading / Empty / Error switch is preview tooling, rendered invisible.
    states: [
      ['data', 'Data'],
      ['loading', 'Loading'],
      ['empty', 'Empty'],
      ['error', 'Error'],
    ].map(([k, label]) => ({ label, go: () => {}, bg: k === 'data' ? '#D8C58F' : 'transparent', fg: k === 'data' ? '#1A1510' : T.muted })),
    done: banner,
    closeDone: () => setBanner(false),
    // Withdraw needs a payout method first (testing report item 5).
    withdraw: () => (!data || hasMethod ? setWithdrawOpen(true) : setAddMethod(true)),
    changeMethod: () => setAddMethod(true),
    cyclePeriod: () => setPeriod((p) => NEXT_PERIOD[p]),
    retry: () => (onRetry ? onRetry() : router.refresh()),
    toBrowse: () => router.push('/campaigns'),
    skel: [1, 2, 3, 4],
    wLoading: state === 'loading',
    notLoading: state !== 'loading',
    wError: state === 'error',
    wEmptyView: emptyView,
    wRows: hasRows,
    emptyTitle: wt === 'wd' ? 'No withdrawals yet.' : 'No earnings yet.',
    emptyBody: wt === 'wd' ? 'Withdrawals you request will be listed here.' : 'Join a campaign and post to start earning.',
    availableFmt: blank(m.availableFmt),
    availWhole: m.availWhole,
    availCents: m.availCents,
    pendingFmt: blank(m.pendingFmt),
    paidFmt: blank(m.paidFmt),
    rateFmt: blank(m.rateFmt),
    bestFmt: blank(m.bestFmt),
    payoutLabel: blank(m.payoutLabel),
    streakLabel: blank(m.streakLabel),
    streakDays: m.streakDays,
    groupA: onWd ? 'WITHDRAWALS' : m.groupA,
    groupB: onWd ? '' : m.groupB,
    rowsA: onWd ? m.withdrawalRows : m.rowsA,
    rowsB: onWd ? [] : m.rowsB,
    periodLabel: m.periodLabel,
    approvedPct: blank(m.approvedPct),
    ringDash: m.ringDash,
    approvedLabel: blank(m.approvedLabel),
    flaggedLabel: blank(m.flaggedLabel),
    viewsFmt: blank(m.viewsFmt),
    postsCount: blank(m.postsCount),
    tierLabel: blank(m.tierLabel),
    tierProgress: blank(m.tierProgress),
    bars: m.bars,
  }

  // The wallet sits in the same frame and menu as the campaigns screen (owner request, 2026-10-07):
  // the mockup's own header, icon column and outer card are hidden by designed.css (.mde-wallet-in-app).
  return (
    <AppFrame theme={th} active="wallet" signedIn>
      <div className="mde-wallet-in-app">
        <WalletDesign
          v={v}
          // The Withdraw button's words (copy slot wallet.007) read "Add payout method" until one is saved.
          copy={makeCopy(walletContent, !data || hasMethod ? overrides : { ...overrides, 'wallet.007': 'Add payout method' })}
        />
      </div>
      {data ? (
        <WithdrawDialog
          theme={dk ? 'dark' : 'glass'}
          open={withdrawOpen}
          onOpenChange={setWithdrawOpen}
          availableCents={data.availableCents}
          fees={fees}
          to={data.payout?.label ?? ''}
          onDone={() => {
            setWithdrawOpen(false)
            setBanner(true)
            setWt('wd')
            router.refresh()
          }}
        />
      ) : null}
      <PayoutMethodDialog
        theme={dk ? 'dark' : 'glass'}
        open={addMethod}
        onOpenChange={setAddMethod}
        onSaved={() => {
          setAddMethod(false)
          router.refresh()
        }}
      />
    </AppFrame>
  )
}
