import { splitUsd, type Cents } from '@mde/money'
import { cn } from './cn'

/** Large money figure in serif with tabular numerals. Cents are shown in the secondary ink. */
export function Money({
  cents,
  size = 'md',
  className,
}: {
  cents: Cents
  size?: 'md' | 'sm'
  className?: string
}) {
  const { sign, dollars, cents: c } = splitUsd(cents)
  return (
    <span
      className={cn(
        'font-display tabular',
        size === 'md' ? 'text-display-md' : 'text-display-sm',
        className,
      )}
    >
      {sign}
      {dollars}
      <span className="text-ink-2">{c}</span>
    </span>
  )
}

/** A balance with its label, for example "Available". */
export function MoneyLine({
  label,
  cents,
  size,
}: {
  label: string
  cents: Cents
  size?: 'md' | 'sm'
}) {
  return (
    <p className="flex flex-col gap-1">
      <span className="text-body-sm text-ink-2">{label}</span>
      <Money cents={cents} size={size} />
    </p>
  )
}
