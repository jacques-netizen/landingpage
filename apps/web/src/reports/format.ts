// Number and date formats used on the client reports, as the reference reports write them:
// 91K, 9.8K, 1.6M, 11.1%, "16 October", "16 Oct", "26 Oct 2026".

const strip = (s: string) => s.replace(/\.0$/, '')

/** 91K, 9.8K, 163.7K, 1.6M; under 1,000 as it is. */
export function short(n: number): string {
  if (n >= 999_950) return strip((n / 1e6).toFixed(1)) + 'M'
  if (n >= 1000) return strip((n / 1000).toFixed(1)) + 'K'
  return String(Math.round(n))
}

/** A count split for a count-up: the number, its decimals and the unit after it. */
export function countUp(n: number): { target: string; dec: number; unit: string } {
  const s = short(n)
  const unit = /[KM]$/.test(s) ? s.slice(-1) : ''
  const num = unit ? s.slice(0, -1) : s
  const dec = num.includes('.') ? num.split('.')[1]!.length : 0
  return { target: num, dec, unit }
}

/** Whole thousands for averages: 20K, 56K. */
export function shortRound(n: number): string {
  if (n >= 999_950) return strip((n / 1e6).toFixed(1)) + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'K'
  return String(Math.round(n))
}

export const full = (n: number) => Math.round(n).toLocaleString('en-US')
/** 11.1 -> "11.1%"; 100 -> "100%". */
export const pct = (p: number) => strip(p.toFixed(1)) + '%'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const d = (iso: string) => new Date(iso)
/** "16 October" */
export const dayMonth = (iso: string) => `${d(iso).getUTCDate()} ${MONTHS[d(iso).getUTCMonth()]}`
/** "16 Oct" */
export const dayMon = (iso: string) => `${d(iso).getUTCDate()} ${MONTHS[d(iso).getUTCMonth()]!.slice(0, 3)}`
/** "26 Oct 2026" */
export const dayMonYear = (iso: string) => `${dayMon(iso)} ${d(iso).getUTCFullYear()}`
/** "26 October 2026" */
export const dayMonthYear = (iso: string) => `${dayMonth(iso)} ${d(iso).getUTCFullYear()}`

/** "winnerman", "kojo-blak": the artist's part of a report address. */
export const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
