import type { ComponentType, ReactNode } from 'react'
import { formatUsd, splitUsd } from '@mde/money'
import { cn } from './cn'
import { IconChip, type CampaignType } from './chip'
import { PlatformMark } from './icons'

type LinkLike = ComponentType<{ href: string; className?: string; children?: ReactNode }>
const DefaultLink: LinkLike = ({ href, ...rest }) => <a href={href} {...rest} />

export type CampaignCardData = {
  id: string
  title: string
  type: CampaignType
  coverImageUrl: string | null
  platforms: ('tiktok' | 'instagram' | 'youtube' | 'x')[]
  budgetCents: bigint
  budgetLeftCents: bigint
  rateCentsPer1000: number
}

/**
 * Portrait 3:4 card. Cover fills the top 65%, then title, budget left as a large serif number,
 * rate, platforms and a 2px hairline showing dollars paid against budget.
 * No badges, no countdowns.
 */
export function CampaignCard({
  campaign,
  href,
  LinkComponent = DefaultLink,
  muted,
}: {
  campaign: CampaignCardData
  href: string
  LinkComponent?: LinkLike
  /** Closed campaigns are lighter. */
  muted?: boolean
}) {
  const Link = LinkComponent
  const { dollars, cents } = splitUsd(campaign.budgetLeftCents)
  const paid = campaign.budgetCents - campaign.budgetLeftCents
  // Progress in whole permille, integer maths only.
  const permille = campaign.budgetCents > 0n ? Number((paid * 1000n) / campaign.budgetCents) : 0
  return (
    <Link
      href={href}
      className={cn(
        'group flex aspect-[3/4] flex-col overflow-hidden rounded-card border border-line bg-surface',
        'transition-transform duration-150 ease-calm hover:-translate-y-px',
        muted && 'opacity-70',
      )}
    >
      <div className="relative basis-[65%] overflow-hidden bg-line">
        {campaign.coverImageUrl && (
          <img src={campaign.coverImageUrl} alt="" className="h-full w-full object-cover" />
        )}
        <IconChip type={campaign.type} size={36} className="absolute left-3 top-3" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-display-sm line-clamp-2">{campaign.title}</h3>
          <p className="font-display tabular text-display-md leading-none">
            {dollars}
            <span className="text-ink-2">{cents}</span>
            <span className="ml-2 font-sans text-body-sm text-ink-2">left</span>
          </p>
          <p className="text-body-sm text-ink-2">
            {formatUsd(campaign.rateCentsPer1000)} per 1,000 views
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            {campaign.platforms.map((p) => (
              <PlatformMark key={p} platform={p} size={20} />
            ))}
          </div>
          <div
            role="progressbar"
            aria-label="Share of budget paid"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(permille / 10)}
            className="h-0.5 w-full bg-line"
          >
            <div className="h-full bg-ink" style={{ width: `${permille / 10}%` }} />
          </div>
        </div>
      </div>
    </Link>
  )
}
