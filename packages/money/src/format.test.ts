import { describe, expect, it } from 'vitest'
import { formatUsd, splitUsd } from './format'

describe('formatUsd', () => {
  it('formats whole cents as dollars with the dollar sign', () => {
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(5)).toBe('$0.05')
    expect(formatUsd(500)).toBe('$5.00')
    expect(formatUsd(123456)).toBe('$1,234.56')
    expect(formatUsd(100000000)).toBe('$1,000,000.00')
  })
  it('handles negatives', () => {
    expect(formatUsd(-250)).toBe('-$2.50')
  })
  it('accepts bigint for amounts above the safe integer range', () => {
    expect(formatUsd(9007199254740993n)).toBe('$90,071,992,547,409.93')
  })
  it('can drop zero cents', () => {
    expect(formatUsd(500, { dropZeroCents: true })).toBe('$5')
    expect(formatUsd(550, { dropZeroCents: true })).toBe('$5.50')
  })
  it('rejects non integer input', () => {
    expect(() => formatUsd(1.5)).toThrow()
    expect(() => formatUsd(Number.NaN)).toThrow()
  })
})

describe('splitUsd', () => {
  it('returns dollars and cents parts for the money display', () => {
    expect(splitUsd(123456)).toEqual({ sign: '', dollars: '$1,234', cents: '.56' })
    expect(splitUsd(-5)).toEqual({ sign: '-', dollars: '$0', cents: '.05' })
  })
})
