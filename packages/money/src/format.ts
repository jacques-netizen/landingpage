// Money is whole cents. No floating point is used here: all arithmetic is on integers or bigint.

export type Cents = number | bigint

function toBigInt(cents: Cents): bigint {
  if (typeof cents === 'bigint') return cents
  if (!Number.isSafeInteger(cents)) throw new Error(`Money must be whole cents, got ${cents}`)
  return BigInt(cents)
}

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function splitUsd(cents: Cents): { sign: '' | '-'; dollars: string; cents: string } {
  const value = toBigInt(cents)
  const negative = value < 0n
  const abs = negative ? -value : value
  const whole = abs / 100n
  const rest = abs % 100n
  return {
    sign: negative ? '-' : '',
    dollars: `$${group(whole.toString())}`,
    cents: `.${rest.toString().padStart(2, '0')}`,
  }
}

export function formatUsd(cents: Cents, options: { dropZeroCents?: boolean } = {}): string {
  const { sign, dollars, cents: c } = splitUsd(cents)
  if (options.dropZeroCents && c === '.00') return `${sign}${dollars}`
  return `${sign}${dollars}${c}`
}
