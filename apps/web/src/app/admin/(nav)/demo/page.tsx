import { formatDollars } from '@mde/money/dollars'
import { DEMOS } from '@/demo'
import { demoStatus } from '@/server/demo-import'
import { requireStaff } from '@/server/guard'
import { AdminPage } from '../_components/ui'
import { DemoButton } from './demo-button'

export const dynamic = 'force-dynamic'

const n = (v: number) => v.toLocaleString('en-US')

// Demo campaigns for showcase videos (owner request, 2026-10-14): real public clips in a campaign that
// never ran. Hidden from creators, skipped by the worker, left out of the leaderboard.
export default async function DemoPage() {
  await requireStaff('admin', '/admin/demo')
  const rows = await Promise.all(DEMOS.map(async (spec) => ({ spec, status: await demoStatus(spec) })))
  return (
    <AdminPage
      title="Demo campaigns"
      lead="Showcase campaigns built from public clips. Creators never see them and the worker never checks them. Their money is play money, labelled demo in the ledger."
    >
      <div className="flex flex-col gap-5">
        {rows.map(({ spec, status }) => {
          const views = spec.clips.reduce((a, c) => a + c.views, 0)
          return (
            <section
              key={spec.slug}
              className="rounded-[14px] border border-solid border-line bg-panel p-5 text-[13px]"
            >
              <h2 className="m-0 font-app text-[16px] font-semibold">{spec.title}</h2>
              <p className="mt-1 mb-4 text-muted-2">
                {n(spec.clips.length)} clips, {n(views)} views in the file. Budget {formatDollars(spec.budgetCents)} at{' '}
                {formatDollars(spec.rateCentsPer1000)} per 1,000 views, so{' '}
                {formatDollars(Math.floor((views / 1000) * spec.rateCentsPer1000))} would be earned.
              </p>
              {status ? (
                <p className="m-0">
                  Made: {n(status.posts)} posts, {n(status.views)} counted views, {formatDollars(status.earnedCents)}{' '}
                  earned.{' '}
                  <a href={`/admin/campaigns/${status.id}`} className="text-ink">
                    Open the campaign
                  </a>{' '}
                  to create the client report link.
                </p>
              ) : (
                <DemoButton slug={spec.slug} title={spec.title} />
              )}
            </section>
          )
        })}
      </div>
    </AdminPage>
  )
}
