import { dayMon, dayMonth, full, pct, short } from './format'
import { PLATFORM_NAMES, type ReportData, type ReportKind, type ReportSpec } from './spec'

// A report's first draft, written from its figures alone. Claude rewrites the words when the report is
// created; this draft is what it starts from, and what the report keeps when Claude is not set up.

const name = (p: string) => PLATFORM_NAMES[p] ?? p
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']

/** The artist's name as the campaign's title suggests it: "Davido X Winnerman-Audio" -> "Winnerman". */
export function guessArtist(title: string) {
  const parts = title.split(/\s+x\s+/i)
  return (parts.at(-1) ?? title).replace(/[-\s]*(audio|sound|campaign|song|track)$/i, '').trim() || title
}

export function draftSpec(data: ReportData, kind: ReportKind, artist: string, preparedFor: string | null): ReportSpec {
  const t = data.totals
  const week = kind === 'week'
  const platforms = data.platforms.map((p) => name(p.platform))
  const on = platforms.length ? ` on ${list(platforms)}` : ''
  const facts: ReportSpec['summary']['facts'] = []
  if (data.campaign.startAt)
    facts.push({
      key: 'Went live',
      value: dayMonth(data.campaign.startAt),
      text:
        data.daysLive !== null && week
          ? `${data.daysLive} days live at the time of this report.`
          : `Live for ${data.daysLive ?? 0} days.`,
    })
  facts.push(
    week
      ? {
          key: 'Posts',
          value: `${full(data.posts.submitted)} submitted`,
          text: `${full(data.posts.approved)} approved and ${full(data.posts.pending)} being checked.`,
        }
      : {
          key: 'Posts',
          value: `${full(data.posts.approved)} approved`,
          text: 'Every post was checked before it counted.',
        },
  )
  if (week)
    facts.push({
      key: 'Pages',
      value: `${full(data.pages)} posting`,
      text: platforms.length ? `Posting on ${list(platforms)}.` : '',
    })
  else if (t.engagementPct !== null)
    facts.push({
      key: 'Engagement',
      value: pct(t.engagementPct),
      text: platforms.length ? `Across ${list(platforms)}.` : '',
    })

  const top = data.clips.slice(0, 6)
  const shareCount = Math.min(2, top.length)
  const topViews = top.slice(0, shareCount).reduce((s, c) => s + c.views, 0)
  const sub = [`**${short(t.views)} views**`, `**${short(t.likes)} likes**`]
  if (!week && t.shares !== null) sub.push(`**${short(t.shares)} shares**`)
  const heroSub = week
    ? `${data.daysLive !== null ? `After ${data.daysLive} days live, the` : 'The'} campaign has delivered ${list(sub)}${on}${t.engagementPct !== null ? `, with an **${pct(t.engagementPct)} engagement rate**` : ''}.`
    : `The campaign delivered ${list(sub)}${on}${t.engagementPct !== null ? `, with a **${pct(t.engagementPct)} engagement rate**` : ''}.`

  const lessons: ReportSpec['learned']['lessons'] = []
  if (top[0])
    lessons.push({
      value: short(top[0].views),
      label: 'Views on the top clip',
      title: 'One clip led the campaign',
      body: `The top clip came from **@${top[0].handle}** on ${dayMon(top[0].postedAt ?? data.asOf)}.`,
    })
  if (t.shares !== null && t.shares > 0)
    lessons.push({
      value: `${short(t.shares)} · ${short(t.comments)}`,
      label: 'Shares and comments',
      title: 'The audience reacts',
      body: `${short(t.shares)} shares and ${short(t.comments)} comments show **people are passing the music on.**`,
    })

  return {
    artist,
    preparedFor,
    show: {
      hero: true,
      summary: true,
      results: true,
      platforms: true,
      clips: true,
      learned: true,
      plan: week,
      signoff: true,
    },
    hero: { sub: heroSub, coverAlt: `${artist} campaign cover`, coverShape: week ? 'square' : 'tall' },
    summary: {
      statement: week
        ? 'The campaign is live.'
        : data.campaign.complete
          ? 'The campaign is complete.'
          : 'The campaign so far.',
      body: null,
      facts,
    },
    results: {
      statement: `${short(t.views)} views from ${full(data.posts.approved)} approved posts.`,
      body: null,
    },
    platforms: { statement: platforms.length > 1 ? `${platforms[0]} brought the most views.` : '' },
    clips: {
      statement: top[0] ? `The top clip passed ${short(top[0].views)} views.` : 'The top clips.',
      share: shareCount > 0 ? `The ${WORDS[shareCount]} best clips together made **${short(topViews)} views**.` : '',
      shareCount,
      order: top.map((c) => c.id),
    },
    learned: { statement: 'What the numbers show.', lessons },
    plan: {
      statement: 'The plan for the coming weeks.',
      body: null,
      steps: week
        ? [
            {
              title: 'Keep checking quality',
              body: 'Every post is reviewed before it counts, and fake views are never paid for.',
              list: [],
              tag: null,
              split: null,
            },
            {
              title: 'Report weekly',
              body: 'Next week’s report will show views, new pages and top posts.',
              list: [],
              tag: null,
              split: null,
            },
          ]
        : [],
      next: week ? ['Views', 'New pages', 'Top posts'] : [],
    },
  }
}
