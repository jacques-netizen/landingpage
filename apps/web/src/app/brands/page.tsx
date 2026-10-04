import type { Metadata } from 'next'
import { brand } from '@mde/config'
import { BrandsClient } from './brands-client'
import { loadContentOverrides } from '@/lib/content'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "For brands | Maison d'Élites" }

export default async function BrandsPage() {
  const overrides = await loadContentOverrides('brands')
  return <BrandsClient overrides={overrides} contactEmail={brand().contactEmail} />
}
