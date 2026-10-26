import { full, pct, short, shortRound } from './format'
import { shownClips, type ReportData, type ReportSpec } from './spec'

// The report's writing rules (owner brief, 2026-10-26), checked on every version before it is saved:
// no em or en dashes, no "X, not Y", no placeholders, no AI catchphrases or disclaimers, and no number
// that is not in the campaign's data or in what staff typed.

/** Every piece of text in a spec, with where it sits, for the checks and the stale warnings. */
export function textFields(spec: ReportSpec): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = []
  const add = (where: string, text: string | null | undefined) => {
    if (text) out.push({ where, text })
  }
  add('Artist', spec.artist)
  add('Prepared for', spec.preparedFor)
  add('Cover line', spec.hero.sub)
  add('Cover picture description', spec.hero.coverAlt)
  add('Summary heading', spec.summary.statement)
  add('Summary text', spec.summary.body)
  spec.summary.facts.forEach((f, i) => {
    add(`Summary fact ${i + 1}`, f.key)
    add(`Summary fact ${i + 1}`, f.value)
    add(`Summary fact ${i + 1}`, f.text)
  })
  add('Results heading', spec.results.statement)
  add('Results text', spec.results.body)
  add('By platform heading', spec.platforms.statement)
  add('Top clips heading', spec.clips.statement)
  add('Top clips share', spec.clips.share)
  add('What we learned heading', spec.learned.statement)
  spec.learned.lessons.forEach((l, i) => {
    for (const x of [l.value, l.label, l.title, l.body]) add(`Lesson ${i + 1}`, x)
  })
  add('Plan heading', spec.plan.statement)
  add('Plan text', spec.plan.body)
  spec.plan.steps.forEach((s, i) => {
    for (const x of [s.title, s.body, s.tag, s.split?.a, s.split?.b, ...s.list]) add(`Plan step ${i + 1}`, x)
  })
  spec.plan.next.forEach((x, i) => add(`Next report item ${i + 1}`, x))
  return out
}

const BANNED: [RegExp, string][] = [
  [/[—–]/, 'uses an em or en dash'],
  [/\s-{1,2}\s/, 'uses a dash between words'],
  [/,\s*not\s+\w/i, 'uses the "X, not Y" pattern'],
  [/\[[^\]]*\]|\{[^}]*\}|\bTBD\b|\bTODO\b|\bXX+\b|lorem ipsum|placeholder|\binsert\b/i, 'has a placeholder'],
  [
    /\b(delve|testament to|game[- ]changer|tapestry|elevate[sd]?|unlock(?:s|ed|ing)?|seamless(?:ly)?|leverag(?:e|es|ed|ing)|in today's|landscape|synerg(?:y|ies)|buckle up|let's dive|dive in|moving the needle|needle[- ]moving|thrilled|we're excited|excited to share|journey|next level|supercharg\w*|skyrocket\w*|crush(?:ed|ing) it|it's worth noting|at the end of the day|needless to say)\b/i,
    'uses a stock phrase',
  ],
  [
    /\b(disclaimer|results may vary|please note|note that|it is important to note|we cannot guarantee|no guarantee|past performance)\b/i,
    'adds a disclaimer',
  ],
  [/\b(potentially|arguably|perhaps|it seems|somewhat|fairly|quite possibly)\b/i, 'hedges'],
  [/!/, 'uses an exclamation mark'],
]

const NUM = /\d[\d,]*(?:\.\d+)?\s?(?:[KkMm](?![a-zA-Z])|%)?/g
const norm = (s: string) => s.replace(/\s/g, '').replace(/,/g, '').toUpperCase()

/** Every way the report may write a number from the data. */
export function allowedNumbers(data: ReportData, spec: ReportSpec): Set<string> {
  const set = new Set<string>()
  const addN = (n: number | null | undefined) => {
    if (n === null || n === undefined || !Number.isFinite(n)) return
    for (const s of [full(n), short(n), shortRound(n), String(Math.round(n))]) set.add(norm(s))
    if (n >= 1000) {
      // "17K" for 17,379 and "1.6M" for 1,649,000: the short forms rounded down too.
      set.add(norm(Math.floor(n / 1000) + 'K'))
      if (n >= 1e6) set.add(norm((Math.floor(n / 1e5) / 10).toString() + 'M'))
    }
  }
  const addP = (p: number | null | undefined) => {
    if (p === null || p === undefined || !Number.isFinite(p)) return
    for (const s of [pct(p), `${Math.round(p)}%`, `${Math.floor(p)}%`, String(Math.round(p)), p.toFixed(1)])
      set.add(norm(s))
  }
  const t = data.totals
  ;[
    t.views,
    t.likes,
    t.comments,
    t.shares,
    data.posts.submitted,
    data.posts.approved,
    data.posts.pending,
    data.pages,
    data.daysLive,
  ].forEach(addN)
  addP(t.engagementPct)
  addN(data.campaign.minViewsToEarn)
  const g = data.goal
  addP(g.deliveredPct)
  addP(g.viewPct)
  if (g.viewGoal) [g.viewGoal, g.viewGoal / 4, g.viewGoal / 2, (g.viewGoal * 3) / 4].forEach(addN)
  addN(g.budgetCents / 100)
  addN(g.spentCents / 100)
  const total = data.platforms.reduce((s, p) => s + p.views, 0)
  for (const p of data.platforms) {
    addN(p.views)
    addN(p.posts)
    if (p.posts) addN(p.views / p.posts)
    if (total) addP((p.views / total) * 100)
  }
  // Ratios between platforms' averages ("about three times") are written in words; their numbers too.
  const clips = data.clips
  const shown = shownClips(data, spec)
  for (const c of clips) {
    addN(c.views)
    addN(c.likes)
    addN(c.comments)
    addN(c.shares)
    addN(c.followers)
    if (c.views) addP((c.likes / c.views) * 100)
    if (c.views) addP(((c.likes + c.comments + (c.shares ?? 0)) / c.views) * 100)
  }
  // The first N clips together, and their share of all views.
  for (const list of [shown, clips]) {
    let sum = 0
    list.slice(0, 6).forEach((c) => {
      sum += c.views
      addN(sum)
      if (t.views) addP((sum / t.views) * 100)
    })
  }
  // Each page's posts and their share of the posts.
  const byPage = new Map<string, number>()
  for (const c of clips) byPage.set(c.handle, (byPage.get(c.handle) ?? 0) + 1)
  for (const n of byPage.values()) {
    addN(n)
    if (data.posts.submitted) addP((n / data.posts.submitted) * 100)
  }
  if (t.views && data.posts.approved) addN(t.views / data.posts.approved)
  if (t.views && t.likes) addN(Math.round(t.views / t.likes)) // "about 1 in 9 viewers liked a post"
  return set
}

export type RuleProblem = { where: string; problem: string }

/** The problems with a spec's text; empty when it is fine to save. `typed` is what staff wrote. */
export function checkWriting(spec: ReportSpec, data: ReportData, typed: string[] = []): RuleProblem[] {
  const problems: RuleProblem[] = []
  const allowed = allowedNumbers(data, spec)
  for (const s of typed) for (const m of s.match(NUM) ?? []) allowed.add(norm(m))
  // Days of the month, the year, step and week numbers, "1 in 9" and the like.
  for (let i = 0; i <= 31; i++) allowed.add(String(i))
  const year = new Date(data.asOf).getUTCFullYear()
  allowed.add(String(year))
  allowed.add(String(year - 1))
  for (const f of textFields(spec)) {
    for (const [re, problem] of BANNED)
      if (re.test(f.text)) problems.push({ where: f.where, problem: `${problem}: "${f.text}"` })
    for (const m of f.text.match(NUM) ?? []) {
      const n = norm(m)
      // "Week 2", "Step 3": a bare small number with nothing after it is a count, not a figure.
      if (allowed.has(n) || allowed.has(n.replace(/%$/, ''))) continue
      problems.push({ where: f.where, problem: `has the number ${m.trim()}, which is not in the campaign's data` })
    }
  }
  if (spec.summary.facts.length > 3) problems.push({ where: 'Summary', problem: 'has more than three facts' })
  if (spec.learned.lessons.length > 4)
    problems.push({ where: 'What we learned', problem: 'has more than four lessons' })
  if (spec.plan.next.length > 4)
    problems.push({ where: 'Plan', problem: 'lists more than four things for the next report' })
  return problems
}

/** The figures a sentence can quote, by name, as the report writes them. */
function figures(data: ReportData, spec: ReportSpec): Map<string, string[]> {
  const f = new Map<string, string[]>()
  const n = (k: string, v: number | null | undefined) => {
    if (v === null || v === undefined) return
    f.set(k, [...new Set([short(v), full(v), shortRound(v)])])
  }
  const p = (k: string, v: number | null | undefined) => {
    if (v === null || v === undefined) return
    f.set(k, [...new Set([pct(v), `${Math.round(v)}%`])])
  }
  const t = data.totals
  n('views', t.views)
  n('likes', t.likes)
  n('comments', t.comments)
  n('shares', t.shares)
  p('engagement rate', t.engagementPct)
  n('posts submitted', data.posts.submitted)
  n('posts approved', data.posts.approved)
  n('posts being checked', data.posts.pending)
  n('pages posting', data.pages)
  n('days live', data.daysLive)
  p('budget delivered', data.goal.deliveredPct)
  p('progress toward the view goal', data.goal.viewPct)
  const total = data.platforms.reduce((s, x) => s + x.views, 0)
  for (const x of data.platforms) {
    n(`${x.platform} views`, x.views)
    n(`${x.platform} posts`, x.posts)
    if (total) p(`${x.platform} share of views`, (x.views / total) * 100)
  }
  shownClips(data, spec).forEach((c, i) => {
    n(`clip ${i + 1} views`, c.views)
    n(`clip ${i + 1} likes`, c.likes)
  })
  return f
}

export type StaleFlag = { where: string; text: string; figure: string; was: string; now: string }

/**
 * Sentences that quote a figure that has changed since the text was approved (owner brief: a final
 * report's numbers refresh on every open, its text never does; staff are told, the text is not rewritten).
 */
export function staleFlags(spec: ReportSpec, then: ReportData, now: ReportData): StaleFlag[] {
  const before = figures(then, spec)
  const after = figures(now, spec)
  const flags: StaleFlag[] = []
  const has = (text: string, token: string) =>
    new RegExp(`(^|[^\\d.,])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d.,]*\\d)`, 'i').test(text)
  for (const f of textFields(spec)) {
    for (const [key, was] of before) {
      const nowForms = after.get(key)
      if (!nowForms || nowForms[0] === was[0]) continue
      const quoted = was.find((w) => has(f.text, w) && !nowForms.includes(w))
      if (quoted && /\d/.test(quoted) && quoted.replace(/\D/g, '').length > 1)
        flags.push({ where: f.where, text: f.text, figure: key, was: quoted, now: nowForms[0]! })
    }
  }
  // One flag per sentence and figure.
  return flags.filter(
    (x, i) => flags.findIndex((y) => y.where === x.where && y.figure === x.figure && y.text === x.text) === i,
  )
}
