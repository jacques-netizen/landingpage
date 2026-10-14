import { formatDollars } from '@mde/money/dollars'
import { DEMOS } from '@/demo'
import { demoStatus } from '@/server/demo-import'
import { requireStaff } from '@/server/guard'
import { AdminPage } from '../_components/ui'
import { DemoBuilder } from './demo-builder'

export const dynamic = 'force-dynamic'

const n = (v: number) => v.toLocaleString('en-US')
const date = (iso: string) => new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })
const NAMES: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', x: 'X', youtube: 'YouTube' }

// Demo campaigns for showcase videos (owner request, 2026-10-14): real public clips in a campaign that
// never ran. Hidden from creators, skipped by every job, left out of the leaderboard.
export default async function DemoPage() {
  await requireStaff('admin', '/admin/demo')
  const rows = await Promise.all(DEMOS.map(async (spec) => ({ spec, status: await demoStatus(spec) })))
  return (
    <AdminPage
      title="Demo campaigns"
      lead="Showcase campaigns built from public clips. Creators never see them and no job ever checks them. Their money is play money, labelled demo in the ledger."
    >
      <div className="flex flex-col gap-5">
        {rows.map(({ spec, status }) => (
          <section key={spec.slug} className="rounded-[14px] border border-solid border-line bg-panel p-5 text-[13px]">
            <h2 className="m-0 font-app text-[16px] font-semibold">{spec.title}</h2>
            <p className="mt-1 mb-4 text-muted-2">
              {date(spec.startAt)} to {date(spec.endAt)}. Budget {formatDollars(spec.budgetCents)} at{' '}
              {formatDollars(spec.rateCentsPer1000)} per 1,000 views
              {spec.capPerPostCents ? `, ${formatDollars(spec.capPerPostCents)} cap per post` : ''}.
            </p>
            {status ? (
              <p className="mt-0 mb-4">
                Built: {n(status.posts)} clips, {n(status.views)} views, {formatDollars(status.earnedCents)} spent (
                {Object.entries(status.byPlatform)
                  .map(([p, v]) => `${NAMES[p] ?? p} ${n(v.posts)}`)
                  .join(', ')}
                ).{' '}
                <a href={`/admin/campaigns/${status.id}`} className="text-ink">
                  Open the campaign
                </a>{' '}
                to create the client report link.
              </p>
            ) : null}
            <DemoBuilder
              slug={spec.slug}
              title={spec.title}
              exists={!!status}
              queries={spec.search.queries}
              pages={spec.search.pages}
              creditCap={spec.search.creditCap}
              youtubeClips={spec.clips.length}
            />
          </section>
        ))}
      </div>
    </AdminPage>
  )
}
