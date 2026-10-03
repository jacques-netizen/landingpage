import type { Metadata } from 'next'
import { Styleguide } from './styleguide'

export const metadata: Metadata = {
  title: 'Styleguide',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <Styleguide />
}
