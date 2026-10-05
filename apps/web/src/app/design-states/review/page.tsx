import { notFound } from 'next/navigation'
import { ReviewView, type ReviewItem } from '@/designed/review-view'

// The review screen with the mockup's sample queue, for the visual tests (CI only).
export const dynamic = 'force-dynamic'

const item = (who: string, platform: string, campaignTitle: string, flagged = false): ReviewItem => ({
  id: who,
  who,
  platform,
  campaignTitle,
  flagged,
  submittedAt: '2026-10-02T10:00:00Z',
  postUrl: 'https://example.com',
  checks: [
    { label: 'Posted on a linked account', status: 'pass' },
    { label: 'Required hashtag present', status: 'pass' },
    { label: 'Minimum duration', status: 'pass' },
    { label: 'Same clip posted before', status: 'review' },
  ],
})

export default function ReviewStates() {
  if (process.env.NODE_ENV === 'production' && process.env.DESIGN_STATES !== '1') notFound()
  return (
    <ReviewView
      state="data"
      embedLabel="embedded post"
      items={[
        { ...item('Creator A', 'tiktok', 'Sample clipping', true) },
        item('Creator B', 'instagram', 'Sample logo'),
        item('Creator C', 'youtube', 'Sample music'),
        item('Creator D', 'tiktok', 'Sample clipping'),
      ]}
      reasons={[
        { code: 'missing_hashtag', label: 'Missing hashtag' },
        { code: 'below_min_duration', label: 'Too short' },
        { code: 'duplicate_post', label: 'Reused clip' },
      ]}
    />
  )
}
