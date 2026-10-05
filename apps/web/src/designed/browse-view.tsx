'use client'

import { formatDollars } from '@mde/money/dollars'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { BrowseDesign } from './browse'
import { browseContent } from './browse.content'
import { DesignedFrame } from './frame'
import { makeCopy } from './runtime'
import { saveThemeCookie, themeSwitch, THEMES, type ThemeName } from './themes'

export type BrowseCard = {
  id: string
  title: string
  label: 'Clipping' | 'Music' | 'Logo' | 'UGC'
  leftCents: number
  rateCents: number
  paidPercent: number
  platforms: string[]
  img: string | null
}

export type BrowseFeatured = { id: string; title: string; body: string; tag1: string; tag2: string; leftCents: number }

type Props = {
  state: 'data' | 'loading' | 'error'
  cards: BrowseCard[]
  featured: BrowseFeatured | null
  theme: ThemeName
  account: { label: string; href: string }
  overrides?: Record<string, string>
  onRetry?: () => void
}

const LABELS = ['All', 'Clipping', 'Music', 'Logo', 'UGC']
const PLATFORMS = ['All', 'TikTok', 'Instagram', 'YouTube']

// The campaigns screen ("Creator Site v1", screen browse). Values are built exactly as the mockup's
// script builds them, from real campaigns instead of samples.
export function BrowseView({ state, cards, featured, theme: initialTheme, account, overrides = {}, onRetry }: Props) {
  const router = useRouter()
  const [th, setTh] = useState<ThemeName>(initialTheme)
  const [bl, setBl] = useState('All')
  const [bp, setBp] = useState('All')
  const [search, setSearch] = useState('')
  const T = THEMES[th]

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cards.filter(
      (c) =>
        (bl === 'All' || c.label === bl) &&
        (bp === 'All' || c.platforms.includes(bp)) &&
        (!q || [c.title, c.label, ...c.platforms].some((s) => s.toLowerCase().includes(q))),
    )
  }, [cards, bl, bp, search])

  const filt = (list: string[], cur: string, set: (v: string) => void) =>
    list.map((n) => ({
      label: n,
      go: () => set(n),
      bg: cur === n ? 'rgba(216,197,143,0.2)' : 'transparent',
      fg: cur === n ? T.accentInk : T.muted,
      dot: cur === n ? '#D8C58F' : T.hair2,
    }))

  const v = {
    T,
    goHome: () => router.push('/'),
    sideNav: [
      ['Home', '/'],
      ['Campaigns', '/campaigns'],
      ['Wallet', '/wallet'],
    ].map(([label, href]) => ({
      label,
      go: () => router.push(href!),
      bg: href === '/campaigns' ? 'rgba(216,197,143,0.2)' : 'transparent',
      fg: href === '/campaigns' ? T.accentInk : T.muted,
    })),
    labelFilters: filt(LABELS, bl, setBl),
    platFilters: filt(PLATFORMS, bp, setBp),
    // The mockup's Data / Loading / Error switch is preview tooling: rendered invisible to keep the layout.
    bstates: [
      ['data', 'Data'],
      ['loading', 'Loading'],
      ['error', 'Error'],
    ].map(([k, label]) => ({
      label,
      go: () => {},
      bg: k === 'data' ? '#D8C58F' : 'transparent',
      fg: k === 'data' ? '#1A1510' : T.muted,
    })),
    themes: themeSwitch(th, (t) => {
      setTh(t)
      saveThemeCookie(t)
    }),
    search,
    onSearch: (e: { target: { value: string } }) => setSearch(e.target.value),
    account: { label: account.label, go: () => router.push(account.href) },
    featured: featured
      ? {
          title: featured.title,
          body: featured.body,
          tag1: featured.tag1,
          tag2: featured.tag2,
          leftLabel: `${formatDollars(featured.leftCents)} left`,
          go: () => router.push(`/campaigns/${featured.id}`),
        }
      : null,
    // Unknown while loading or after an error, so no count is shown rather than a wrong one.
    countLabel: state === 'data' ? shown.length + (shown.length === 1 ? ' campaign' : ' campaigns') : '',
    skel: [1, 2, 3, 4],
    bLoading: state === 'loading',
    bError: state === 'error',
    bEmpty: state === 'data' && shown.length === 0,
    bRows: state === 'data' && shown.length > 0,
    bRetry: () => (onRetry ? onRetry() : router.refresh()),
    clearFilters: () => {
      setBl('All')
      setBp('All')
      setSearch('')
    },
    bcards: shown.map((c) => ({
      title: c.title,
      label: c.label,
      left: formatDollars(c.leftCents),
      rate: formatDollars(c.rateCents),
      pct: `${c.paidPercent}%`,
      plats: c.platforms,
      img: c.img,
      go: () => router.push(`/campaigns/${c.id}`),
    })),
  }

  return (
    <DesignedFrame>
      <BrowseDesign v={v} copy={makeCopy(browseContent, overrides)} />
    </DesignedFrame>
  )
}
