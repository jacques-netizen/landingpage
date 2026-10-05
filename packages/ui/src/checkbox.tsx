'use client'

import * as RCheckbox from '@radix-ui/react-checkbox'
import * as RSwitch from '@radix-ui/react-switch'
import { useId, type ReactNode } from 'react'
import { bare, cn, focusRing } from './cn'

type CheckboxProps = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (v: boolean) => void
  disabled?: boolean
  invalid?: boolean
  name?: string
  value?: string
  required?: boolean
  children: ReactNode
}

// Never pre-ticked by default (05_DESIGN_SYSTEM.md section 11).
export function Checkbox({ children, onCheckedChange, invalid, ...rest }: CheckboxProps) {
  const id = useId()
  return (
    <div className="flex items-start gap-3 font-sans text-[14px] leading-[1.45] text-ink">
      <RCheckbox.Root
        id={id}
        aria-invalid={invalid || undefined}
        onCheckedChange={(v) => onCheckedChange?.(v === true)}
        className={cn(
          bare,
          focusRing,
          'mt-px box-border flex size-5 flex-none cursor-pointer items-center justify-center rounded-[6px] border border-solid bg-[#FBF7F0]',
          invalid ? 'border-bad' : 'border-sand',
          'data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        )}
        {...rest}
      >
        <RCheckbox.Indicator>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M2.5 6.2l2.3 2.3 4.7-5"
              fill="none"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <label htmlFor={id} className="cursor-pointer">
        {children}
      </label>
    </div>
  )
}

type ToggleProps = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (v: boolean) => void
  disabled?: boolean
  children: ReactNode
}

export function Toggle({ children, ...rest }: ToggleProps) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 font-sans text-[14px] text-ink">
      <RSwitch.Root
        id={id}
        className={cn(
          bare,
          focusRing,
          'relative box-border h-[26px] w-11 flex-none cursor-pointer rounded-pill bg-line transition-colors duration-150 ease-calm',
          'data-[state=checked]:bg-ink data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        )}
        {...rest}
      >
        <RSwitch.Thumb className="block size-5 translate-x-[3px] rounded-full bg-white shadow-[0_1px_3px_rgba(26,21,16,0.25)] transition-transform duration-150 ease-calm data-[state=checked]:translate-x-[21px]" />
      </RSwitch.Root>
      <label htmlFor={id} className="cursor-pointer">
        {children}
      </label>
    </div>
  )
}
