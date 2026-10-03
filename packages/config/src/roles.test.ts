import { describe, expect, it } from 'vitest'
import { hasRole, isStaff, type StaffRole } from './roles'

describe('staff roles', () => {
  it('treats no roles as not staff', () => {
    expect(isStaff([])).toBe(false)
    expect(hasRole([], 'reviewer')).toBe(false)
  })
  it('reviewer only does reviewer things', () => {
    expect(hasRole(['reviewer'], 'reviewer')).toBe(true)
    expect(hasRole(['reviewer'], 'finance')).toBe(false)
    expect(hasRole(['reviewer'], 'admin')).toBe(false)
  })
  it('finance does everything a reviewer does, plus money', () => {
    expect(hasRole(['finance'], 'reviewer')).toBe(true)
    expect(hasRole(['finance'], 'finance')).toBe(true)
    expect(hasRole(['finance'], 'admin')).toBe(false)
  })
  it('admin does everything', () => {
    for (const r of ['reviewer', 'finance', 'admin'] as StaffRole[])
      expect(hasRole(['admin'], r)).toBe(true)
  })
  it('ignores unknown role strings', () => {
    expect(isStaff(['owner', 'superuser'])).toBe(false)
    expect(hasRole(['owner'], 'reviewer')).toBe(false)
  })
})
