import type { ReactNode } from 'react'

// Shared pieces for app screens the mockups do not show, taken from the campaign page.
export const panel =
  'rounded-[24px] border border-solid border-[var(--t-glass-line)] bg-[var(--t-glass-bg)] backdrop-blur-[20px]'

export function AppHeading({ title, lead, action }: { title: string; lead?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-4 px-2 pt-2 pb-2">
      <div>
        <h1 className="m-0 text-[44px] leading-[1.05] font-bold tracking-[-0.02em] max-sm:text-[32px]">{title}</h1>
        {lead ? (
          <p className="mt-3 mb-0 max-w-[620px] text-[15px] leading-[1.6] text-[var(--t-muted)]">{lead}</p>
        ) : null}
      </div>
      {action}
    </header>
  )
}

export const STATUS_COLOURS = { good: '#4FB286', wait: '#E0A94A', bad: '#E5675C', off: 'var(--t-muted)' } as const

/** A small coloured dot and a label, as on the campaign page's status. */
export function StatusDot({ tone, children }: { tone: keyof typeof STATUS_COLOURS; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-semibold whitespace-nowrap">
      <span aria-hidden className="size-[7px] flex-none rounded-full" style={{ background: STATUS_COLOURS[tone] }} />
      {children}
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-7 items-center rounded-pill border border-solid border-[var(--t-glass-line)] bg-[var(--t-glass-bg)] px-3 text-[12px] font-semibold">
      {children}
    </span>
  )
}
