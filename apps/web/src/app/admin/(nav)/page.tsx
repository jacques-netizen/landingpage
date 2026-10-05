import { EmptyState } from '@mde/ui'
import { requireStaff } from '@/server/guard'

// Phase 0 placeholder. The real dashboard lists (posts waiting, appeals near deadline, campaigns
// near budget end, payouts waiting) arrive with their phases.
export default async function AdminDashboard() {
  const viewer = await requireStaff()
  return (
    <div className="max-w-[760px] px-10 py-8">
      <h1 className="m-0 font-serif text-[28px] font-normal">Dashboard</h1>
      <p className="mt-1 mb-0 text-[13px] text-muted-2">
        Signed in as {viewer.email}. Roles: {viewer.roles.join(', ')}.
      </p>
      <div className="mt-8">
        <EmptyState body="Nothing waiting yet. Review, appeals and payouts appear here as they are built." />
      </div>
    </div>
  )
}
