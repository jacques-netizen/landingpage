import { notFound } from 'next/navigation'
import { BrowseView } from '@/designed/browse-view'
import { readThemeCookie } from '@/designed/themes'
import { loadFeatured } from '@/server/browse'

// Renders the campaigns screen's loading and error states on demand, exactly as the page and its
// loading screen render them, so the visual tests can compare them with the locked screenshots.
// Never available in production unless DESIGN_STATES=1 (CI only).
export const dynamic = 'force-dynamic'

export default async function BrowseStates({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; theme?: string }>
}) {
  if (process.env.NODE_ENV === 'production' && process.env.DESIGN_STATES !== '1') notFound()
  const { state, theme } = await searchParams
  if (state !== 'loading' && state !== 'error') notFound()
  const { featured, overrides } = await loadFeatured()
  return (
    <BrowseView
      state={state}
      cards={[]}
      featured={featured}
      overrides={overrides}
      theme={readThemeCookie(theme)}
      account={{ label: 'Sign in', href: '/sign-in?next=/campaigns' }}
    />
  )
}
