import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { env } from '@mde/config'
import { dayMon, full, pct, short } from '@/reports/format'
import { checkWriting, type RuleProblem } from '@/reports/rules'
import {
  applyChanges,
  PLATFORM_NAMES,
  ReportChanges,
  type ReportData,
  type ReportKind,
  type ReportSpec,
} from '@/reports/spec'

// Claude writes a report's words when it is created and changes them when staff type an instruction
// (owner brief, 2026-10-26). It answers with structured changes to the report's spec, never HTML; the
// changes are checked against the writing rules and the campaign's numbers before anything is saved.

const MODEL = 'claude-opus-5-5'

export class ReportWriteError extends Error {
  constructor(
    message: string,
    readonly problems: RuleProblem[] = [],
  ) {
    super(message)
  }
}

export const claudeConfigured = () => !!env().ANTHROPIC_API_KEY

const SYSTEM = `You write and edit client reports for Maison d'Élites, a music marketing agency that pays pages on TikTok and Instagram to post clips of an artist's song. A report goes to the artist's team. It has a cover, a summary, results, results by platform, top clips, what we learned, a plan for the coming weeks (weekly reports only) and a sign-off.

You never write HTML. You answer with changes to the report's spec as JSON. Give a part only when you change it, and give that part whole; set every part you leave alone to null. Always fill "note" with one short line saying what changed.

The numbers on the page (tiles, bars, rings, tables) come from the app. Your words sit around them. Every number you write must come from the campaign data given to you, written as the data gives it (91K, 9.8K, 1.6M, 11.1%, 1,000), or from the staff instruction. Never invent a number, a count, a page, a country, a claim or a quote. If a value is missing from the data, leave it out. Never write a placeholder.

Writing rules:
- Plain, short sentences. Neutral English that reads right in the UK and the US.
- No em dashes or en dashes. No hyphen with spaces around it. Use full stops and commas.
- Never use the pattern "X, not Y" or "not X but Y".
- No corny lines, no hype, no exclamation marks, no AI phrases (delve, testament, unlock, elevate, seamless, journey, landscape, game changer and the like).
- No hedging and no disclaimers that are not in the data.
- Mark the one or two phrases that matter in a sentence with **double asterisks**; they show in bold. Use bold sparingly, as the examples do.
- Headings ("statement") are one or two short sentences.
- Summary facts: up to three, each a short key ("Went live", "Posts", "Pages"), a short value ("16 October", "43 submitted", "7 posting") and one sentence.
- Lessons: up to four, each with a short value ("6 of 6", "Over 50%", "173 · 107"), a short label, a title and one or two sentences.
- Plan steps (weekly reports): short titles, a sentence or two each, an optional list, an optional tag line such as the artist's handle. Only what the staff instruction or the data supports.
- "next": up to four short items the next weekly report will show.
- clips.order is the submission ids of the clips to show, best first, up to six. clips.shareCount is how many of the first clips the share ring adds up; clips.share is the sentence beside it.

Two finished reports in the house style, for tone and length:

Weekly (Winnerman, week 1): cover line "After 10 days live, the campaign has delivered **91K views** and **9.8K likes** on TikTok, with an **11.1% engagement rate**." Summary heading "Strong engagement. The next phase is about reach." Summary text "That is roughly 9% of the 1M views the budget covers, so **the next phase is about adding many more pages to speed up delivery.**" Facts: Went live / 16 October / 10 days live at the time of this report. Posts / 43 submitted / 32 approved and 11 being checked. Pages / 7 posting / All on TikTok so far. Results heading "People are doing more than watching." Results text "Views and engagement are strong for the number of pages posting. **About 1 in 9 viewers liked a post.**" Top clips heading "The two best clips each passed 17K views." Share "Both came from **@dk_baj**, with a like rate near 20%, about double the campaign average. **Together they make up 38% of all views.**" Learned heading "The songs work with this audience. The challenge now is reach." Lesson: 16 Oct / Launch day / Early posts did best / The biggest clips went up on launch day. **Fresh posts on new pages are the fastest way to get more of these.** Plan heading "From the launch phase into the main push." Plan steps: "Share what works: New pages get the top clips as examples, so their first posts follow the formats that already pulled 17K views." "Keep checking quality: Every post is reviewed before it counts, and fake views are never paid for."

Final (Marrz): cover line "The campaign delivered **1.6M views**, **163.7K likes** and **6.5K shares** across TikTok and Instagram, with a **10.4% engagement rate**." Summary heading "The campaign is complete." Results heading "1.6M views from 59 approved posts." By platform heading "TikTok brought the most posts. Instagram brought the most views per post." Top clips heading "The top clip passed 500K views with 74K likes." Share "The four best clips together made **1.3M views**, **about 80% of the campaign total.**" Lesson: 13 → 44% / Instagram posts and share of views / Instagram punches above its weight / Instagram had 13 posts but 44% of the views, **almost three times the average per post on TikTok.**`

/** The campaign's figures as the report writes them, for the prompt. */
function describe(data: ReportData, kind: ReportKind, weekNumber: number | null) {
  const t = data.totals
  const total = data.platforms.reduce((s, p) => s + p.views, 0)
  return {
    report: kind === 'week' ? `Weekly report, week ${weekNumber ?? 1}` : 'Final report',
    campaign: data.campaign.title,
    wentLive: data.campaign.startAt ? dayMon(data.campaign.startAt) : null,
    complete: data.campaign.complete,
    closed: data.campaign.closedAt ? dayMon(data.campaign.closedAt) : null,
    reportDate: dayMon(data.asOf),
    daysLive: data.daysLive,
    views: short(t.views),
    likes: short(t.likes),
    comments: short(t.comments),
    shares: t.shares === null ? 'not given by the platforms' : short(t.shares),
    engagementRate: t.engagementPct === null ? null : pct(t.engagementPct),
    postsSubmitted: data.posts.submitted,
    postsApproved: data.posts.approved,
    postsBeingChecked: data.posts.pending,
    pagesPosting: data.pages,
    minimumViewsToCount: data.campaign.minViewsToEarn ? full(data.campaign.minViewsToEarn) : null,
    viewGoal: data.goal.viewGoal ? short(data.goal.viewGoal) : null,
    progressTowardViewGoal: data.goal.viewPct === null ? null : pct(data.goal.viewPct),
    budgetDelivered: data.goal.deliveredPct === null ? null : pct(data.goal.deliveredPct),
    platforms: data.platforms.map((p) => ({
      platform: PLATFORM_NAMES[p.platform] ?? p.platform,
      views: short(p.views),
      posts: p.posts,
      averagePerPost: p.posts ? short(p.views / p.posts) : null,
      shareOfViews: total ? `${Math.round((p.views / total) * 100)}%` : null,
    })),
    clips: data.clips.map((c) => ({
      id: c.id,
      page: `@${c.handle}`,
      platform: PLATFORM_NAMES[c.platform] ?? c.platform,
      views: full(c.views),
      likes: full(c.likes),
      comments: full(c.comments),
      shares: c.shares === null ? null : full(c.shares),
      likeRate: c.views ? pct((c.likes / c.views) * 100) : null,
      posted: c.postedAt ? dayMon(c.postedAt) : null,
      followers: c.followers === null ? null : short(c.followers),
      shareOfAllViews: t.views ? pct((c.views / t.views) * 100) : null,
    })),
  }
}

/** Keep what Claude sent inside what the page can show. */
function tidy(spec: ReportSpec, data: ReportData): ReportSpec {
  const known = new Set(data.clips.map((c) => c.id))
  const order = [...new Set(spec.clips.order.filter((id) => known.has(id)))].slice(0, 6)
  const shown = order.length || Math.min(6, data.clips.length)
  return {
    ...spec,
    summary: { ...spec.summary, facts: spec.summary.facts.slice(0, 3) },
    clips: { ...spec.clips, order, shareCount: Math.max(0, Math.min(spec.clips.shareCount, shown)) },
    learned: { ...spec.learned, lessons: spec.learned.lessons.slice(0, 4) },
    plan: { ...spec.plan, next: spec.plan.next.slice(0, 4) },
  }
}

/**
 * Ask Claude to write the report (no instruction) or to make one change. Returns the new spec and the
 * line for the version history. Throws ReportWriteError when Claude is not set up, refuses, or keeps
 * breaking the writing rules.
 */
export async function writeWithClaude(input: {
  data: ReportData
  kind: ReportKind
  weekNumber: number | null
  spec: ReportSpec
  instruction: string | null
  /** Everything staff typed on this report so far: numbers in it may be used. */
  typed: string[]
}): Promise<{ spec: ReportSpec; note: string }> {
  const key = env().ANTHROPIC_API_KEY
  if (!key) throw new ReportWriteError('Claude is not set up. Add ANTHROPIC_API_KEY to the web service in Railway.')
  const client = new Anthropic({ apiKey: key })
  const ask = input.instruction
    ? `Make this change to the report, and nothing else: ${input.instruction}`
    : 'Write every part of the report from the data: the cover line, every heading and text, the facts, the clips to show and their share sentence, the lessons and, for a weekly report, a plan. Keep the section switches as they are.'
  const base = [
    `Campaign data:\n${JSON.stringify(describe(input.data, input.kind, input.weekNumber), null, 1)}`,
    `The report's spec now:\n${JSON.stringify(input.spec, null, 1)}`,
    input.typed.length
      ? `What staff have asked for on this report so far:\n${input.typed.map((x) => `- ${x}`).join('\n')}`
      : '',
    ask,
  ]
    .filter(Boolean)
    .join('\n\n')

  let problems: RuleProblem[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = problems.length
      ? `${base}\n\nYour last answer broke these rules. Fix them and answer again:\n${problems.map((p) => `- ${p.where} ${p.problem}`).join('\n')}`
      : base
    let res
    try {
      res = await client.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        messages: [{ role: 'user', content }],
        output_config: { effort: 'medium', format: zodOutputFormat(ReportChanges) },
      })
    } catch (err) {
      console.error(JSON.stringify({ level: 'error', msg: 'claude report call failed', err: String(err) }))
      throw new ReportWriteError('Claude could not be reached. Try again in a minute.')
    }
    if (res.stop_reason === 'refusal') throw new ReportWriteError('Claude declined this instruction.')
    const changes = res.parsed_output
    if (!changes) throw new ReportWriteError('Claude sent back something that could not be read. Try again.')
    const next = tidy(applyChanges(input.spec, changes), input.data)
    problems = checkWriting(next, input.data, input.instruction ? [...input.typed, input.instruction] : input.typed)
    if (!problems.length) return { spec: next, note: changes.note.trim() || (input.instruction ?? 'Written by Claude') }
  }
  throw new ReportWriteError('The new text broke the writing rules twice, so nothing was saved.', problems)
}
