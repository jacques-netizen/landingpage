// Dollars typed by people, to and from whole cents. String maths only, never floating point.
// Safe in the browser: import from '@mde/money/dollars'.

export type ParsedCents = { ok: true; cents: number } | { ok: false; message: string }

const MAX_CENTS = 10 ** 13 // $100 billion, far above any budget

/**
 * "$1,250.00", "1250", "12.5", "2k", "1.5k", "2000 USD", "2 000" -> cents. Commas or single spaces only as
 * thousands separators; at most two decimals (three with k, so the result is still whole cents).
 */
export function parseDollarsToCents(input: string): ParsedCents {
  let s = input
    .trim()
    .replace(/\s*usd$/i, '')
    .replace(/^\$\s*/, '')
    .trim()
  const k = /^(\d+)(?:\.(\d{1,3}))?k$/i.exec(s)
  if (k) s = `${k[1]}${(k[2] ?? '').padEnd(3, '0')}`
  else if (/^\d{1,3}( \d{3})+(\.\d{1,2})?$/.test(s)) s = s.replace(/ /g, '')
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(s)
  if (!m) return { ok: false, message: 'Enter an amount in dollars, like 1,250.00.' }
  const whole = m[1]!.replace(/,/g, '')
  const frac = (m[2] ?? '').padEnd(2, '0')
  if (whole.length > 11) return { ok: false, message: 'That amount is too large.' }
  const cents = Number(whole) * 100 + Number(frac)
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return { ok: false, message: 'That amount is too large.' }
  return { ok: true, cents }
}

export function formatDollars(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Money must be whole cents')
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`
}
