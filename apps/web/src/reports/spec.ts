import { z } from 'zod'

// The client report (owner brief, 2026-10-26). The figures come from the app's data (ReportData) and are
// never typed by hand; the words, the sections shown and the clip order are the report's spec, written by
// Claude and edited by staff. Text marks emphasis with **double asterisks**, shown in bold.

export const PLATFORM_NAMES: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
}

export type ReportClipData = {
  /** The submission's id. */
  id: string
  platform: string
  postId: string
  url: string
  /** Without the @. */
  handle: string
  views: number
  likes: number
  comments: number
  /** Null where the platform does not give shares (Instagram). */
  shares: number | null
  postedAt: string | null
  followers: number | null
}

export type ReportData = {
  /** When these figures were read. */
  asOf: string
  campaign: {
    title: string
    startAt: string | null
    closedAt: string | null
    complete: boolean
    coverUrl: string | null
    minViewsToEarn: number
  }
  /** Whole days from going live to asOf (or to the close). Null before it went live. */
  daysLive: number | null
  totals: {
    views: number
    likes: number
    comments: number
    /** Null when no platform in the campaign gives shares. */
    shares: number | null
    /** Likes, comments and shares over views, in percent with one decimal. Null before any view. */
    engagementPct: number | null
  }
  posts: { submitted: number; approved: number; pending: number }
  /** Accounts with a post that counts or is being checked. */
  pages: number
  /** Platforms with approved posts, most views first. */
  platforms: { platform: string; views: number; posts: number }[]
  goal: {
    budgetCents: number
    spentCents: number
    /** Spent over the client's budget, in percent with one decimal, at most 100. */
    deliveredPct: number | null
    /** The views the client's budget buys at the client's rate. */
    viewGoal: number | null
    viewPct: number | null
  }
  /** Approved posts, most views first, up to 24, for the clip wall and the table. */
  clips: ReportClipData[]
}

export const SECTION_KEYS = ['hero', 'summary', 'results', 'platforms', 'clips', 'learned', 'plan', 'signoff'] as const
export type SectionKey = (typeof SECTION_KEYS)[number]
export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: 'Cover',
  summary: 'Summary',
  results: 'Results',
  platforms: 'By platform',
  clips: 'Top clips',
  learned: 'What we learned',
  plan: 'Plan',
  signoff: 'Sign-off',
}

const Fact = z.object({ key: z.string(), value: z.string(), text: z.string() })
const Lesson = z.object({ value: z.string(), label: z.string(), title: z.string(), body: z.string() })
const Step = z.object({
  title: z.string(),
  body: z.string(),
  list: z.array(z.string()),
  tag: z.string().nullable(),
  split: z.object({ a: z.string(), b: z.string(), bPct: z.number().int() }).nullable(),
})
const Show = z.object({
  hero: z.boolean(),
  summary: z.boolean(),
  results: z.boolean(),
  platforms: z.boolean(),
  clips: z.boolean(),
  learned: z.boolean(),
  plan: z.boolean(),
  signoff: z.boolean(),
})
const Hero = z.object({ sub: z.string(), coverAlt: z.string(), coverShape: z.enum(['square', 'tall']) })
const Summary = z.object({ statement: z.string(), body: z.string().nullable(), facts: z.array(Fact) })
const Results = z.object({ statement: z.string(), body: z.string().nullable() })
const Platforms = z.object({ statement: z.string() })
const Clips = z.object({
  statement: z.string(),
  /** The paragraph beside the share ring. */
  share: z.string(),
  /** How many of the first clips the share ring adds up. */
  shareCount: z.number().int(),
  /** Submission ids, in the order shown; empty shows the six with the most views. */
  order: z.array(z.string()),
})
const Learned = z.object({ statement: z.string(), lessons: z.array(Lesson) })
const Plan = z.object({
  statement: z.string(),
  body: z.string().nullable(),
  steps: z.array(Step),
  next: z.array(z.string()),
})

export const ReportSpec = z.object({
  artist: z.string(),
  /** "@winnermanuniverse" on a weekly report's cover; null shows nothing. */
  preparedFor: z.string().nullable(),
  show: Show,
  hero: Hero,
  summary: Summary,
  results: Results,
  platforms: Platforms,
  clips: Clips,
  learned: Learned,
  plan: Plan,
})
export type ReportSpec = z.infer<typeof ReportSpec>

/**
 * What Claude sends back for a new report or an instruction: every part it changes, null for a part it
 * leaves as it is. Never HTML.
 */
export const ReportChanges = z.object({
  /** One short line for the version history: what changed. */
  note: z.string(),
  artist: z.string().nullable(),
  /** "" removes the "Prepared for" line. */
  preparedFor: z.string().nullable(),
  show: Show.nullable(),
  hero: Hero.nullable(),
  summary: Summary.nullable(),
  results: Results.nullable(),
  platforms: Platforms.nullable(),
  clips: Clips.nullable(),
  learned: Learned.nullable(),
  plan: Plan.nullable(),
})
export type ReportChanges = z.infer<typeof ReportChanges>

export function applyChanges(spec: ReportSpec, c: ReportChanges): ReportSpec {
  return {
    artist: c.artist ?? spec.artist,
    preparedFor: c.preparedFor === null ? spec.preparedFor : c.preparedFor.trim() || null,
    show: c.show ?? spec.show,
    hero: c.hero ?? spec.hero,
    summary: c.summary ?? spec.summary,
    results: c.results ?? spec.results,
    platforms: c.platforms ?? spec.platforms,
    clips: c.clips ?? spec.clips,
    learned: c.learned ?? spec.learned,
    plan: c.plan ?? spec.plan,
  }
}

export type ReportKind = 'week' | 'final'

/** The clips a report shows, in its order: the spec's (those still approved), else the six with the most views. */
export function shownClips(data: ReportData, spec: ReportSpec): ReportClipData[] {
  const byId = new Map(data.clips.map((c) => [c.id, c]))
  const picked = spec.clips.order.map((id) => byId.get(id)).filter((c): c is ReportClipData => !!c)
  return (picked.length ? picked : data.clips).slice(0, 6)
}

/** The sections that show: switched on, and with something to show. */
export function visibleSections(data: ReportData, spec: ReportSpec, kind: ReportKind): SectionKey[] {
  return SECTION_KEYS.filter((k) => {
    if (!spec.show[k]) return false
    if (k === 'platforms') return data.platforms.length > 1
    if (k === 'plan') return kind === 'week' && spec.plan.steps.length > 0
    if (k === 'clips') return shownClips(data, spec).length > 0
    if (k === 'learned') return spec.learned.lessons.length > 0
    return true
  })
}
