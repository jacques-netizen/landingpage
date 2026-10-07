import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { bare, cn, type Tone } from './cn'

// Inputs follow the review queue's note field: 14px radius, sand border, warm white fill.
// The app tone follows the campaigns search field (glass fill, theme line).
const control = (tone: Tone, invalid?: boolean) =>
  cn(
    bare,
    'box-border w-full rounded-input border border-solid px-4 text-[14px] outline-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    tone === 'paper'
      ? 'bg-field font-sans text-ink placeholder:text-muted focus-visible:outline-ink'
      : 'bg-[var(--t-glass-bg)] font-app font-medium text-[var(--t-text)] placeholder:text-[var(--t-muted)] backdrop-blur-[20px] focus-visible:outline-[var(--t-text)]',
    invalid ? 'border-bad' : tone === 'paper' ? 'border-sand' : 'border-[var(--t-glass-line)]',
    'disabled:cursor-not-allowed disabled:opacity-60',
  )

type FieldProps = {
  label: string
  helper?: string
  error?: string
  tone?: Tone
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

// Label above, helper below, error below with an icon and text (never colour alone).
export function Field({ label, helper, error, tone = 'paper', children }: FieldProps) {
  const id = useId()
  const helperId = `${id}-help`
  const errorId = `${id}-err`
  const describedBy = [helper && helperId, error && errorId].filter(Boolean).join(' ') || undefined
  const muted = tone === 'paper' ? 'text-muted-2' : 'text-[var(--t-muted)]'
  return (
    <div className={cn('flex flex-col gap-2', tone === 'paper' ? 'font-sans' : 'font-app')}>
      <label
        htmlFor={id}
        className={cn('text-[13px] font-medium leading-[1.2]', tone === 'paper' ? 'text-ink' : 'text-[var(--t-text)]')}
      >
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {helper ? (
        <p id={helperId} className={cn('m-0 text-[13px] leading-[1.45]', muted)}>
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="m-0 flex items-center gap-2 text-[13px] leading-[1.45] text-bad">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 3.8v3.8M7 9.6v.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { tone?: Tone; invalid?: boolean }

export function Input({ tone = 'paper', invalid, className, ...rest }: InputProps) {
  return (
    <input aria-invalid={invalid || undefined} className={cn(control(tone, invalid), 'h-12', className)} {...rest} />
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { tone?: Tone; invalid?: boolean }

export function Textarea({ tone = 'paper', invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(control(tone, invalid), 'min-h-20 resize-y py-[14px] leading-[1.45]', className)}
      {...rest}
    />
  )
}

export { control as controlClass }
