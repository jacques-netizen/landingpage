import { db } from '@mde/db'
import { listViewProofs, PROOF_RULES } from '@mde/review'
import { EmptyState } from '@mde/ui'
import { requireStaff } from '@/server/guard'
import { AdminPage } from '../../_components/ui'
import { ProofCard, type ProofRow } from './proof-card'

export const dynamic = 'force-dynamic'

// Creators' own proofs of views (owner request, 2026-10-14), oldest waiting first. Staff watch the
// recording against the rules and set the views, or reject with a note the creator sees.
export default async function ViewProofsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff('staff', '/admin/review/proofs')
  const { show } = await searchParams
  const tab = show === 'decided' ? 'decided' : 'waiting'
  const rows = await listViewProofs(db(), tab === 'decided' ? 'decided' : 'submitted')
  const items: ProofRow[] = rows.map((r) => ({
    ...r,
    requestedAt: r.requestedAt.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  }))
  return (
    <AdminPage
      title="View proofs"
      lead="Creators record their analytics to update a post's views. Set the views the recording shows, or reject with a note."
    >
      <nav aria-label="View proofs" className="mb-6 flex gap-6 text-[14px]">
        {(['waiting', 'decided'] as const).map((t) => (
          <a
            key={t}
            href={`/admin/review/proofs?show=${t}`}
            aria-current={tab === t ? 'page' : undefined}
            className={tab === t ? 'font-medium text-ink' : 'text-muted-2'}
          >
            {t === 'waiting' ? 'Waiting' : 'Decided'}
          </a>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState body={tab === 'waiting' ? 'No proofs waiting.' : 'No decided proofs yet.'} />
      ) : (
        <div className="flex flex-col gap-5">
          {items.map((p) => (
            <ProofCard key={p.id} p={p} rules={PROOF_RULES} />
          ))}
        </div>
      )}
    </AdminPage>
  )
}
