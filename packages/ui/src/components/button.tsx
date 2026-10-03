import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from 'radix-ui'
import { cn } from './cn'
import { ArrowRight } from './icons'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive'
export type ButtonSize = 'md' | 'sm'

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium text-body select-none',
    'transition-[transform,box-shadow,background-color] duration-150 ease-calm',
    'disabled:pointer-events-none disabled:shadow-none aria-disabled:pointer-events-none',
    variant !== 'quiet' && 'rounded-pill',
    size === 'md' ? 'h-12 px-[22px]' : 'h-10 px-[18px] text-body-sm',
    variant === 'primary' &&
      'bg-ink text-white hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:bg-transparent disabled:text-ink-3 disabled:border disabled:border-line aria-disabled:bg-transparent aria-disabled:text-ink-3',
    variant === 'secondary' &&
      'border border-line-strong bg-transparent text-ink hover:-translate-y-px hover:bg-white active:scale-[0.98] disabled:text-ink-3 disabled:border-line',
    variant === 'destructive' &&
      'border border-line-strong bg-white text-bad hover:-translate-y-px active:scale-[0.98] disabled:text-ink-3 disabled:border-line',
    variant === 'quiet' &&
      'h-auto px-1 py-2 text-ink underline-offset-4 hover:underline disabled:text-ink-3',
    className,
  )
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Adds the forward arrow on the right (primary actions that move forward). */
  forward?: boolean
  /** Renders the child element (for example a Link) with button styling. */
  asChild?: boolean
  /** Leading icon shown in a black circle on secondary buttons, like Watch video. */
  leadingIcon?: React.ReactNode
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    forward,
    asChild,
    leadingIcon,
    loading,
    className,
    children,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  const classes = buttonClasses({ variant, size, className })
  if (asChild) {
    return (
      <Slot.Root ref={ref} className={classes} {...rest}>
        {children}
      </Slot.Root>
    )
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {leadingIcon && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white">
          {leadingIcon}
        </span>
      )}
      {loading ? 'Working' : children}
      {forward && !loading && <ArrowRight size={16} />}
    </button>
  )
})
