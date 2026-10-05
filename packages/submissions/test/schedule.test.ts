import { describe, expect, it } from 'vitest'
import { nextCheckAt } from '../src'

const iv = { first_72h_hours: 2, until_close_hours: 12, keep_live_hours: 24 }
const t = (iso: string) => new Date(iso)
const submittedAt = t('2026-10-01T00:00:00Z')
const open = { closedAt: null, keepLiveDays: 30 }

describe('view check schedule', () => {
  it('checks every 2 hours for the first 72 hours', () =>
    expect(nextCheckAt({ state: 'earning', submittedAt }, open, iv, t('2026-10-02T10:00:00Z'))).toEqual(
      t('2026-10-02T12:00:00Z'),
    ))
  it('then every 12 hours until the campaign closes', () =>
    expect(nextCheckAt({ state: 'earning', submittedAt }, open, iv, t('2026-10-05T00:00:00Z'))).toEqual(
      t('2026-10-05T12:00:00Z'),
    ))
  it('then daily through the keep-live window, then stops', () => {
    const closed = { closedAt: t('2026-10-10T00:00:00Z'), keepLiveDays: 30 }
    expect(nextCheckAt({ state: 'final', submittedAt }, closed, iv, t('2026-10-20T00:00:00Z'))).toEqual(
      t('2026-10-21T00:00:00Z'),
    )
    expect(nextCheckAt({ state: 'paid_out', submittedAt }, closed, iv, t('2026-11-09T00:00:01Z'))).toBeNull()
  })
  it('follows the settings', () =>
    expect(
      nextCheckAt({ state: 'approved', submittedAt }, open, { ...iv, first_72h_hours: 1 }, t('2026-10-01T05:00:00Z')),
    ).toEqual(t('2026-10-01T06:00:00Z')))
  it('stops for rejected and removed posts', () => {
    for (const state of ['rejected_auto', 'rejected', 'removed'])
      expect(nextCheckAt({ state, submittedAt }, open, iv, t('2026-10-01T05:00:00Z'))).toBeNull()
  })
})
