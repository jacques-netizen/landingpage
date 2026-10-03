'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SiteHeader as Header } from '@mde/ui'

const links = [
  { href: '/#campaigns', label: 'Campaigns' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#clients', label: 'For clients' },
  { href: '/#fees', label: 'Fees' },
]

export function SiteHeader({ brandName }: { brandName: string }) {
  const pathname = usePathname()
  return (
    <Header
      brandName={brandName}
      LinkComponent={Link}
      links={links.map((l) => ({ ...l, active: pathname === l.href }))}
      cta={{ href: '/sign-up', label: 'Start earning' }}
    />
  )
}
