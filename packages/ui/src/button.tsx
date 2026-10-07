import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { bare, cn, focusRing, type Tone } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  tone?: Tone
  /** Forward actions show an arrow on the right, as in the mockups. */
  arrow?: boolean
  loading?: boolean
  children: ReactNode
}

// Paper values from the review queue and client report; app values from the campaigns and wallet screens.
const paper: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white',
  secondary: 'border border-solid border-sand bg-field text-ink',
  destructive: 'border border-solid border-sand bg-field text-bad',
  quiet: 'text-ink hover:underline underline-offset-4',
}
const app: Record<ButtonVariant, string> = {
  primary: 'bg-gold-soft text-ink',
  secondary:
    'border border-solid border-[var(--t-glass-line)] bg-[var(--t-glass-bg)] text-[var(--t-text)] backdrop-blur-[20px]',
  destructive: 'border border-solid border-[var(--t-glass-line)] bg-[var(--t-glass-bg)] text-flagged',
  quiet: 'text-[var(--t-text)] hover:underline underline-offset-4',
}

export function Button({
  variant = 'primary',
  size = 'md',
  tone = 'paper',
  arrow,
  loading,
  disabled,
  className,
  children,
  ...rest
}: Props) {
  const isQuiet = variant === 'quiet'
  const shape =
    tone === 'paper'
      ? cn('rounded-pill font-sans font-medium', size === 'md' ? 'h-12 px-6 text-[15px]' : 'h-10 px-5 text-[13px]')
      : cn(
          'rounded-[14px] font-app',
          variant === 'primary' ? 'font-bold' : 'font-semibold',
          size === 'md' ? 'h-12 px-[26px] text-[14px]' : 'h-10 px-5 text-[13px]',
        )
  const off = disabled || loading
  return (
    <button
      type="button"
      disabled={off}
      aria-busy={loading || undefined}
      className={cn(
        bare,
        focusRing,
        'box-border inline-flex cursor-pointer items-center justify-center gap-3 whitespace-nowrap no-underline',
        'transition-transform duration-150 ease-calm',
        !off && !isQuiet && 'hover:-translate-y-px active:scale-[0.98]',
        isQuiet ? cn('h-auto px-0 font-sans text-[15px]', tone === 'app' && 'font-app') : shape,
        off
          ? cn(
              'cursor-not-allowed',
              isQuiet ? 'text-muted' : 'border border-solid border-line bg-transparent text-muted',
            )
          : (tone === 'paper' ? paper : app)[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
      {arrow && !loading ? <span aria-hidden>→</span> : null}
    </button>
  )
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="animate-[spin_0.9s_linear_infinite]">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
