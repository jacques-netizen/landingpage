import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { requireStaff } from '@/server/guard'
import { AdminSideNav } from './_components/admin-nav'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Staff | Maison d'Élites", robots: { index: false } }

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireStaff()
  return (
    <div className="flex min-h-[900px] bg-page font-sans text-ink">
      <AdminSideNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
