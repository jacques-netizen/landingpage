import { describe, expect, it } from 'vitest'
import { formText, isId } from '../src/server/input'

// Shared checks for values a browser sends to server actions (2026-11-13).
describe('input checks', () => {
  it('accepts only real record ids', () => {
    expect(isId('3e5fbd06-021f-426e-8a83-1bfc4154824d')).toBe(true)
    expect(isId('3E5FBD06-021F-426E-8A83-1BFC4154824D')).toBe(true)
    for (const bad of ['', 'x', "1' or '1'='1", '3e5fbd06021f426e8a831bfc4154824d', null, 42, { id: 'x' }, ['a']])
      expect(isId(bad)).toBe(false)
  })

  it('trims text and refuses text over the limit', () => {
    const f = new FormData()
    f.set('note', '  hello  ')
    f.set('long', 'a'.repeat(11))
    expect(formText(f, 'note', 10)).toBe('hello')
    expect(formText(f, 'long', 10)).toBeNull()
    expect(formText(f, 'missing', 10)).toBe('')
  })
})
