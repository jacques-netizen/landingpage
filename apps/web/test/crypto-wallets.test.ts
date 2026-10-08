import { describe, expect, it } from 'vitest'
import {
  describeDestination,
  explorerLink,
  parseDestination,
  validTransaction,
  walletDestination,
} from '../src/lib/crypto-wallets'

const TRON = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'
const EVM = '0x52908400098527886E0F7030069857D2E4169EE7'
const SOL = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV'

describe('crypto wallets', () => {
  it('accepts an address only on a network it belongs to', () => {
    expect(walletDestination('USDT|tron', TRON)).toBe(`USDT|tron|${TRON}`)
    expect(walletDestination('USDT|tron', EVM)).toBeNull()
    expect(walletDestination('USDC|polygon', ` ${EVM} `)).toBe(`USDC|polygon|${EVM}`)
    expect(walletDestination('USDC|solana', SOL)).toBe(`USDC|solana|${SOL}`)
    expect(walletDestination('USDC|solana', '0xabc')).toBeNull()
    expect(walletDestination('BTC|bitcoin', TRON)).toBeNull()
  })

  it('reads a saved wallet back and shortens it for screens', () => {
    expect(parseDestination(`USDT|tron|${TRON}`)?.address).toBe(TRON)
    expect(describeDestination(`USDT|tron|${TRON}`)).toBe('USDT on Tron (TRC-20), TQn9Y2…bLSE')
    expect(describeDestination('garbage')).toBeNull()
  })

  it('checks the transaction hash format for the network and links to the explorer', () => {
    const evmHash = `0x${'a'.repeat(64)}`
    expect(validTransaction(`USDC|ethereum|${EVM}`, evmHash)).toBe(true)
    expect(validTransaction(`USDC|ethereum|${EVM}`, 'a'.repeat(64))).toBe(false)
    expect(validTransaction(`USDT|tron|${TRON}`, 'b'.repeat(64))).toBe(true)
    expect(explorerLink(`USDT|tron|${TRON}`, 'b'.repeat(64))).toBe(
      `https://tronscan.org/#/transaction/${'b'.repeat(64)}`,
    )
  })
})

describe('bank details', () => {
  const ok = { country: 'us', bankName: ' Chase  Bank ', accountNumber: '1234 5678-9', name: 'Kymen Carter' }
  it('saves clean bank details and refuses wrong fields', async () => {
    const { bankDestination, parseBank, describeDestination, methodOf, validTransaction } =
      await import('../src/lib/crypto-wallets')
    const r = bankDestination(ok)
    expect(r).toEqual({ ok: true, destination: 'BANK|US|Chase Bank|123456789|Kymen Carter' })
    expect(bankDestination({ ...ok, country: 'ZZ' })).toEqual({ ok: false, field: 'country' })
    expect(bankDestination({ ...ok, accountNumber: '12' })).toEqual({ ok: false, field: 'accountNumber' })
    expect(bankDestination({ ...ok, name: 'K|C' })).toMatchObject({ ok: true })
    const dest = 'BANK|US|Chase Bank|123456789|Kymen Carter'
    expect(parseBank(dest)).toEqual({
      country: 'US',
      bankName: 'Chase Bank',
      accountNumber: '123456789',
      name: 'Kymen Carter',
    })
    expect(describeDestination(dest)).toBe('Bank transfer, Chase Bank, ending 6789 (United States)')
    expect(methodOf(dest)).toBe('bank_transfer')
    expect(validTransaction(dest, 'WIRE-2026-001')).toBe(true)
    expect(validTransaction(dest, '')).toBe(false)
  })
})
