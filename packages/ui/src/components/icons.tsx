import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...rest,
  }
}

export const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const ArrowUpRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
)
export const Play = (p: IconProps) => (
  <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}>
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
)
export const Plus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const Check = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)
export const Close = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const Chevron = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const AlertCircle = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16v.01" />
  </svg>
)
export const Menu = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8h16M4 16h16" />
  </svg>
)
export const Bell = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
  </svg>
)
export const Search = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

/** Four point star, the brand ornament. */
export const Star = (p: IconProps) => (
  <svg {...base({ ...p, fill: 'currentColor', stroke: 'none', viewBox: '0 0 24 24' })}>
    <path d="M12 1c.7 6.6 4.4 10.3 11 11-6.6.7-10.3 4.4-11 11-.7-6.6-4.4-10.3-11-11C7.6 11.3 11.3 7.6 12 1z" />
  </svg>
)

/** Campaign type glyphs. */
export const TypeClipping = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6.5" cy="7" r="2.5" />
    <circle cx="6.5" cy="17" r="2.5" />
    <path d="M8.5 8.5 20 18M8.5 15.5 20 6" />
  </svg>
)
export const TypeLogo = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4.5" y="4.5" width="15" height="15" rx="4" />
    <path d="m9 15 3-6 3 6M10 13.5h4" />
  </svg>
)
export const TypeMusic = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </svg>
)
export const TypeUgc = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </svg>
)
export const Waveform = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 10v4M9 6v12M13 9v6M17 7v10M21 11v2" />
  </svg>
)

/** Platform marks. Simple monograms until licensed logos are supplied. */
export function PlatformMark({
  platform,
  size = 18,
}: {
  platform: 'tiktok' | 'instagram' | 'youtube' | 'x'
  size?: number
}) {
  const label = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X' }[platform]
  const letter = { tiktok: 'T', instagram: 'I', youtube: 'Y', x: 'X' }[platform]
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center rounded-full border border-line-strong font-mono text-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }}
    >
      {letter}
    </span>
  )
}
