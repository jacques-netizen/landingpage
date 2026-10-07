import { db } from '@mde/db'
import { listReasonCodes } from '@mde/submissions'
import { ReviewConsole } from './review-console'
import { requireStaff } from '@/server/guard'
import { reviewQueue } from '@/server/review-queue'
import { approveAction, rejectAction } from './actions'

export const dynamic = 'force-dynamic'

// The review queue with real posts, in the staff console. Filters come from the address:
// ?campaign=<id>, ?platform=tiktok, ?flagged=1 (links from the campaign monitor use them).
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; platform?: string; flagged?: string }>
}) {
  await requireStaff('staff', '/admin/review')
  const { campaign, platform, flagged } = await searchParams
  const [items, reasons] = await Promise.all([
    reviewQueue({
      campaignId: campaign && /^[0-9a-f-]{36}$/i.test(campaign) ? campaign : undefined,
      platform: ['tiktok', 'instagram', 'youtube', 'x'].includes(platform ?? '') ? platform : undefined,
      flaggedOnly: flagged === '1',
    }),
    listReasonCodes(db()),
  ])
  return (
    <ReviewConsole
      state="data"
      items={items}
      reasons={reasons.map((r) => ({ code: r.code, label: r.label }))}
      onApprove={approveAction}
      onReject={rejectAction}
    />
  )
}
