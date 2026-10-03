import { cn } from './cn'
import { TypeClipping, TypeLogo, TypeMusic, TypeUgc } from './icons'

export type CampaignType = 'clipping' | 'logo' | 'music' | 'ugc'

export const campaignTypeMeta: Record<
  CampaignType,
  { label: string; bg: string; Icon: typeof TypeLogo }
> = {
  clipping: { label: 'Clipping', bg: 'bg-lime', Icon: TypeClipping },
  logo: { label: 'Logo', bg: 'bg-lavender', Icon: TypeLogo },
  music: { label: 'Music', bg: 'bg-peach', Icon: TypeMusic },
  ugc: { label: 'UGC', bg: 'bg-sky', Icon: TypeUgc },
}

/** Soft icon chip. Colour appears only here and in status dots. */
export function IconChip({
  type,
  size = 40,
  className,
}: {
  type: CampaignType
  size?: number
  className?: string
}) {
  const { bg, Icon, label } = campaignTypeMeta[type]
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex items-center justify-center rounded-chip text-ink', bg, className)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  )
}

export function TypeLabel({ type }: { type: CampaignType }) {
  const { label } = campaignTypeMeta[type]
  return (
    <span className="inline-flex items-center gap-2 text-body-sm text-ink">
      <IconChip type={type} size={24} />
      {label}
    </span>
  )
}
