import { describe, expect, it } from 'vitest'
import { hashPassword, normaliseUsername, USERNAME_RULE, verifyPassword } from '../src/server/passwords'

describe('passwords', () => {
  it('verifies the right password and refuses a wrong one', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(stored).not.toContain('correct horse')
    expect(await verifyPassword('correct horse battery', stored)).toBe(true)
    expect(await verifyPassword('correct horse batterz', stored)).toBe(false)
  })

  it('never accepts a password for an account without one', async () => {
    expect(await verifyPassword('anything', null)).toBe(false)
    expect(await verifyPassword('anything', 'garbage')).toBe(false)
  })

  it('gives two hashes of one password different salts', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'))
  })
})

describe('usernames', () => {
  it('accepts simple handles and refuses the rest', () => {
    for (const ok of ['kymen', 'sam_99', 'a.b.c', 'abc']) expect(USERNAME_RULE.test(ok), ok).toBe(true)
    for (const bad of ['ab', '_sam', 'sam!', 'a'.repeat(21), 'with space', 'Ünïcode'])
      expect(USERNAME_RULE.test(bad), bad).toBe(false)
  })

  it('drops a leading @ and lowercases', () => {
    expect(normaliseUsername('  @Kymen ')).toBe('kymen')
  })
})
