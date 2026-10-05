// The wallet mockup's sample numbers as creator data, so the visual tests render the real wallet
// component through the real model and compare it with the locked screenshots. Never shown to creators.
import type { WalletData } from './wallet-model'

// A Thursday in September: "TODAY" and "27 SEPT" fall in the same month, with a four day streak.
export const SAMPLE_NOW = new Date('2023-09-28T12:00:00Z')

const post = (n: number, platform: string, views: number, state: string, day: string) => ({
  id: `sample-${n}`,
  title: `Sample clip 0${n}`,
  platform,
  state,
  countedViews: views,
  earnedCents: Math.floor((views * 200) / 1000),
  submittedAt: new Date(`${day}T10:0${n}:00Z`),
})

export const SAMPLE_WALLET: WalletData = {
  availableCents: 18_420,
  pendingCents: 6_240,
  paidCents: 0,
  countedViewsAll: 158_200,
  earnedCentsAll: 31_640,
  bestCentsAll: 12_000,
  lifetimeCountedViews: 372_000,
  payout: { method: 'bank_transfer', last4: '0000' },
  posts: [
    post(1, 'tiktok', 31_200, 'earning', '2023-09-28'),
    post(2, 'instagram', 60_000, 'paid_out', '2023-09-28'),
    post(3, 'tiktok', 28_100, 'paid_out', '2023-09-28'),
    post(4, 'youtube', 4_000, 'flagged', '2023-09-27'),
    post(5, 'instagram', 12_400, 'paid_out', '2023-09-27'),
    post(6, 'tiktok', 22_500, 'paid_out', '2023-09-27'),
  ],
  postDays: ['2023-09-25', '2023-09-26', '2023-09-27', '2023-09-28'],
  bars: [30, 44, 36, 52, 40, 60, 48, 70, 54, 40, 30, 24].map((cents, i) => ({
    cents,
    kind: i < 7 ? 'available' : i < 10 ? 'pending' : 'held',
  })),
}
