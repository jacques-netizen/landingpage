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
    expect(walletDestination('USDC|bsc', ` ${EVM} `)).toBe(`USDC|bsc|${EVM}`)
    expect(walletDestination('USDC|solana', SOL)).toBe(`USDC|solana|${SOL}`)
    expect(walletDestination('USDT|solana', SOL)).toBe(`USDT|solana|${SOL}`)
    expect(walletDestination('USDC|solana', '0xabc')).toBeNull()
    expect(walletDestination('BTC|bitcoin', TRON)).toBeNull()
  })

  it('offers USDC on Solana or BEP-20 and USDT on Solana, BEP-20 or TRC-20 only (owner request, 2026-10-30)', async () => {
    const { COINS, networksFor, describeDestination: describe2 } = await import('../src/lib/crypto-wallets')
    expect(COINS).toEqual(['USDC', 'USDT'])
    expect(networksFor('USDC').map((w) => w.id)).toEqual(['USDC|solana', 'USDC|bsc'])
    expect(networksFor('USDT').map((w) => w.id)).toEqual(['USDT|solana', 'USDT|bsc', 'USDT|tron'])
    // Networks no longer offered cannot be saved, but wallets saved on them still read.
    expect(walletDestination('USDC|polygon', EVM)).toBeNull()
    expect(walletDestination('USDT|ethereum', EVM)).toBeNull()
    expect(describe2(`USDC|polygon|${EVM}`)).toBe('USDC on Polygon, 0x5290…9EE7')
  })

  it('takes a Solana address only when it decodes to 32 bytes', async () => {
    const { base58Decode } = await import('../src/lib/crypto-wallets')
    expect(base58Decode(SOL)?.length).toBe(32)
    expect(walletDestination('USDC|solana', SOL.slice(0, -2))).toBeNull()
    expect(walletDestination('USDC|solana', `${SOL}${SOL.slice(0, 6)}`)).toBeNull()
    expect(walletDestination('USDC|solana', EVM)).toBeNull()
    expect(walletDestination('USDC|solana', '1'.repeat(32))).toBe(`USDC|solana|${'1'.repeat(32)}`)
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
  const ok = { country: 'mx', bankName: ' Chase  Bank ', accountNumber: '1234 5678-9', name: 'Kymen Carter' }
  it('saves clean bank details and refuses wrong fields', async () => {
    const { bankDestination, parseBank, describeDestination, methodOf, validTransaction } =
      await import('../src/lib/crypto-wallets')
    const r = bankDestination(ok)
    expect(r).toEqual({ ok: true, destination: 'BANK|MX|Chase Bank|123456789|Kymen Carter' })
    expect(bankDestination({ ...ok, country: 'ZZ' })).toEqual({ ok: false, field: 'country' })
    expect(bankDestination({ ...ok, accountNumber: '12' })).toEqual({ ok: false, field: 'accountNumber' })
    expect(bankDestination({ ...ok, name: 'K|C' })).toMatchObject({ ok: true })
    const dest = 'BANK|MX|Chase Bank|123456789|Kymen Carter'
    expect(parseBank(dest)).toEqual({
      country: 'MX',
      bankName: 'Chase Bank',
      accountNumber: '123456789',
      name: 'Kymen Carter',
    })
    expect(describeDestination(dest)).toBe('Bank transfer, Chase Bank, ending 6789 (Mexico)')
    expect(methodOf(dest)).toBe('bank_transfer')
    expect(validTransaction(dest, 'WIRE-2026-001')).toBe(true)
    expect(validTransaction(dest, '')).toBe(false)
  })

  it('asks for the account holder address in tier 1 countries (owner request, 2026-10-30)', async () => {
    const { bankDestination, parseBank, fullDestination, bankAddress } = await import('../src/lib/crypto-wallets')
    const us = { country: 'US', bankName: 'Chase', accountNumber: '123456789', name: 'Kymen Carter' }
    expect(bankDestination(us)).toEqual({ ok: false, field: 'address' })
    expect(bankDestination({ ...us, address: '1 Main St' })).toEqual({ ok: false, field: 'city' })
    expect(bankDestination({ ...us, address: '1 Main St', city: 'New York', postalCode: '1000' })).toEqual({
      ok: false,
      field: 'postalCode',
    })
    const r = bankDestination({ ...us, address: '1 Main St', city: 'New York', postalCode: '10001', state: 'NY' })
    expect(r).toEqual({ ok: true, destination: 'BANK|US|Chase|123456789|Kymen Carter||1 Main St|New York|10001|NY' })
    const b = parseBank((r as { destination: string }).destination)!
    expect(b).toMatchObject({ country: 'US', address: '1 Main St', city: 'New York', postalCode: '10001', state: 'NY' })
    expect(b.sortCode).toBeUndefined()
    expect(bankAddress(b)).toBe('1 Main St, New York, NY, 10001')
    // The UK keeps its sort code in the same string; the state is optional.
    const uk = bankDestination({
      country: 'GB',
      bankName: 'Monzo',
      sortCode: '208293',
      accountNumber: '12345678',
      name: 'K C',
      address: '1 High Street',
      city: 'London',
      postalCode: 'sw1a 1aa',
    })
    expect(uk).toEqual({ ok: true, destination: 'BANK|GB|Monzo|12345678|K C|208293|1 High Street|London|SW1A 1AA|' })
    expect(fullDestination((uk as { destination: string }).destination)).toContain('sort code 20-82-93')
    // Outside the list, nothing changes.
    expect(bankDestination({ country: 'NG', bankName: 'Opay', accountNumber: '1234567890', name: 'K C' })).toEqual({
      ok: true,
      destination: 'BANK|NG|Opay|1234567890|K C',
    })
  })

  it('needs a 6-digit sort code and an 8-digit account number for a UK account (owner request, 2026-10-29)', async () => {
    const { bankDestination, parseBank, fullDestination, methodOf } = await import('../src/lib/crypto-wallets')
    const uk = {
      country: 'gb',
      bankName: 'Monzo',
      accountNumber: '1234 5678',
      name: 'Kymen Carter',
      address: '1 High Street',
      city: 'London',
      postalCode: 'SW1A 1AA',
    }
    expect(bankDestination(uk)).toEqual({ ok: false, field: 'sortCode' })
    expect(bankDestination({ ...uk, sortCode: '20-82-9' })).toEqual({ ok: false, field: 'sortCode' })
    expect(bankDestination({ ...uk, sortCode: '20-82-93', accountNumber: '1234567' })).toEqual({
      ok: false,
      field: 'accountNumber',
    })
    const r = bankDestination({ ...uk, sortCode: '20-82-93' })
    expect(r).toEqual({
      ok: true,
      destination: 'BANK|GB|Monzo|12345678|Kymen Carter|208293|1 High Street|London|SW1A 1AA|',
    })
    const dest = (r as { destination: string }).destination
    expect(parseBank(dest)).toEqual({
      country: 'GB',
      bankName: 'Monzo',
      accountNumber: '12345678',
      name: 'Kymen Carter',
      sortCode: '208293',
      address: '1 High Street',
      city: 'London',
      postalCode: 'SW1A 1AA',
    })
    expect(methodOf(dest)).toBe('bank_transfer')
    expect(fullDestination(dest)).toBe(
      'Bank transfer in United Kingdom: Monzo, sort code 20-82-93, account 12345678, name Kymen Carter, address 1 High Street, London, SW1A 1AA',
    )
    // A sort code is only asked for, and only kept, on UK accounts.
    expect(bankDestination({ ...ok, sortCode: '208293' })).toEqual({
      ok: true,
      destination: 'BANK|MX|Chase Bank|123456789|Kymen Carter',
    })
  })
})
