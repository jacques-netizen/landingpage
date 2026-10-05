import { EmptyState } from '@mde/ui'
import { cookies } from 'next/headers'
import { AppFrame } from '@/components/app-frame'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'

export default async function CampaignNotFound() {
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <AppFrame theme={theme} active="campaigns">
      <div className="rounded-[24px] border border-solid border-[var(--t-glass-line)] bg-[var(--t-glass-bg)]">
        <EmptyState
          tone="app"
          title="This campaign is not available."
          body="It may have been taken down, or the link is not right."
          action={
            <a
              href="/campaigns"
              className="flex h-10 items-center rounded-[14px] bg-gold-soft px-5 text-[13px] font-bold text-ink no-underline hover:text-ink"
            >
              Browse campaigns
            </a>
          }
        />
      </div>
    </AppFrame>
  )
}
