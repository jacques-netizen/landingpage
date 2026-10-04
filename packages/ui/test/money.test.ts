import { describe, expect, it } from 'vitest'
import { formatCents, splitCents } from '../src/money'

describe('money display', () => {
  it('formats whole cents as dollars without floating point', () => {
    expect(formatCents(18420)).toBe('$184.20')
    expect(formatCents(5)).toBe('$0.05')
    expect(formatCents(0)).toBe('$0.00')
    expect(formatCents(123456789)).toBe('$1,234,567.89')
    expect(formatCents(-2500)).toBe('-$25.00')
  })

  it('rejects anything that is not whole cents', () => {
    expect(() => splitCents(10.5)).toThrow()
    expect(() => splitCents(Number.NaN)).toThrow()
  })
})
