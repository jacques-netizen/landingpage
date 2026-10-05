'use client'

import { Button, ErrorState } from '@mde/ui'
import { AppFrame } from '@/components/app-frame'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'

export default function MyCampaignsError({ reset }: { error: Error; reset: () => void }) {
  const cookie =
    typeof document === 'undefined' ? undefined : document.cookie.match(new RegExp(`${THEME_COOKIE}=(\\w+)`))?.[1]
  return (
    <AppFrame theme={readThemeCookie(cookie)} active="my-campaigns" signedIn>
      <div className="rounded-[24px] border border-solid border-[var(--t-glass-line)] bg-[var(--t-glass-bg)]">
        <ErrorState
          tone="app"
          title="Could not load your campaigns."
          body="Check your connection and try again."
          action={
            <Button tone="app" size="sm" onClick={reset}>
              Try again
            </Button>
          }
        />
      </div>
    </AppFrame>
  )
}
