import { HomeClient } from './home-client'
import { redirect } from 'next/navigation'
import { loadContentOverrides } from '@/lib/content'
import { getViewer } from '@/server/viewer'

export const dynamic = 'force-dynamic'

// Signed-in creators always start on the campaigns screen (owner request, 2026-10-07).
export default async function HomePage() {
  const viewer = await getViewer().catch(() => null) // the landing page must stay up without the database
  if (viewer) redirect('/campaigns')
  const overrides = await loadContentOverrides('home')
  return <HomeClient overrides={overrides} />
}
