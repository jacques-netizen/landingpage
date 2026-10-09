'use client'

import { formatDollars } from '@mde/money/dollars'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { AppMenu } from '@/components/app-menu'
import { PastCampaigns } from './past-campaigns'
import { BrowseDesign } from './browse'
import { browseContent } from './browse.content'
import { DesignedFrame } from './frame'
import { makeCopy } from './runtime'
import { saveThemeCookie, themeSwitch, THEMES, type ThemeName } from './themes'

export type BrowseCard = {
  id: string
  title: string
  label: string
  leftCents: number
  rateCents: number
  paidPercent: number
  /** Ended campaigns show what was paid out of the budget, "$2,000.00/$2,000.00". */
  paidCents?: number
  budgetCents?: number
  platforms: string[]
  img: string | null
}

export type BrowseFeatured = {
  id: string
  title: string
  body: string
  tag1: string
  tag2: string
  leftCents: number
  /** The hero picture: one staff uploaded, or the design's own. */
  img?: string
}

type Props = {
  state: 'data' | 'loading' | 'error'
  cards: BrowseCard[]
  /** Campaigns that have ended, shown under the active ones. */
  pastCards?: BrowseCard[]
  featured: BrowseFeatured | null
  theme: ThemeName
  /** The header's Sign in button; none when signed in, where the menu has Sign out. */
  account: { label: string; href: string } | null
  /** Signed-in creators get their own items in the shared menu. */
  signedIn?: boolean
  overrides?: Record<string, string>
  onRetry?: () => void
}


// The campaigns screen ("Creator Site v1", screen browse). Values are built exactly as the mockup's
// script builds them, from real campaigns instead of samples.
export function BrowseView({
  state,
  cards,
  pastCards = [],
  featured,
  theme: initialTheme,
  account,
  signedIn = false,
  overrides = {},
  onRetry,
}: Props) {
  const router = useRouter()
  const [th, setTh] = useState<ThemeName>(initialTheme)
  const [search, setSearch] = useState('')
  const T = THEMES[th]

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cards.filter(
      (c) =>
        !q || [c.title, c.label, ...c.platforms].some((s) => s.toLowerCase().includes(q)),
    )
  }, [cards, search])

  const v = {
    T,
    goHome: () => router.push('/'),
    // The shared app menu replaces the mockup's sidebar contents (owner request, 2026-10-07).
    menu: (
      <div data-theme={th === 'light' ? 'glass' : 'dark'} style={{ display: 'contents' }}>
        <AppMenu active="campaigns" signedIn={signedIn} />
      </div>
    ),
    // The mockup's Data / Loading / Error switch is preview tooling: rendered invisible to keep the layout.
    bstates: [
      ['data', 'Data'],
      ['loading', 'Loading'],
      ['error', 'Error'],
    ].map(([k, label]) => ({ label, go: () => {}, bg: k === 'data' ? '#D8C58F' : 'transparent', fg: k === 'data' ? '#1A1510' : T.muted })),
    themes: themeSwitch(th, (t) => {
      setTh(t)
      saveThemeCookie(t)
    }),
    search,
    onSearch: (e: { target: { value: string } }) => setSearch(e.target.value),
    account: account ? { label: account.label, go: () => router.push(account.href) } : null,
    featured: featured
      ? {
          title: featured.title,
          body: featured.body,
          tag1: featured.tag1,
          tag2: featured.tag2,
          leftLabel: `${formatDollars(featured.leftCents)} left`,
          img: featured.img || '/designed/camp-hero.png',
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
    clearFilters: () => setSearch(''),
    past:
      state === 'data' && pastCards.length ? (
        <PastCampaigns
          T={T}
          cards={pastCards.map((c) => ({
            title: c.title,
            label: c.label,
            used: `${formatDollars(c.paidCents ?? 0)}/${formatDollars(c.budgetCents ?? 0)}`,
            pct: `${c.paidPercent}%`,
            plats: c.platforms,
            img: c.img ?? '/designed/camp-hero.png',
            go: () => router.push(`/campaigns/${c.id}`),
          }))}
        />
      ) : null,
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
