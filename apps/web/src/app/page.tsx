import { HomeClient } from './home-client'
import { loadContentOverrides } from '@/lib/content'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const overrides = await loadContentOverrides('home')
  return <HomeClient overrides={overrides} />
}
