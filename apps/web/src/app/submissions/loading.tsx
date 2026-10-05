import { LoadingRows, Skeleton } from '@mde/ui'
import { cookies } from 'next/headers'
import { AppFrame } from '@/components/app-frame'
import { panel } from '@/components/app-ui'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'

export default async function SubmissionsLoading() {
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <AppFrame theme={theme} active="submissions" signedIn>
      <div role="status" aria-label="Loading submissions" className="px-2 pt-2">
        <Skeleton tone="app" className="mb-6 h-12 w-[240px]" />
        <div className={`${panel} p-6`}>
          <LoadingRows tone="app" rows={5} />
        </div>
      </div>
    </AppFrame>
  )
}
