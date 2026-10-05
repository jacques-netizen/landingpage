import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { requireStaff } from '@/server/guard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Staff | Maison d'Élites", robots: { index: false } }

// Every staff page needs a staff role. Pages in (nav) share the side navigation; the review queue is
// the designed screen and draws its own.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireStaff()
  return children
}
