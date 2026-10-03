'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AdminNav, type NavLink } from '@mde/ui'

export function AdminSidebar({ links }: { links: Omit<NavLink, 'active'>[] }) {
  const pathname = usePathname()
  return (
    <AdminNav
      LinkComponent={Link}
      links={links.map((l) => ({
        ...l,
        active: l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href),
      }))}
    />
  )
}
