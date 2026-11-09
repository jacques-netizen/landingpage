import { redirect } from 'next/navigation'

// The audit log is the Staff actions tab of the Change log (2026-11-09).
export default function AuditLogPage() {
  redirect('/admin/changes?tab=staff')
}
