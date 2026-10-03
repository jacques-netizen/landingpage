import type { ReactNode } from 'react'
import { cn } from './cn'

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral'

/** A 6px dot plus a word. Never a coloured pill background. */
export function StatusDot({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-body-sm text-ink">
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'ok' && 'bg-ok',
          tone === 'warn' && 'bg-warn',
          tone === 'bad' && 'bg-bad',
          tone === 'neutral' && 'bg-ink-3',
        )}
      />
      {children}
    </span>
  )
}

/** Small neutral tag such as "Joined". Hairline outline, no fill. */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-pill border border-line-strong px-2.5 text-body-sm text-ink">
      {children}
    </span>
  )
}
