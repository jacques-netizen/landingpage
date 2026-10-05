import { db } from '@mde/db'
import { listReasonCodes } from '@mde/submissions'
import { EmptyState } from '@mde/ui'
import { requireStaff } from '@/server/guard'
import { AdminPage } from '../_components/ui'
import { ReasonCodeRow } from './reason-code-row'

export const dynamic = 'force-dynamic'

// Settings (01_PRODUCT.md 8.4). Reason codes first (Phase 3); fees, minimums, review window, fraud
// thresholds, templates, terms versions and staff roles join in Phase 5. Admin only.
export default async function SettingsPage() {
  await requireStaff('admin', '/admin/settings')
  const codes = await listReasonCodes(db())
  return (
    <AdminPage title="Settings" lead="Admin only. Every change is written to the audit log.">
      <section aria-labelledby="reason-codes">
        <h2 id="reason-codes" className="m-0 font-serif text-[24px] font-normal">
          Reason codes
        </h2>
        <p className="mt-1 mb-4 max-w-[640px] text-[13px] text-muted-2">
          The message is what a creator sees with a rejection or removal. The code itself never changes.
        </p>
        <div className="grid grid-cols-[180px_200px_minmax(0,1fr)_auto] gap-3 border-0 border-b border-solid border-line pb-2 text-[13px] text-muted-2">
          <span>Code</span>
          <span>Label</span>
          <span>Creator message</span>
          <span className="w-[64px]" />
        </div>
        {codes.length === 0 ? (
          <EmptyState body="No reason codes yet. Run the database migrations to add the starting list." />
        ) : (
          codes.map((c) => (
            <ReasonCodeRow key={c.code} code={c.code} label={c.label} creatorMessage={c.creatorMessage} />
          ))
        )}
      </section>
    </AdminPage>
  )
}
