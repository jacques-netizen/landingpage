'use client'

import { formatDollars } from '@mde/money/dollars'
import { useState } from 'react'
import { ClipPlayer, UnavailableBadge } from '../../_components/clip-player'
import { PlatformTag } from './parts'
import { PostActions } from './post-actions'

// The Clips tab of a campaign (owner brief, 2026-10-15): a grid of tiles, each the clip's picture that
// plays on click, with the handle, platform, views, status and payout.

export type ClipTile = {
  id: string
  platform: string
  platformPostId: string
  postUrl: string
  handle: string
  creator: string
  creatorId: string
  hasVideo: boolean
  hasThumbnail: boolean
  views: number
  verified: boolean
  earnedCents: number
  state: string
  stateLabel: string
  bucket: 'approved' | 'pending' | 'rejected'
  needsVerification: boolean
  submittedAt: string
}

const TONE = { approved: '#4FB286', pending: '#E0A94A', rejected: '#E5675C' } as const
const n = (v: number) => v.toLocaleString('en-US')

export function ClipsGrid({
  clips,
  campaignId,
  reasons,
  canDelete,
}: {
  clips: ClipTile[]
  campaignId: string
  reasons: { code: string; label: string }[]
  canDelete: boolean
}) {
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set())
  return (
    <ul className="m-0 grid list-none grid-cols-4 gap-4 p-0 max-xl:grid-cols-3 max-md:grid-cols-2">
      {clips.map((c) => (
        <li key={c.id} className="flex flex-col rounded-[14px] border border-solid border-line bg-panel p-3">
          <ClipPlayer clip={c} onUnavailable={(id) => setUnavailable((s) => new Set(s).add(id))} />
          <div className="mt-3 flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <a
                href={`/admin/campaigns/${campaignId}?tab=clips&clipper=${c.creatorId}`}
                className="block truncate text-[13px] font-semibold text-ink no-underline hover:text-gold-soft"
                title={c.creator}
              >
                {c.handle}
              </a>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <PlatformTag platform={c.platform} small />
                {unavailable.has(c.id) ? <UnavailableBadge /> : null}
                {c.needsVerification ? (
                  <span className="text-[10px] font-medium text-pending">Needs verification</span>
                ) : null}
              </div>
            </div>
            <span
              className="inline-flex items-center gap-[6px] text-[11px] font-semibold whitespace-nowrap"
              style={{ color: TONE[c.bucket] }}
            >
              <span aria-hidden className="size-[6px] rounded-full" style={{ background: TONE[c.bucket] }} />
              {c.stateLabel}
            </span>
          </div>
          <dl className="m-0 mt-2 flex items-end justify-between gap-2 text-[12px]">
            <div>
              <dt className="text-[11px] text-muted">Views</dt>
              <dd className="m-0 font-semibold tabular-nums">
                {n(c.views)}
                {c.verified ? (
                  <span className="ml-[6px] rounded-[5px] bg-[rgba(79,178,134,0.18)] px-[6px] py-[1px] text-[10px] font-semibold text-[#4FB286]">
                    Verified
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-[11px] text-muted">Payout</dt>
              <dd className="m-0 font-semibold tabular-nums">{formatDollars(c.earnedCents)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-end justify-between gap-2">
            <PostActions campaignId={campaignId} id={c.id} state={c.state} reasons={reasons} canDelete={canDelete} />
            <a href={`/admin/submissions/${c.id}`} className="text-[11px] text-muted-2">
              Details
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
}
