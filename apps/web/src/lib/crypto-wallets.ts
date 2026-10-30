// Where withdrawals are paid (owner requests, 2026-10-08): a crypto wallet or a bank account.
// Crypto is stablecoins only, so a dollar earned is a dollar paid: one coin per dollar. Each option is a
// coin on one network; sending on the wrong network loses the money, so the network is always named.
// Saved and kept on each withdrawal as one string: "USDT|tron|<address>" or "BANK|<country>|<bank>|<account>|<name>".
import { COUNTRY_CODES, countryName } from './countries'

const EVM = /^0x[0-9a-fA-F]{40}$/
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
/** The bytes a base58 string decodes to, or null when it is not base58. */
export function base58Decode(s: string): Uint8Array | null {
  if (!s) return null
  let n = 0n
  for (const ch of s) {
    const v = B58.indexOf(ch)
    if (v < 0) return null
    n = n * 58n + BigInt(v)
  }
  const bytes: number[] = []
  while (n > 0n) {
    bytes.unshift(Number(n % 256n))
    n /= 256n
  }
  for (const ch of s) {
    if (ch !== '1') break
    bytes.unshift(0)
  }
  return Uint8Array.from(bytes)
}
/** A Solana address is base58 for exactly 32 bytes; anything else (an 0x address included) is refused. */
const SOLANA = { test: (a: string) => base58Decode(a)?.length === 32 }
const EVM_TX = /^0x[0-9a-fA-F]{64}$/
const HEX_TX = /^[0-9a-fA-F]{64}$/
const SOLANA_TX = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/

// Offered to clippers (owner request, 2026-10-30): USDC on Solana or BEP-20, and USDT on Solana, BEP-20 or
// TRC-20. The other networks stay readable for wallets and withdrawals saved before, but are not offered.
const OFFERED = ['USDC|solana', 'USDC|bsc', 'USDT|solana', 'USDT|bsc', 'USDT|tron']

export const CRYPTO_WALLETS = [
  {
    id: 'USDT|tron',
    coin: 'USDT',
    network: 'Tron (TRC-20)',
    address: TRON,
    tx: HEX_TX,
    explorer: 'https://tronscan.org/#/transaction/',
  },
  {
    id: 'USDT|ethereum',
    coin: 'USDT',
    network: 'Ethereum (ERC-20)',
    address: EVM,
    tx: EVM_TX,
    explorer: 'https://etherscan.io/tx/',
  },
  {
    id: 'USDT|bsc',
    coin: 'USDT',
    network: 'BNB Smart Chain (BEP-20)',
    address: EVM,
    tx: EVM_TX,
    explorer: 'https://bscscan.com/tx/',
  },
  {
    id: 'USDT|solana',
    coin: 'USDT',
    network: 'Solana',
    address: SOLANA,
    tx: SOLANA_TX,
    explorer: 'https://solscan.io/tx/',
  },
  {
    id: 'USDC|bsc',
    coin: 'USDC',
    network: 'BNB Smart Chain (BEP-20)',
    address: EVM,
    tx: EVM_TX,
    explorer: 'https://bscscan.com/tx/',
  },
  {
    id: 'USDC|ethereum',
    coin: 'USDC',
    network: 'Ethereum (ERC-20)',
    address: EVM,
    tx: EVM_TX,
    explorer: 'https://etherscan.io/tx/',
  },
  {
    id: 'USDC|polygon',
    coin: 'USDC',
    network: 'Polygon',
    address: EVM,
    tx: EVM_TX,
    explorer: 'https://polygonscan.com/tx/',
  },
  {
    id: 'USDC|solana',
    coin: 'USDC',
    network: 'Solana',
    address: SOLANA,
    tx: SOLANA_TX,
    explorer: 'https://solscan.io/tx/',
  },
].map((w) => ({ ...w, label: `${w.coin} on ${w.network}`, offered: OFFERED.includes(w.id) }))

const OFFERED_WALLETS = CRYPTO_WALLETS.filter((w) => w.offered)
export const COINS = [...new Set(OFFERED.map((id) => id.split('|')[0]!))]
/** The networks a clipper can pick for a coin, in the order they are offered. */
export const networksFor = (coin: string) =>
  OFFERED.map((id) => OFFERED_WALLETS.find((w) => w.id === id)!).filter((w) => w.coin === coin)

export const walletOption = (id: string) => CRYPTO_WALLETS.find((w) => w.id === id) ?? null

/** "USDT|tron|T..." from a coin-and-network choice and an address, or null when the address is wrong. */
export function walletDestination(id: string, rawAddress: string): string | null {
  const w = walletOption(id)
  if (w && !w.offered) return null
  const address = rawAddress.trim()
  if (!w || !w.address.test(address)) return null
  return `${w.id}|${address}`
}

export function parseDestination(destination: string | null | undefined) {
  const parts = (destination ?? '').split('|')
  if (parts.length !== 3) return null
  const w = walletOption(`${parts[0]}|${parts[1]}`)
  return w ? { option: w, address: parts[2]! } : null
}

export type BankDetails = {
  country: string
  bankName: string
  accountNumber: string
  name: string
  /** UK accounts only: the 6-digit sort code (owner request, 2026-10-29). */
  sortCode?: string
  /** The account holder's address, asked for in the US, the UK and other tier 1 countries (2026-10-30). */
  address?: string
  city?: string
  postalCode?: string
  /** Optional. */
  state?: string
}

/**
 * Where the account holder's address is asked for (owner request, 2026-10-30: the US, the UK "and any
 * tier 1 country"): the US, Canada, the UK, Ireland, Australia, New Zealand and Western and Northern Europe.
 */
export const ADDRESS_COUNTRIES = [
  'US',
  'CA',
  'GB',
  'IE',
  'AU',
  'NZ',
  'DE',
  'FR',
  'NL',
  'BE',
  'LU',
  'AT',
  'CH',
  'DK',
  'SE',
  'NO',
  'FI',
  'IS',
] as const
export const needsAddress = (country: string) =>
  (ADDRESS_COUNTRIES as readonly string[]).includes(country.trim().toUpperCase())

const POSTAL: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/,
  CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/,
}
/** The postal code in its usual form, or null when it cannot be one for that country. */
export function cleanPostalCode(country: string, raw: string) {
  const v = raw.trim().toUpperCase().replace(/\s+/g, ' ')
  return (POSTAL[country] ?? /^[A-Z0-9][A-Z0-9 -]{1,9}$/).test(v) ? v : null
}

const clean = (s: string) =>
  s
    .replace(/[|\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * "BANK|<country>|<bank>|<account>|<name>" from the creator's bank details, or the field that is wrong.
 * The account number keeps letters and digits only (an IBAN or a local account number). A UK account
 * also needs its sort code, kept as 6 digits at the end: "BANK|GB|<bank>|<account>|<name>|<sort code>".
 */
export function bankDestination(
  b: BankDetails,
): { ok: true; destination: string } | { ok: false; field: keyof BankDetails } {
  const country = b.country.trim().toUpperCase()
  if (!(COUNTRY_CODES as readonly string[]).includes(country)) return { ok: false, field: 'country' }
  const bankName = clean(b.bankName)
  if (bankName.length < 2 || bankName.length > 100) return { ok: false, field: 'bankName' }
  const uk = country === 'GB'
  const sortCode = (b.sortCode ?? '').replace(/[\s-]/g, '')
  if (uk && !/^\d{6}$/.test(sortCode)) return { ok: false, field: 'sortCode' }
  const accountNumber = b.accountNumber.replace(/[\s-]/g, '').toUpperCase()
  // A UK account number is 8 digits; an IBAN (GB...) is accepted too, as before.
  if (uk ? !/^(\d{8}|GB\d{2}[A-Z]{4}\d{14})$/.test(accountNumber) : !/^[A-Z0-9]{4,34}$/.test(accountNumber))
    return { ok: false, field: 'accountNumber' }
  const name = clean(b.name)
  if (name.length < 2 || name.length > 120) return { ok: false, field: 'name' }
  const parts = ['BANK', country, bankName, accountNumber, name]
  if (!needsAddress(country)) return { ok: true, destination: (uk ? [...parts, sortCode] : parts).join('|') }
  // With an address the string always has 10 parts: the sort code's place stays, empty outside the UK.
  const address = clean(b.address ?? '')
  if (address.length < 3 || address.length > 200) return { ok: false, field: 'address' }
  const city = clean(b.city ?? '')
  if (city.length < 2 || city.length > 100) return { ok: false, field: 'city' }
  const postalCode = cleanPostalCode(country, b.postalCode ?? '')
  if (!postalCode) return { ok: false, field: 'postalCode' }
  const state = clean(b.state ?? '').slice(0, 100)
  return {
    ok: true,
    destination: [...parts, uk ? sortCode : '', address, city, postalCode, state].join('|'),
  }
}

export function parseBank(destination: string | null | undefined): BankDetails | null {
  const parts = (destination ?? '').split('|')
  if (parts[0] !== 'BANK' || ![5, 6, 10].includes(parts.length)) return null
  const b: BankDetails = { country: parts[1]!, bankName: parts[2]!, accountNumber: parts[3]!, name: parts[4]! }
  if (parts[5]) b.sortCode = parts[5]
  if (parts.length === 10) {
    b.address = parts[6]
    b.city = parts[7]
    b.postalCode = parts[8]
    if (parts[9]) b.state = parts[9]
  }
  return b
}

/** "1 High Street, London, SW1A 1AA" */
export function bankAddress(b: BankDetails) {
  return b.address ? [b.address, b.city, b.state, b.postalCode].filter(Boolean).join(', ') : null
}

/** "20-82-93" */
export const formatSortCode = (s: string) => s.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3')

/** Which withdrawal method a saved destination pays with. */
export function methodOf(destination: string | null | undefined): 'crypto' | 'bank_transfer' | null {
  return parseDestination(destination) ? 'crypto' : parseBank(destination) ? 'bank_transfer' : null
}

/** Short form for screens: "USDT on Tron (TRC-20), TQn9Y2…bLSE" or "Bank transfer, Chase, ending 6789". */
export function describeDestination(destination: string | null | undefined) {
  const d = parseDestination(destination)
  if (d) {
    const a = d.address
    return `${d.option.label}, ${a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a}`
  }
  const b = parseBank(destination)
  if (b) return `Bank transfer, ${b.bankName}, ending ${b.accountNumber.slice(-4)} (${countryName(b.country)})`
  return null
}

/**
 * What staff paste after paying: the transaction hash for crypto (checked against the network's
 * format) or the bank's transfer reference.
 */
export function validTransaction(destination: string, reference: string) {
  const d = parseDestination(destination)
  if (d) return d.option.tx.test(reference.trim())
  return !!parseBank(destination) && reference.trim().length >= 3 && reference.trim().length <= 100
}

export function explorerLink(destination: string | null | undefined, hash: string | null | undefined) {
  const d = parseDestination(destination)
  return d && hash ? `${d.option.explorer}${hash}` : null
}

/** Everything staff need to pay, for finance and admins only. */
export function fullDestination(destination: string) {
  const d = parseDestination(destination)
  if (d) return `${d.option.label}, ${d.address}`
  const b = parseBank(destination)
  if (b)
    return `Bank transfer in ${countryName(b.country)}: ${b.bankName}, ${b.sortCode ? `sort code ${formatSortCode(b.sortCode)}, ` : ''}account ${b.accountNumber}, name ${b.name}${b.address ? `, address ${bankAddress(b)}` : ''}`
  return 'none yet'
}
