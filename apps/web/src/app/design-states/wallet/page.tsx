import { notFound } from 'next/navigation'
import { readThemeCookie } from '@/designed/themes'
import { WalletView } from '@/designed/wallet-view'
import { SAMPLE_NOW, SAMPLE_WALLET } from '@/designed/wallet-sample'

// Renders the wallet in each state the mockup shows, from the mockup's sample numbers run through the
// real wallet model, so the visual tests can compare it with the locked screenshots. The real page
// is covered by end to end tests. Never available in production unless DESIGN_STATES=1 (CI only).
export const dynamic = 'force-dynamic'

const STATES = ['data', 'withdrawals', 'empty', 'loading', 'error', 'done'] as const

export default async function WalletStates({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; theme?: string }>
}) {
  if (process.env.NODE_ENV === 'production' && process.env.DESIGN_STATES !== '1') notFound()
  const { state, theme } = await searchParams
  if (!STATES.includes(state as (typeof STATES)[number])) notFound()
  return (
    <WalletView
      state={state === 'loading' ? 'loading' : state === 'error' ? 'error' : 'data'}
      data={state === 'empty' ? { ...SAMPLE_WALLET, posts: [] } : SAMPLE_WALLET}
      now={SAMPLE_NOW.toISOString()}
      tab={state === 'withdrawals' ? 'wd' : 'tx'}
      done={state === 'done'}
      theme={readThemeCookie(theme)}
    />
  )
}
