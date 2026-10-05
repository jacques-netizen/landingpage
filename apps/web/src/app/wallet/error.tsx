'use client'

import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { WalletView } from '@/designed/wallet-view'

// The mockup's error state, with the retry it shows.
export default function WalletError({ reset }: { error: Error; reset: () => void }) {
  const cookie =
    typeof document === 'undefined' ? undefined : document.cookie.match(new RegExp(`${THEME_COOKIE}=(\\w+)`))?.[1]
  return <WalletView state="error" data={null} theme={readThemeCookie(cookie)} onRetry={reset} />
}
