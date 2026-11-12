import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Music tracking (owner, 2026-11-12): the words a client or staff member reads carry no em or en dashes,
// and the client's Music section never shows spend, rates, CPM or payouts.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const reportView = read('../src/app/r/[token]/report-view.tsx')
const musicSection = reportView.slice(reportView.indexOf('// ---------- Music results'))

describe('music copy', () => {
  it('has no em or en dashes', () => {
    for (const text of [
      musicSection,
      read('../src/app/admin/(nav)/campaigns/[id]/music-tab.tsx'),
      read('../src/app/admin/(nav)/campaigns/[id]/music-forms.tsx'),
      read('../src/app/admin/(nav)/campaigns/[id]/music-actions.ts'),
      read('../../../packages/music/src/metrics.ts'),
      read('../../../packages/music/src/sound-check.ts'),
    ])
      expect(text).not.toMatch(/[–—]/)
  })

  it('keeps money off the client Music section', () => {
    expect(musicSection.length).toBeGreaterThan(1000)
    expect(musicSection).not.toMatch(/cents|cpm|payout|spend|rate/i)
  })
})
