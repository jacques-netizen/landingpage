'use client'

import { BrowseView } from '@/designed/browse-view'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'

// Last resort if the whole screen fails to render. Data failures are handled inside the page.
export default function CampaignsError({ reset }: { error: Error; reset: () => void }) {
  const cookie =
    typeof document === 'undefined' ? undefined : document.cookie.match(new RegExp(`${THEME_COOKIE}=(\\w+)`))?.[1]
  return (
    <BrowseView
      state="error"
      cards={[]}
      featured={null}
      theme={readThemeCookie(cookie)}
      account={{ label: 'Sign in', href: '/sign-in?next=/campaigns' }}
      onRetry={reset}
    />
  )
}
