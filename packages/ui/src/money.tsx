import { cn } from './cn'

// Whole cents in, dollars out. No floats: the dollar and cent parts are computed with integer maths.
export function splitCents(cents: number) {
  if (!Number.isSafeInteger(cents)) throw new Error('Money must be whole cents')
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100).toLocaleString('en-US')
  const rest = String(abs % 100).padStart(2, '0')
  return { sign, dollars, cents: rest }
}

export function formatCents(cents: number) {
  const p = splitCents(cents)
  return `${p.sign}$${p.dollars}.${p.cents}`
}

// Large balance: serif, tabular numerals, cents in the secondary colour (as in the client report).
export function MoneyFigure({ cents, label, size = 40 }: { cents: number; label: string; size?: number }) {
  const p = splitCents(cents)
  return (
    <div>
      <div className="font-serif leading-none tabular-nums" style={{ fontSize: size }}>
        {p.sign}${p.dollars}
        <span className="text-muted-2" style={{ fontSize: size / 2 }}>
          .{p.cents}
        </span>
      </div>
      <div className="mt-[6px] font-sans text-[13px] text-muted-2">{label}</div>
    </div>
  )
}

/** A label and a number side by side in one line, for pending and available. */
export function MoneyLine({ cents, label, className }: { cents: number; label: string; className?: string }) {
  return (
    <p className={cn('m-0 font-sans text-[15px] text-muted-2', className)}>
      {label} <span className="text-ink tabular-nums">{formatCents(cents)}</span>
    </p>
  )
}
