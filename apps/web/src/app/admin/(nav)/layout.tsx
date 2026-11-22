import type { ReactNode } from 'react'
import { requireStaff } from '@/server/guard'
import { AdminShell } from './_components/admin-nav'

const ROLE_NAME = { admin: 'Admin', finance: 'Finance', reviewer: 'Moderator' } as const

// The staff console: dark, sidebar on the left, a slim top bar, content centred (owner request).
export default async function AdminNavLayout({ children }: { children: ReactNode }) {
  const viewer = await requireStaff()
  const role = (['admin', 'finance', 'reviewer'] as const).find((r) => viewer.roles.includes(r)) ?? 'reviewer'
  return (
    <AdminShell email={viewer.email} role={ROLE_NAME[role]}>
      {children}
    </AdminShell>
  )
}
