import { Star } from './icons'

/** Circular text badge from the reference. It turns slowly and holds still under reduced motion. */
export function RotatingBadge({ text, size = 104 }: { text: string; size?: number }) {
  const id = 'mde-badge-circle'
  const ring = `${text} • ${text} • `
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={text}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="mde-spin absolute inset-0 text-ink"
        aria-hidden
      >
        <defs>
          <path id={id} d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text fontSize="8.2" fill="currentColor" fontFamily="var(--font-sans)">
          <textPath href={`#${id}`} textLength="236">
            {ring}
          </textPath>
        </text>
      </svg>
      <Star
        size={20}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-ink"
      />
    </div>
  )
}
