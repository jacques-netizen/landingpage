// Where withdrawals are paid (owner requests, 2026-10-08): a crypto wallet or a bank account.
// Crypto is stablecoins only, so a dollar earned is a dollar paid: one coin per dollar. Each option is a
// coin on one network; sending on the wrong network loses the money, so the network is always named.
// Saved and kept on each withdrawal as one string: "USDT|tron|<address>" or "BANK|<country>|<bank>|<account>|<name>".
import { COUNTRY_CODES, countryName } from './countries'

const EVM = /^0x[0-9a-fA-F]{40}$/
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const EVM_TX = /^0x[0-9a-fA-F]{64}$/
const HEX_TX = /^[0-9a-fA-F]{64}$/
const SOLANA_TX = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/

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
].map((w) => ({ ...w, label: `${w.coin} on ${w.network}` }))

export const COINS = [...new Set(CRYPTO_WALLETS.map((w) => w.coin))]
export const networksFor = (coin: string) => CRYPTO_WALLETS.filter((w) => w.coin === coin)

export const walletOption = (id: string) => CRYPTO_WALLETS.find((w) => w.id === id) ?? null

/** "USDT|tron|T..." from a coin-and-network choice and an address, or null when the address is wrong. */
export function walletDestination(id: string, rawAddress: string): string | null {
  const w = walletOption(id)
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

export type BankDetails = { country: string; bankName: string; accountNumber: string; name: string }

const clean = (s: string) =>
  s
    .replace(/[|\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * "BANK|<country>|<bank>|<account>|<name>" from the creator's bank details, or the field that is wrong.
 * The account number keeps letters and digits only (an IBAN or a local account number).
 */
export function bankDestination(
  b: BankDetails,
): { ok: true; destination: string } | { ok: false; field: keyof BankDetails } {
  const country = b.country.trim().toUpperCase()
  if (!(COUNTRY_CODES as readonly string[]).includes(country)) return { ok: false, field: 'country' }
  const bankName = clean(b.bankName)
  if (bankName.length < 2 || bankName.length > 100) return { ok: false, field: 'bankName' }
  const accountNumber = b.accountNumber.replace(/[\s-]/g, '').toUpperCase()
  if (!/^[A-Z0-9]{4,34}$/.test(accountNumber)) return { ok: false, field: 'accountNumber' }
  const name = clean(b.name)
  if (name.length < 2 || name.length > 120) return { ok: false, field: 'name' }
  return { ok: true, destination: ['BANK', country, bankName, accountNumber, name].join('|') }
}

export function parseBank(destination: string | null | undefined): BankDetails | null {
  const parts = (destination ?? '').split('|')
  if (parts[0] !== 'BANK' || parts.length !== 5) return null
  return { country: parts[1]!, bankName: parts[2]!, accountNumber: parts[3]!, name: parts[4]! }
}

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
  if (b) return `Bank transfer in ${countryName(b.country)}: ${b.bankName}, account ${b.accountNumber}, name ${b.name}`
  return 'none yet'
}
