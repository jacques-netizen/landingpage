import { describe, expect, it } from 'vitest'
import { canAccess, REASON_CODES, SETTINGS_DEFAULTS, settingsSchema } from '../src'

describe('roles', () => {
  it('lets any staff role into staff pages, finance and admin into money, admin alone into settings', () => {
    expect(canAccess(['reviewer'], 'staff')).toBe(true)
    expect(canAccess(['reviewer'], 'money')).toBe(false)
    expect(canAccess(['finance'], 'money')).toBe(true)
    expect(canAccess(['finance'], 'admin')).toBe(false)
    expect(canAccess(['admin'], 'admin')).toBe(true)
    expect(canAccess([], 'staff')).toBe(false)
  })
})

describe('settings defaults', () => {
  // The minimum withdrawal is $5 (owner's testing report, 2026-10-08); the rest match 03_SYSTEMS.md section 15.
  it('match 03_SYSTEMS.md section 15 and validate', () => {
    expect(settingsSchema.parse(SETTINGS_DEFAULTS)).toEqual(SETTINGS_DEFAULTS)
    expect(SETTINGS_DEFAULTS).toMatchObject({
      max_linked_accounts: 8,
      max_post_age_hours: 24,
      deleted_post_grace_hours: 48,
      review_window_days: 7,
      withdrawal_min_cents: 500,
      view_check_intervals: { first_72h_hours: 2, until_close_hours: 2, keep_live_hours: 24 },
      withdrawal_fee_bps: 0,
      withdrawal_fee_min_cents: 0,
      appeal_reply_business_days: 5,
      strike_days: 60,
      auto_approve_clean_creators: false,
      require_staff_2fa: true,
    })
  })

  it('reject fractional money', () => {
    expect(() => settingsSchema.shape.withdrawal_min_cents.parse(20.5)).toThrow()
  })
})

describe('reason codes', () => {
  it('has the 21 starting codes from 03_SYSTEMS.md section 5 plus post_limit_reached, with unique ids', () => {
    expect(REASON_CODES).toHaveLength(22)
    expect(new Set(REASON_CODES.map((r) => r[0])).size).toBe(22)
    expect(REASON_CODES.map((r) => r[0])).toContain('post_limit_reached')
  })
})
