import { requireStaffPage } from '@/lib/staff'

export default async function AdminSettings() {
  await requireStaffPage('admin')
  return (
    <>
      <h1 className="font-display text-display-sm">Settings</h1>
      <p className="mt-2 text-body text-ink-2">
        Fees, minimums, review window, reason codes and roles will be edited here.
      </p>
    </>
  )
}
