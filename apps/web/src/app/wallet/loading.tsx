import { cookies } from 'next/headers'
import { readThemeCookie, THEME_COOKIE } from '@/designed/themes'
import { WalletView } from '@/designed/wallet-view'

// The mockup's loading state: skeletons where the balance and posts go, other figures blank.
export default async function WalletLoading() {
  const theme = readThemeCookie((await cookies()).get(THEME_COOKIE)?.value)
  return <WalletView state="loading" data={null} theme={theme} />
}
