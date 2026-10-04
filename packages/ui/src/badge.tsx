import type { ReactNode } from 'react'
import { cn, type Tone } from './cn'

export type Status = 'ok' | 'warn' | 'bad' | 'neutral'

const dot: Record<Status, string> = { ok: 'bg-ok-ink', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-muted' }
const appDot: Record<Status, string> = {
  ok: 'bg-ok',
  warn: 'bg-pending',
  bad: 'bg-flagged',
  neutral: 'bg-[var(--t-hair2)]',
}

// Status is a 6px dot plus a word. Never colour alone, never a coloured pill.
export function StatusBadge({
  status,
  children,
  tone = 'paper',
}: {
  status: Status
  children: ReactNode
  tone?: Tone
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[10px] text-[13px]',
        tone === 'paper' ? 'text-ink' : 'text-[var(--t-text)]',
      )}
    >
      <span
        aria-hidden
        className={cn('size-[6px] flex-none rounded-full', (tone === 'paper' ? dot : appDot)[status])}
      />
      {children}
    </span>
  )
}

// Pill chip (the review queue's reason pills); selected takes the ink fill.
export function Chip({ children, selected, tone = 'paper' }: { children: ReactNode; selected?: boolean; tone?: Tone }) {
  return (
    <span
      className={cn(
        'box-border inline-flex h-9 items-center rounded-pill border border-solid px-4 text-[13px]',
        tone === 'paper'
          ? selected
            ? 'border-ink bg-ink text-white'
            : 'border-sand text-ink'
          : selected
            ? 'border-gold-soft bg-gold-soft text-ink'
            : 'border-[var(--t-glass-line)] bg-[var(--t-glass-bg)] font-app font-semibold text-[var(--t-text)]',
      )}
    >
      {children}
    </span>
  )
}

/** Campaign type chip colours (05_DESIGN_SYSTEM.md section 2), for screens the mockups do not show. */
export const TYPE_CHIP: Record<'clipping' | 'logo' | 'music' | 'ugc', string> = {
  clipping: '#DDF59A',
  logo: '#D3C7FF',
  music: '#FFD3B0',
  ugc: '#CDE6FF',
}
