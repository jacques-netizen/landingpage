'use client'

import * as RSelect from '@radix-ui/react-select'
import { bare, cn, type Tone } from './cn'
import { controlClass } from './field'

type Option = { value: string; label: string; disabled?: boolean }

type Props = {
  id?: string
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
  options: Option[]
  placeholder?: string
  tone?: Tone
  invalid?: boolean
  disabled?: boolean
  'aria-describedby'?: string
}

// Same shape as the inputs, with the mockups' small chevron (as in "This month").
export function Select({ id, options, placeholder, tone = 'paper', invalid, ...rest }: Props) {
  return (
    <RSelect.Root {...rest}>
      <RSelect.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={rest['aria-describedby']}
        className={cn(
          controlClass(tone, invalid),
          'flex h-12 cursor-pointer items-center justify-between gap-3 text-left',
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon aria-hidden>⌄</RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-input border border-solid p-1 shadow-[0_32px_80px_rgba(26,21,16,0.14)]',
            tone === 'paper'
              ? 'border-sand bg-[#FBF7F0] font-sans text-ink'
              : 'border-[var(--t-glass-line)] bg-[var(--t-pop)] font-app text-[var(--t-text)]',
          )}
        >
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className={cn(
                  bare,
                  'flex h-10 cursor-pointer items-center rounded-[10px] px-3 text-[14px] outline-none',
                  'data-[highlighted]:bg-[rgba(26,21,16,0.05)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
                  'data-[state=checked]:font-semibold',
                )}
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  )
}
