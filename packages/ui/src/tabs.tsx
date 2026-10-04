'use client'

import * as RTabs from '@radix-ui/react-tabs'
import type { ReactNode } from 'react'
import { bare, cn, focusRing, type Tone } from './cn'

type Tab = { value: string; label: string; content: ReactNode }

type Props = { tabs: Tab[]; defaultValue?: string; value?: string; onValueChange?: (v: string) => void; tone?: Tone }

// Paper: text tabs with an underline. App: the wallet's segmented tabs (Overview, Withdrawals).
export function Tabs({ tabs, tone = 'paper', defaultValue, ...rest }: Props) {
  return (
    <RTabs.Root defaultValue={defaultValue ?? tabs[0]?.value} {...rest}>
      <RTabs.List
        className={cn(
          'flex',
          tone === 'paper'
            ? 'gap-6 border-0 border-b border-solid border-line'
            : 'w-max gap-1 rounded-[18px] border border-solid border-[var(--t-card-line)] bg-[var(--t-card)] p-[6px] backdrop-blur-[18px]',
        )}
      >
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              bare,
              focusRing,
              'cursor-pointer',
              tone === 'paper'
                ? '-mb-px h-11 border-0 border-b-2 border-solid border-transparent font-sans text-[15px] text-muted-2 data-[state=active]:border-ink data-[state=active]:text-ink'
                : 'flex h-10 items-center rounded-[12px] px-[22px] font-sans text-[12px] font-semibold tracking-[0.06em] text-[var(--t-muted)] uppercase data-[state=active]:bg-[var(--t-soft)] data-[state=active]:text-[var(--t-text)]',
            )}
          >
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="outline-none">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  )
}

type SegmentedProps = {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  label: string
  tone?: Tone
}

// The mockups' pill switch (Dark / Glass, filters). The active option takes the gold fill.
export function Segmented({ options, value, onChange, label, tone = 'paper' }: SegmentedProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex w-max gap-1 rounded-pill border border-solid p-1',
        tone === 'paper'
          ? 'border-line bg-[rgba(255,255,255,0.55)]'
          : 'border-[var(--t-glass-line)] bg-[var(--t-glass-bg)]',
      )}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              bare,
              focusRing,
              'flex h-[30px] cursor-pointer items-center rounded-pill px-[14px] font-sans text-[12px] font-semibold',
              on ? 'bg-gold-soft text-ink' : tone === 'paper' ? 'text-muted-2' : 'text-[var(--t-muted)]',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
