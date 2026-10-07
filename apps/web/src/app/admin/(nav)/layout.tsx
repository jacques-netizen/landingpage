import type { ReactNode } from 'react'
import { requireStaff } from '@/server/guard'
import { AdminSideNav, AdminTopBar } from './_components/admin-nav'

const ROLE_NAME = { admin: 'Admin', finance: 'Finance', reviewer: 'Moderator' } as const

// The staff console: dark, sidebar on the left, a slim top bar, content centred (owner request).
export default async function AdminNavLayout({ children }: { children: ReactNode }) {
  const viewer = await requireStaff()
  const role = (['admin', 'finance', 'reviewer'] as const).find((r) => viewer.roles.includes(r)) ?? 'reviewer'
  return (
    <div className="mde-admin-dark flex min-h-screen bg-page font-sans text-ink">
      <AdminSideNav email={viewer.email} role={ROLE_NAME[role]} />
      <div className="min-w-0 flex-1">
        <AdminTopBar />
        {children}
      </div>
    </div>
  )
}
