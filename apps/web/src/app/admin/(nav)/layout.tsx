import type { ReactNode } from 'react'
import { AdminSideNav } from './_components/admin-nav'

export default function AdminNavLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[900px] bg-page font-sans text-ink">
      <AdminSideNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
