'use client'

import { AdminNav } from '@mde/ui'
import { usePathname } from 'next/navigation'

const LINKS = [
  ['Dashboard', '/admin'],
  ['Campaigns', '/admin/campaigns'],
  ['Clients', '/admin/clients'],
  ['Review queue', '/admin/review'],
  ['Creators', '/admin/creators'],
  ['Appeals', '/admin/appeals'],
  ['Ledger', '/admin/ledger'],
  ['Payouts', '/admin/payouts'],
  ['Team', '/admin/team'],
  ['Settings', '/admin/settings'],
  ['Audit log', '/admin/audit-log'],
] as const

// The review queue mockup's left column. The active link follows the current page.
export function AdminSideNav() {
  const path = usePathname()
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href))
  return <AdminNav links={LINKS.map(([label, href]) => ({ label, href, active: active(href) }))} />
}
