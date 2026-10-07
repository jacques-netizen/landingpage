import { describe, expect, it } from 'vitest'
import { shownFigures } from '../src/lib/shown-figures'

const f = { budgetCents: 100_000, leftCents: 40_000, paidCents: 60_000, paidPercent: 60 }

describe('budget shown to creators', () => {
  it('is full with nothing left once the campaign has ended', () => {
    expect(shownFigures('closed', f)).toEqual({ ...f, leftCents: 0, paidPercent: 100 })
  })
  it('is the real figure while the campaign runs', () => {
    for (const s of ['live', 'closing']) expect(shownFigures(s, f)).toBe(f)
  })
})
