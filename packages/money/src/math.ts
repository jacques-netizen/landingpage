// Integer money maths. Every amount is a whole number of cents; products go through BigInt so
// nothing overflows or picks up floating point error.
import { MoneyError } from './errors'

export function assertWhole(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) throw new MoneyError('not_whole_cents', `${what} must be a whole number of cents`)
}

export function assertNonNegative(value: number, what: string): void {
  assertWhole(value, what)
  if (value < 0) throw new MoneyError('not_whole_cents', `${what} must not be negative`)
}

/** floor(a * b / d) for non-negative integers. Used for earnings so rounding never creates money. */
export function mulDivFloor(a: number, b: number, d: number): number {
  const r = (BigInt(a) * BigInt(b)) / BigInt(d)
  return Number(r)
}

/** amount * bps / 10,000 rounded half up. Used for fees (02_DATA_AND_MONEY.md section 5.2). */
export function roundHalfUpBps(amountCents: number, bps: number): number {
  assertNonNegative(amountCents, 'Amount')
  assertNonNegative(bps, 'Basis points')
  return Number((BigInt(amountCents) * BigInt(bps) + 5_000n) / 10_000n)
}
