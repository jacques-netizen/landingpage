import { describe, expect, it } from 'vitest'
import { draftSpec, guessArtist } from '@/reports/draft'
import { countUp, short } from '@/reports/format'
import { renderReport } from '@/reports/render'
import { checkWriting, staleFlags } from '@/reports/rules'
import { applyChanges, visibleSections, type ReportData, type ReportSpec } from '@/reports/spec'

// Winnerman Week 1 and Marrz Final as the reference reports show them (owner brief, 2026-10-26).
const clip = (
  id: string,
  handle: string,
  platform: string,
  views: number,
  likes: number,
  shares: number | null,
  day: string,
) => ({
  id: `sub-${id}`,
  platform,
  postId: id,
  url:
    platform === 'instagram' ? `https://www.instagram.com/p/${id}/` : `https://www.tiktok.com/@${handle}/video/${id}`,
  handle,
  views,
  likes,
  comments: 5,
  shares,
  postedAt: `2026-10-${day}T12:00:00Z`,
  followers: null,
})

export const winnerman: ReportData = {
  asOf: '2026-10-26T10:00:00Z',
  campaign: {
    title: 'Davido X Winnerman-Audio',
    startAt: '2026-10-16T09:00:00Z',
    closedAt: null,
    complete: false,
    coverUrl: '/files/ep/ep.jpg',
    minViewsToEarn: 1000,
  },
  daysLive: 10,
  totals: { views: 91032, likes: 9812, comments: 107, shares: 173, engagementPct: 11.1 },
  posts: { submitted: 43, approved: 32, pending: 11 },
  pages: 7,
  platforms: [{ platform: 'tiktok', views: 91032, posts: 32 }],
  goal: { budgetCents: 200000, spentCents: 18206, deliveredPct: 9.1, viewGoal: 1_000_000, viewPct: 9.1 },
  clips: [
    clip('7697296279830940944', 'dk_baj', 'tiktok', 17379, 3434, 40, '16'),
    clip('7697383810723286290', 'dk_baj', 'tiktok', 16927, 3274, 38, '16'),
    clip('7697993527162129685', 'lirickoss22', 'tiktok', 4920, 87, 2, '18'),
    clip('7697284834724449558', 'ander_lyrics', 'tiktok', 3771, 335, 4, '16'),
    clip('7697310375837994261', 'lirickoss22', 'tiktok', 2998, 41, 1, '16'),
    clip('7698557012912672021', 'felyrics38', 'tiktok', 2772, 138, 3, '20'),
  ],
}

export const marrz: ReportData = {
  asOf: '2026-10-26T10:00:00Z',
  campaign: {
    title: 'Marrz-Audio',
    startAt: '2026-10-07T09:00:00Z',
    closedAt: '2026-10-26T08:00:00Z',
    complete: true,
    coverUrl: '/files/p/poster.jpg',
    minViewsToEarn: 1000,
  },
  daysLive: 19,
  totals: { views: 1_648_700, likes: 163_700, comments: 1200, shares: 6500, engagementPct: 10.4 },
  posts: { submitted: 59, approved: 59, pending: 0 },
  pages: 20,
  platforms: [
    { platform: 'tiktok', views: 919_300, posts: 46 },
    { platform: 'instagram', views: 729_400, posts: 13 },
  ],
  goal: { budgetCents: 100000, spentCents: 100000, deliveredPct: 100, viewGoal: 500_000, viewPct: 100 },
  clips: [
    clip('7699941567578082591', 'mikhkob_7', 'tiktok', 502965, 74018, 1449, '23'),
    clip('DeZUhxLiDww', 'londonbaithead', 'instagram', 408639, 34532, null, '13'),
    clip('DeZ_L-woWub', 'londonbaithead', 'instagram', 241482, 518, null, '12'),
    clip('7700648487251184903', 'wa7echh', 'tiktok', 166844, 34151, 3807, '25'),
  ],
}

describe('number formats', () => {
  it('writes figures the way the reference reports do', () => {
    expect(short(91032)).toBe('91K')
    expect(short(9812)).toBe('9.8K')
    expect(short(1_648_700)).toBe('1.6M')
    expect(short(163_700)).toBe('163.7K')
    expect(short(107)).toBe('107')
    expect(countUp(9812)).toEqual({ target: '9.8', dec: 1, unit: 'K' })
    expect(countUp(91032)).toEqual({ target: '91', dec: 0, unit: 'K' })
  })
  it('guesses the artist from the campaign title', () => {
    expect(guessArtist('Davido X Winnerman-Audio')).toBe('Winnerman')
    expect(guessArtist('Marrz-Audio')).toBe('Marrz')
  })
})

describe('weekly report', () => {
  const spec = draftSpec(winnerman, 'week', 'Winnerman', '@winnermanuniverse')
  const html = renderReport(winnerman, spec, { kind: 'week', weekNumber: 1, mode: 'web', covers: {} })

  it('lays the cover out like Winnerman Week 1', () => {
    expect(html).toContain('<h1 class="rv d1">Winnerman<span>Week 1 report</span></h1>')
    expect(html).toContain('Campaign Report &middot; 26 Oct 2026')
    expect(html).toContain('<span class="live rv"><i></i>Live since 16 October</span>')
    expect(html).toContain('<div class="rt"><b>9%</b><span>of 1M views</span></div>')
    expect(html).toContain('Prepared for @winnermanuniverse')
    expect(html).toContain("<title>Winnerman &middot; Week 1 Report &middot; Maison d'&Eacute;lites</title>")
  })

  it('shows the figures from the data', () => {
    expect(html).toContain('<div class="bl">Views on TikTok</div>')
    expect(html).toContain('<span class="pv"><b>91K</b> of 1M &middot; roughly <b>9%</b></span>')
    expect(html).toContain(
      '<div class="ticks"><span>0</span><span>250K</span><span>500K</span><span>750K</span><span>1M</span></div>',
    )
    expect(html).toContain('<div class="pk">43 posts submitted</div>')
    expect(html).toContain('32 approved</div><div class="c" data-w="25.6">11 being checked</div>')
    expect(html).toContain('Posts with fewer than 1,000 views, or with signs of fake views, are not counted.')
    expect(html).toContain('<div class="gv">TikTok</div><div class="gl">Platform</div>')
  })

  it('leaves out By platform with one platform, and numbers the sections in order', () => {
    expect(visibleSections(winnerman, spec, 'week')).not.toContain('platforms')
    expect(html).toContain('03 &middot; Top clips')
    expect(html).toContain('05 &middot; Plan for the coming weeks')
    expect(html).toContain('<a href="#s5"><span>The coming weeks</span></a>')
  })

  it('hides a section that is switched off', () => {
    const off = applyChanges(spec, { ...nothing, show: { ...spec.show, learned: false } })
    const h = renderReport(winnerman, off, { kind: 'week', weekNumber: 1, mode: 'web', covers: {} })
    expect(h).not.toContain('What we learned')
    expect(h).toContain('04 &middot; Plan for the coming weeks')
  })

  it('writes every plan step out in the PDF', () => {
    const h = renderReport(winnerman, spec, { kind: 'week', weekNumber: 1, mode: 'print', covers: {} })
    expect(h).toContain('<html lang="en" class="print">')
    expect(h).toContain('Step 1 of 2')
    expect(h).toContain('Step 2 of 2')
  })

  it('drafts text that keeps the writing rules', () => {
    expect(checkWriting(spec, winnerman)).toEqual([])
  })
})

describe('final report', () => {
  const spec = draftSpec(marrz, 'final', 'Marrz', null)
  const html = renderReport(marrz, spec, { kind: 'final', weekNumber: null, mode: 'web', covers: {} })

  it('lays the cover out like Marrz Final', () => {
    expect(html).toContain('<h1 class="rv d1">Marrz<span>Final report</span></h1>')
    expect(html).toContain('Final Report &middot; 26 October 2026')
    expect(html).toContain('Campaign complete</span>')
    expect(html).toContain('<div class="cover-art tall rv d2">')
    expect(html).toContain('<div class="rt"><b>100%</b><span>budget delivered</span></div>')
    expect(html).toContain('7 October to 26 October 2026')
  })

  it('shows the platforms and the final grid', () => {
    expect(html).toContain('<div class="grid four rv d2">')
    expect(html).toContain('<div class="pl">Views &middot; 56% of the total</div>')
    expect(html).toContain('<div>46<small>Posts</small></div><div>20K<small>Avg per post</small></div>')
    expect(html).toContain('<div class="gv">TikTok &amp; Instagram</div><div class="gl">Platforms</div>')
    expect(html).toContain('The full budget, <b>100%</b>')
    expect(html).toContain('<div class="ticks"><span>Live 7 Oct</span><span>Complete 26 Oct</span></div>')
    expect(html).toContain('<button data-m="shares">By shares</button>')
    expect(html).not.toContain('id="steps"')
  })

  it('drafts text that keeps the writing rules', () => {
    expect(checkWriting(spec, marrz)).toEqual([])
  })
})

const nothing = {
  note: '',
  artist: null,
  preparedFor: null,
  show: null,
  hero: null,
  summary: null,
  results: null,
  platforms: null,
  clips: null,
  learned: null,
  plan: null,
}

describe('writing rules', () => {
  const spec = draftSpec(winnerman, 'week', 'Winnerman', null)
  const withStatement = (s: string): ReportSpec =>
    applyChanges(spec, { ...nothing, summary: { ...spec.summary, statement: s } })

  it('refuses dashes, "X, not Y", placeholders and stock phrases', () => {
    expect(checkWriting(withStatement('Strong engagement — now reach.'), winnerman)[0]?.problem).toMatch(/dash/)
    expect(checkWriting(withStatement('It is reach, not engagement.'), winnerman)[0]?.problem).toMatch(/not Y/)
    expect(checkWriting(withStatement('We hit [NUMBER] views.'), winnerman)[0]?.problem).toMatch(/placeholder/)
    expect(checkWriting(withStatement('A testament to the music.'), winnerman)[0]?.problem).toMatch(/stock phrase/)
  })

  it('refuses a number the data does not have, unless staff typed it', () => {
    expect(checkWriting(withStatement('The campaign reached 340,000 fans.'), winnerman)[0]?.problem).toMatch(/340,000/)
    expect(checkWriting(withStatement('The campaign reached 340,000 fans.'), winnerman, ['say 340,000 fans'])).toEqual(
      [],
    )
    expect(checkWriting(withStatement('Strong engagement at 11.1%, with 91K views.'), winnerman)).toEqual([])
    expect(checkWriting(withStatement('The two best clips each passed 17K views.'), winnerman)).toEqual([])
  })
})

describe('stale text on a final report', () => {
  it('flags a sentence whose figure has changed, and leaves the rest', () => {
    const spec = draftSpec(marrz, 'final', 'Marrz', null)
    const now: ReportData = { ...marrz, totals: { ...marrz.totals, views: 1_912_000 } }
    const flags = staleFlags(spec, marrz, now)
    expect(flags.some((f) => f.figure === 'views' && f.was === '1.6M' && f.now === '1.9M')).toBe(true)
    expect(staleFlags(spec, marrz, marrz)).toEqual([])
  })
})
