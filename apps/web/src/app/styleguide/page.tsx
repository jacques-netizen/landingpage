import type { Metadata } from 'next'
import { StyleguideClient } from './styleguide-client'

export const metadata: Metadata = { title: 'Styleguide', robots: { index: false, follow: false } }

export default function StyleguidePage() {
  return <StyleguideClient />
}
