import { requireStaffPage } from '@/lib/staff'

export default async function AdminDashboard() {
  await requireStaffPage('reviewer')
  return (
    <>
      <h1 className="font-display text-display-sm">Dashboard</h1>
      <p className="mt-2 text-body text-ink-2">
        Posts waiting for review, appeals near deadline and payouts waiting will appear here.
      </p>
    </>
  )
}
