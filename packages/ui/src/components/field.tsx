'use client'
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Checkbox as RxCheckbox, Switch } from 'radix-ui'
import { cn } from './cn'
import { AlertCircle, Check, Chevron } from './icons'

type FieldShellProps = {
  label: string
  helper?: string
  error?: string
  id: string
  children: ReactNode
}

function FieldShell({ label, helper, error, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-body-sm text-bad">
          <AlertCircle size={14} />
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-body-sm text-ink-2">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

const controlClasses = (error?: string) =>
  cn(
    'w-full rounded-input border bg-surface px-4 text-body text-ink placeholder:text-ink-3',
    'transition-colors duration-150 ease-calm',
    'disabled:border-line disabled:text-ink-3',
    error ? 'border-bad' : 'border-line-strong',
  )

type BaseProps = { label: string; helper?: string; error?: string }

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & BaseProps
>(function Input({ label, helper, error, className, id, ...rest }, ref) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} helper={helper} error={error} id={fid}>
      <input
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : helper ? `${fid}-helper` : undefined}
        className={cn(controlClasses(error), 'h-12', className)}
        {...rest}
      />
    </FieldShell>
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & BaseProps
>(function Textarea({ label, helper, error, className, id, ...rest }, ref) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} helper={helper} error={error} id={fid}>
      <textarea
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-error` : helper ? `${fid}-helper` : undefined}
        className={cn(controlClasses(error), 'min-h-28 py-3', className)}
        {...rest}
      />
    </FieldShell>
  )
})

/** Native select with the input shape. Native keeps keyboard and touch behaviour correct. */
export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & BaseProps
>(function Select({ label, helper, error, className, id, children, ...rest }, ref) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} helper={helper} error={error} id={fid}>
      <div className="relative">
        <select
          ref={ref}
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : helper ? `${fid}-helper` : undefined}
          className={cn(controlClasses(error), 'h-12 appearance-none pr-11', className)}
          {...rest}
        >
          {children}
        </select>
        <Chevron
          size={16}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-2"
        />
      </div>
    </FieldShell>
  )
})

export function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  name,
  id,
  error,
}: {
  label: ReactNode
  description?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  name?: string
  id?: string
  error?: string
}) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <RxCheckbox.Root
          id={fid}
          name={name}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={(v) => onCheckedChange?.(v === true)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-error` : undefined}
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-chip border bg-surface',
            'transition-colors duration-150 ease-calm data-[state=checked]:bg-ink data-[state=checked]:border-ink',
            'disabled:border-line',
            error ? 'border-bad' : 'border-line-strong',
          )}
        >
          <RxCheckbox.Indicator className="text-white">
            <Check size={14} />
          </RxCheckbox.Indicator>
        </RxCheckbox.Root>
        <label htmlFor={fid} className="text-body text-ink">
          {label}
          {description && <span className="block text-body-sm text-ink-2">{description}</span>}
        </label>
      </div>
      {error && (
        <p id={`${fid}-error`} className="flex items-center gap-1.5 pl-9 text-body-sm text-bad">
          <AlertCircle size={14} />
          {error}
        </p>
      )}
    </div>
  )
}

export function Toggle({
  label,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  id,
}: {
  label: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  id?: string
}) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={fid} className="text-body text-ink">
        {label}
      </label>
      <Switch.Root
        id={fid}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'group relative h-7 w-12 shrink-0 rounded-pill border border-line-strong bg-surface',
          'transition-colors duration-150 ease-calm data-[state=checked]:bg-ink data-[state=checked]:border-ink',
          'disabled:border-line',
        )}
      >
        <Switch.Thumb
          className={cn(
            'block h-5 w-5 translate-x-[3px] rounded-full bg-ink transition-transform duration-150 ease-calm',
            'data-[state=checked]:translate-x-[24px] data-[state=checked]:bg-white',
            'group-disabled:bg-ink-3',
          )}
        />
      </Switch.Root>
    </div>
  )
}
