import type { Metadata } from 'next'
import Link from 'next/link'
import { hasRole } from '@mde/config'
import { getBrand } from '@mde/config'
import { PageContainer } from '@mde/ui'
import { requireStaffPage } from '@/lib/staff'
import { AdminSidebar } from './admin-nav'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin' },
  robots: { index: false },
}
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage('reviewer')
  const brand = getBrand()
  const links = [
    { href: '/admin', label: 'Dashboard' },
    ...(hasRole(staff.roles, 'admin') ? [{ href: '/admin/settings', label: 'Settings' }] : []),
  ]
  return (
    <PageContainer width="app" className="grid gap-12 py-8 md:grid-cols-[200px_1fr]">
      <aside className="flex flex-col gap-8">
        <Link href="/admin" className="font-display text-display-sm">
          {brand.brandName}
        </Link>
        <AdminSidebar links={links} />
        <p className="text-body-sm text-ink-2">{staff.email}</p>
      </aside>
      <main className="mde-page min-w-0">{children}</main>
    </PageContainer>
  )
}
