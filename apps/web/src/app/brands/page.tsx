import type { Metadata } from 'next'
import { brand } from '@mde/config'
import { BrandsClient } from './brands-client'
import { loadContentOverrides } from '@/lib/content'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "For brands | Maison d'Élites" }

export default async function BrandsPage() {
  const overrides = await loadContentOverrides('brands')
  const b = brand()
  return (
    <BrandsClient
      overrides={overrides}
      contactEmail={b.contactEmail}
      supportHref={b.supportDiscordUrl ?? '/help'}
      creatorHomeHref={process.env.BRAND_HOST && process.env.APP_URL ? process.env.APP_URL : '/'}
    />
  )
}
