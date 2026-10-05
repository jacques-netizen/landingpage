'use client'

import { useRouter } from 'next/navigation'
import { DesignedFrame } from '@/designed/frame'
import { HomeDesign } from '@/designed/home'
import { homeContent } from '@/designed/home.content'
import { makeCopy } from '@/designed/runtime'

// Home, built from "Creator Site v1" (the locked creator version).
export function HomeClient({ overrides }: { overrides: Record<string, string> }) {
  const router = useRouter()
  const go = (href: string) => () => router.push(href)
  const v = {
    goHome: go('/'),
    navLinks: [
      { label: 'Campaigns', go: go('/campaigns') },
      { label: 'Wallet', go: go('/wallet') },
    ],
    startEarning: go('/sign-up'),
    howItWorks: go('/how-it-works'),
  }
  return (
    <DesignedFrame>
      <HomeDesign v={v} copy={makeCopy(homeContent, overrides)} />
    </DesignedFrame>
  )
}
