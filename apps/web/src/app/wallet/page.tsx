import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { WalletView } from '@/designed/wallet-view'
import { loadContentOverrides } from '@/lib/content'
import { getViewer } from '@/server/viewer'
import { loadWallet } from '@/server/wallet'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Wallet | Maison d'Élites" }

// The creator's wallet and overview, built from "Creator Site v1" (screen wallet) with real data.
export default async function WalletPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/sign-in?next=/wallet')
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  const [data, overrides] = await Promise.all([loadWallet(viewer.id), loadContentOverrides('wallet')])
  return <WalletView state="data" data={data} theme={theme} overrides={overrides} />
}
