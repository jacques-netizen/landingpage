import type { Metadata } from 'next'
import { getBrand } from '@mde/config'
import './globals.css'

const brand = getBrand()

export const metadata: Metadata = {
  title: { default: brand.brandName, template: `%s | ${brand.brandName}` },
  description: 'Join a campaign, post on your own account, and earn for every view that counts.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
