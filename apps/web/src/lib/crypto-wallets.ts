// Crypto payouts (owner request, 2026-10-08). Stablecoins only, so a dollar earned is a dollar paid:
// the amount sent is the withdrawal in USD, one coin per dollar. Each option is a coin on one network;
// sending on the wrong network loses the money, so the network is always named next to the coin.

const EVM = /^0x[0-9a-fA-F]{40}$/
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const EVM_TX = /^0x[0-9a-fA-F]{64}$/
const HEX_TX = /^[0-9a-fA-F]{64}$/
const SOLANA_TX = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/

export const CRYPTO_WALLETS = [
  {
    id: 'USDT|tron',
    label: 'USDT on Tron (TRC-20)',
    address: TRON,
    tx: HEX_TX,
    explorer: 'https://tronscan.org/#/transaction/',
  },
  {
    id: 'USDT|ethereum',
    label: 'USDT on Ethereum (ERC-20)',
    address: EVM,
    tx: EVM_TX,
    explorer: 'https://etherscan.io/tx/',
  },
  {
    id: 'USDT|bsc',
    label: 'USDT on BNB Smart Chain (BEP-20)',
    address: EVM,
    tx: EVM_TX,
    explorer: 'https://bscscan.com/tx/',
  },
  {
    id: 'USDC|ethereum',
    label: 'USDC on Ethereum (ERC-20)',
    address: EVM,
    tx: EVM_TX,
    explorer: 'https://etherscan.io/tx/',
  },
  { id: 'USDC|polygon', label: 'USDC on Polygon', address: EVM, tx: EVM_TX, explorer: 'https://polygonscan.com/tx/' },
  { id: 'USDC|solana', label: 'USDC on Solana', address: SOLANA, tx: SOLANA_TX, explorer: 'https://solscan.io/tx/' },
] as const

export type CryptoWalletId = (typeof CRYPTO_WALLETS)[number]['id']

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

/** Short form for screens: "USDT on Tron (TRC-20), TQn9…LSE". */
export function describeDestination(destination: string | null | undefined) {
  const d = parseDestination(destination)
  if (!d) return null
  const a = d.address
  return `${d.option.label}, ${a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a}`
}

/** The transaction hash staff paste after sending, checked against the network's format. */
export function validTransaction(destination: string, hash: string) {
  const d = parseDestination(destination)
  return !!d && d.option.tx.test(hash.trim())
}

export function explorerLink(destination: string | null | undefined, hash: string | null | undefined) {
  const d = parseDestination(destination)
  return d && hash ? `${d.option.explorer}${hash}` : null
}
