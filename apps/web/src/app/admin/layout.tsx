import { AdminNav } from '@mde/ui'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { requireStaff } from '@/server/guard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Staff | Maison d'Élites", robots: { index: false } }

// The staff admin shell from the review queue mockup: plain text links on the left.
const LINKS = [
  ['Dashboard', '/admin'],
  ['Campaigns', '/admin/campaigns'],
  ['Review queue', '/admin/review'],
  ['Creators', '/admin/creators'],
  ['Appeals', '/admin/appeals'],
  ['Ledger', '/admin/ledger'],
  ['Payouts', '/admin/payouts'],
  ['Settings', '/admin/settings'],
  ['Audit log', '/admin/audit-log'],
] as const

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireStaff()
  return (
    <div className="flex min-h-[900px] bg-page font-sans text-ink">
      <AdminNav links={LINKS.map(([label, href]) => ({ label, href, active: href === '/admin' }))} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
