import { countUp, dayMon, dayMonth, dayMonthYear, dayMonYear, full, pct, short, shortRound } from './format'
import {
  PLATFORM_NAMES,
  shownClips,
  visibleSections,
  type ReportData,
  type ReportKind,
  type ReportSpec,
  type SectionKey,
} from './spec'
import { REPORT_CSS } from './styles'
import { REPORT_SCRIPT } from './script'

// The client report page, written out from the report's figures and its spec. The markup, classes and
// script are the reference reports' own (reports.maisondelites.com/winnerman-week-1 for a weekly report,
// /marrz-final for a final one), with the reference's hand-typed numbers replaced by the app's data.

export type RenderOptions = {
  kind: ReportKind
  weekNumber: number | null
  /** 'print' is the PDF: every number at its final value, every plan step written out, no motion. */
  mode: 'web' | 'print'
  /** Clip pictures copied to our storage, by submission id. */
  covers: Record<string, string>
  /** Written as <base href> so the PDF renderer finds the pictures. */
  baseHref?: string
}

export const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Text with **bold** marks, escaped. */
export const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')

const NUMBERS = ['', 'one', 'two', 'three', 'four', 'five', 'six']
const SHIELD =
  '<svg viewBox="0 0 24 24"><path d="M12 3l8 3.5v5.5c0 4.6-3.4 8.2-8 9-4.6-.8-8-4.4-8-9V6.5L12 3z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/></svg>'
const ICONS: Record<string, string> = {
  tiktok:
    '<svg viewBox="0 0 24 24"><path d="M16.6 3c.3 2.2 1.9 3.9 4.1 4.1v3.1c-1.5 0-2.9-.4-4.1-1.2v6.1A6 6 0 1 1 10.6 9v3.2a2.9 2.9 0 1 0 2.9 2.9V3z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24"><path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.9-8.9a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM12 2.5c-2.6 0-2.9 0-3.9.1-3.5.2-5.3 2-5.5 5.5-.1 1-.1 1.3-.1 3.9s0 2.9.1 3.9c.2 3.5 2 5.3 5.5 5.5 1 .1 1.3.1 3.9.1s2.9 0 3.9-.1c3.5-.2 5.3-2 5.5-5.5.1-1 .1-1.3.1-3.9s0-2.9-.1-3.9c-.2-3.5-2-5.3-5.5-5.5-1-.1-1.3-.1-3.9-.1z"/></svg>',
  youtube:
    '<svg viewBox="0 0 24 24"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/></svg>',
}

const name = (p: string) => PLATFORM_NAMES[p] ?? p
/** "TikTok", "TikTok & Instagram", "TikTok, Instagram & X" */
function platformList(ps: string[]) {
  const names = ps.map(name)
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`
}

const cu = (n: number) => {
  const c = countUp(n)
  return `<span class="cu" data-target="${c.target}"${c.dec ? ` data-dec="${c.dec}"` : ''}>${c.target}</span>${c.unit}`
}
const cuPct = (p: number) => {
  const s = pct(p).slice(0, -1)
  return `<span class="cu" data-target="${s}"${s.includes('.') ? ' data-dec="1"' : ''}>${s}</span>%`
}

/** The hero ring and the progress bar: the share of the view goal (weekly) or of the budget delivered. */
function progress(data: ReportData, kind: ReportKind) {
  const g = data.goal
  if (kind === 'week' && g.viewGoal && g.viewPct !== null)
    return { mode: 'views' as const, pct: g.viewPct, goal: g.viewGoal }
  if (g.deliveredPct !== null) return { mode: 'budget' as const, pct: g.deliveredPct, goal: null }
  return null
}

export function renderReport(data: ReportData, spec: ReportSpec, o: RenderOptions): string {
  const week = o.kind === 'week'
  const multi = data.platforms.length > 1
  const sections = visibleSections(data, spec, o.kind)
  const clips = shownClips(data, spec)
  const prog = progress(data, o.kind)
  const t = data.totals
  const reportDay = data.asOf
  const live = data.campaign.startAt
  const title = week ? `Week ${o.weekNumber ?? 1} Report` : 'Final Report'

  const DOT_LABEL: Record<SectionKey, string> = {
    hero: 'Cover',
    summary: 'Summary',
    results: week ? 'Results so far' : 'Results',
    platforms: 'By platform',
    clips: 'Top clips',
    learned: 'What we learned',
    plan: 'The coming weeks',
    signoff: '',
  }
  const SNUM: Record<SectionKey, string> = {
    hero: '',
    summary: 'Summary',
    results: week ? 'Results so far' : 'Results',
    platforms: 'Results by platform',
    clips: 'Top clips',
    learned: 'What we learned',
    plan: 'Plan for the coming weeks',
    signoff: '',
  }
  const body = sections.filter((k) => k !== 'hero' && k !== 'signoff')
  const ids = new Map<SectionKey, string>()
  if (sections.includes('hero')) ids.set('hero', 's0')
  body.forEach((k, i) => ids.set(k, `s${i + 1}`))

  // ---- hero
  const hero = (() => {
    const tag =
      data.campaign.complete && !week
        ? '<span class="done-tag rv"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Campaign complete</span>'
        : live
          ? `<span class="live rv"><i></i>Live since ${esc(dayMonth(live))}</span>`
          : ''
    const label = week
      ? `Campaign Report &middot; ${dayMonYear(reportDay)}`
      : `Final Report &middot; ${dayMonthYear(reportDay)}`
    const ring = prog
      ? `<div class="ring" id="heroRing">
        <svg viewBox="0 0 100 100"><circle class="bgc" cx="50" cy="50" r="44"/><circle class="fgc" cx="50" cy="50" r="44" stroke-dasharray="276.5" stroke-dashoffset="276.5"/></svg>
        <div class="rt"><b>${Math.round(prog.pct)}%</b><span>${prog.mode === 'views' ? `of ${short(prog.goal!)} views` : 'budget delivered'}</span></div>
      </div>`
      : ''
    const cover = data.campaign.coverUrl
      ? `<img src="${esc(data.campaign.coverUrl)}" alt="${esc(spec.hero.coverAlt)}">`
      : ''
    const bot = week
      ? spec.preparedFor
        ? `Prepared for ${esc(spec.preparedFor)}`
        : ''
      : live
        ? `${esc(dayMonth(live))} to ${esc(dayMonthYear(data.campaign.closedAt ?? data.asOf))}`
        : ''
    return `<header class="hero" id="s0">
  <div class="hero-top">
    <a class="mark" href="https://maisondelites.com" target="_blank" rel="noopener">Maison <b>d'&Eacute;lites</b></a>
    <div class="label" style="color:var(--mute)">${label}</div>
  </div>
  <div class="hero-body">
    <div class="hero-mid">
      ${tag}
      <h1 class="rv d1">${esc(spec.artist)}<span>${week ? `Week ${o.weekNumber ?? 1} report` : 'Final report'}</span></h1>
      <p class="hero-sub rv d2">${rich(spec.hero.sub)}</p>
    </div>
    <div class="cover-art${spec.hero.coverShape === 'tall' ? ' tall' : ''} rv d2">
      <div class="ca-glow"></div>
      ${cover}
      ${ring}
    </div>
  </div>
  <div class="hero-bot">
    <div class="label rv d3" style="color:var(--mute)">${bot}</div>
  </div>
</header>`
  })()

  const big = (v: string, l: string) =>
    `<div class="bg"><div class="bv">${v}</div><div class="bl">${esc(l)}</div></div>`
  const cell = (v: string, l: string, style = '') =>
    `<div class="g"${style ? ` style="${style}"` : ''}><div class="gv">${v}</div><div class="gl">${esc(l)}</div></div>`

  // ---- sections
  const render: Partial<Record<SectionKey, () => string>> = {
    summary: () => {
      const tiles = [
        big(
          cu(t.views),
          week && !multi && data.platforms[0] ? `Views on ${name(data.platforms[0].platform)}` : 'Views',
        ),
        big(cu(t.likes), 'Likes'),
      ]
      if (week && t.engagementPct !== null) tiles.push(big(cuPct(t.engagementPct), 'Engagement rate'))
      else if (!week && t.shares !== null) tiles.push(big(cu(t.shares), 'Shares'))
      else if (t.engagementPct !== null) tiles.push(big(cuPct(t.engagementPct), 'Engagement rate'))
      let bar = ''
      if (prog?.mode === 'views') {
        const g = prog.goal!
        bar = `<div class="prog rv d2" id="prog">
      <div class="prog-top"><span class="pk">Progress toward ${short(g)} views</span><span class="pv"><b>${short(t.views)}</b> of ${short(g)} &middot; roughly <b>${Math.round(prog.pct)}%</b></span></div>
      <div class="bar"><div class="bar-fill" data-w="${prog.pct.toFixed(1).replace(/\.0$/, '')}"></div></div>
      <div class="ticks"><span>0</span><span>${short(g / 4)}</span><span>${short(g / 2)}</span><span>${short((g * 3) / 4)}</span><span>${short(g)}</span></div>
    </div>`
      } else if (prog?.mode === 'budget') {
        const done = prog.pct >= 100
        const end =
          data.campaign.complete && data.campaign.closedAt
            ? `Complete ${dayMon(data.campaign.closedAt)}`
            : `Updated ${dayMon(data.asOf)}`
        bar = `<div class="prog rv d2" id="prog">
      <div class="prog-top"><span class="pk">Budget delivered</span><span class="pv">${done ? 'The full budget, <b>100%</b>' : `<b>${Math.round(prog.pct)}%</b> of the budget`}</span></div>
      <div class="bar"><div class="bar-fill" data-w="${Math.min(100, prog.pct).toFixed(1).replace(/\.0$/, '')}"></div></div>
      <div class="ticks">${live ? `<span>Live ${dayMon(live)}</span>` : '<span></span>'}<span>${end}</span></div>
    </div>`
      }
      const s = spec.summary
      return `<h2 class="statement rv d1">${rich(s.statement)}</h2>
    <div class="big rv d2">
      ${tiles.join('\n      ')}
    </div>
    ${bar}
    ${s.body ? `<p class="body-lg rv" style="margin-top:1.6rem">${rich(s.body)}</p>` : ''}
    ${
      s.facts.length
        ? `<div class="facts rv d1">
      ${s.facts
        .slice(0, 3)
        .map(
          (f) =>
            `<div class="fact"><div class="fk">${esc(f.key)}</div><div class="fv">${esc(f.value)}</div><p>${rich(f.text)}</p></div>`,
        )
        .join('\n      ')}
    </div>`
        : ''
    }`
    },
    results: () => {
      const r = spec.results
      const ps = data.platforms.map((p) => p.platform)
      const cells: string[] = [cell(cu(t.views), 'Views'), cell(cu(t.likes), 'Likes'), cell(cu(t.comments), 'Comments')]
      if (t.shares !== null) cells.push(cell(cu(t.shares), 'Shares'))
      if (t.engagementPct !== null) cells.push(cell(cuPct(t.engagementPct), 'Engagement rate'))
      if (week) {
        cells.push(
          cell(cu(data.posts.submitted), 'Posts submitted'),
          cell(cu(data.posts.approved), 'Posts approved'),
          cell(cu(data.posts.pending), 'Posts being checked'),
          cell(cu(data.pages), 'Pages posting'),
        )
        if (ps.length) cells.push(cell(esc(platformList(ps)), ps.length > 1 ? 'Platforms' : 'Platform'))
      } else {
        cells.push(cell(cu(data.posts.approved), 'Posts approved'))
        if (ps.length)
          cells.push(
            cell(
              esc(platformList(ps)),
              ps.length > 1 ? 'Platforms' : 'Platform',
              ps.length > 1 ? 'grid-column:span 2' : '',
            ),
          )
      }
      const p = data.posts
      const pipe =
        week && p.submitted > 0
          ? `<div class="pipe rv d2" id="pipe">
      <div class="pk">${full(p.submitted)} posts submitted</div>
      <div class="stack"><div class="a" data-w="${((p.approved / p.submitted) * 100).toFixed(1)}">${full(p.approved)} approved</div>${
        p.pending
          ? `<div class="c" data-w="${((p.pending / p.submitted) * 100).toFixed(1)}">${full(p.pending)} being checked</div>`
          : ''
      }</div>
    </div>`
          : ''
      const min = data.campaign.minViewsToEarn
      const note = week
        ? `Every post is checked before it counts. ${min > 0 ? `Posts with fewer than ${full(min)} views, or with signs of fake views, are not counted.` : 'Posts with signs of fake views are not counted.'}`
        : `Every post was checked before it counted. ${min > 0 ? `Posts with fewer than ${full(min)} views, or with signs of fake views, were not counted.` : 'Posts with signs of fake views were not counted.'}`
      return `<h2 class="statement rv d1">${rich(r.statement)}</h2>
    ${r.body ? `<p class="body-lg rv d2" style="margin-top:1.4rem">${rich(r.body)}</p>` : ''}
    <div class="grid${week ? '' : ' four'} rv d2">
      ${cells.join('\n      ')}
    </div>
    ${pipe}
    <div class="note rv d3">${SHIELD}<span>${note}</span></div>`
    },
    platforms: () => {
      const total = data.platforms.reduce((s, p) => s + p.views, 0) || 1
      const share = (v: number) => Math.round((v / total) * 100)
      const plats = data.platforms
        .map(
          (p) => `<div class="plat${p.platform === 'instagram' ? ' ig' : ''}">
        <div class="ph">${ICONS[p.platform] ?? ''}${esc(name(p.platform))}</div>
        <div class="pv">${cu(p.views)}</div><div class="pl">Views &middot; ${share(p.views)}% of the total</div>
        <div class="pm"><div>${full(p.posts)}<small>Posts</small></div><div>${shortRound(p.posts ? p.views / p.posts : 0)}<small>Avg per post</small></div><div>${share(p.views)}%<small>Share of views</small></div></div>
      </div>`,
        )
        .join('\n      ')
      const avgs = data.platforms
        .map((p) => ({ p: p.platform, avg: p.posts ? p.views / p.posts : 0 }))
        .sort((a, b) => b.avg - a.avg)
      const top = avgs[0]?.avg || 1
      const bars = avgs
        .map((a, i) => {
          const w = Number(((a.avg / top) * 100).toFixed(1))
          const outside = w < 45
          return `<div class="cb-row"><div class="cn">${esc(name(a.p))}</div><div class="cb-track"><div class="cb-fill${i ? ' dim' : ''}" data-w="${w}"></div><div class="cb-val${outside ? ' lt' : ''}"${outside ? ` style="right:auto;left:calc(${w}% + 0.7rem)"` : ''}>${shortRound(a.avg)}</div></div></div>`
        })
        .join('\n      ')
      return `<h2 class="statement rv d1">${rich(spec.platforms.statement)}</h2>
    <div class="plats rv d2">
      ${plats}
    </div>
    <div class="cmpbars rv d2" id="cmpbars">
      <div class="ck">Average views per post</div>
      ${bars}
    </div>`
    },
    clips: () => {
      const c = spec.clips
      const n = Math.max(0, Math.min(c.shareCount, clips.length))
      const sharePct =
        t.views > 0 ? Math.round((clips.slice(0, n).reduce((s, x) => s + x.views, 0) / t.views) * 100) : 0
      const shareBlock =
        n > 0 && c.share.trim()
          ? `<div class="share rv d2" id="share">
      <div class="donut"><svg viewBox="0 0 100 100"><circle class="bgc" cx="50" cy="50" r="40"/><circle class="fgc" cx="50" cy="50" r="40" stroke-dasharray="251.3" stroke-dashoffset="251.3"/></svg><b>${sharePct}%</b></div>
      <p>${rich(c.share)}</p>
    </div>`
          : ''
      const buttons = [
        '<button class="on" data-m="views">By views</button>',
        '<button data-m="rate">By like rate</button>',
        ...(!week && clips.some((x) => (x.shares ?? 0) > 0) ? ['<button data-m="shares">By shares</button>'] : []),
      ].join('')
      const heading = clips.length === 1 ? 'The biggest post' : `The ${NUMBERS[clips.length]} biggest posts`
      return `<h2 class="statement rv d1">${rich(c.statement)}</h2>
    ${shareBlock}
    <div class="wall" id="wall"></div>
    <div class="sortbar rv d2">
      <h3 class="sub" style="margin:0">${heading}</h3>
      <div class="seg" id="sortSeg" role="tablist">${buttons}</div>
    </div>
    <div class="clips rv d2" id="clips"></div>`
    },
    learned: () =>
      `<h2 class="statement rv d1">${rich(spec.learned.statement)}</h2>
    <div class="learn rv d2">
      ${spec.learned.lessons
        .slice(0, 4)
        .map(
          (l) =>
            `<div class="ln"><div class="lv">${esc(l.value)}</div><div class="lvl">${esc(l.label)}</div><h4>${esc(l.title)}</h4><p>${rich(l.body)}</p></div>`,
        )
        .join('\n      ')}
    </div>`,
    plan: () => {
      const p = spec.plan
      const steps =
        o.mode === 'print'
          ? `<div class="plan-all rv d2">${p.steps.map((s, i) => `<div class="detail">${stepHtml(s, i, p.steps.length)}</div>`).join('')}</div>`
          : `<div class="plan rv d2">
      <div class="steps" id="steps"></div>
      <div class="detail"><div class="anim" id="detail"></div></div>
    </div>`
      const next = p.next.length
        ? `<h3 class="sub rv">Next week's report will show</h3>
    <div class="nextrep rv d1">
      ${p.next
        .slice(0, 4)
        .map((x, i) => `<div class="nr"><span>${String(i + 1).padStart(2, '0')}</span>${esc(x)}</div>`)
        .join('\n      ')}
    </div>`
        : ''
      return `<h2 class="statement rv d1">${rich(p.statement)}</h2>
    ${p.body ? `<p class="body-lg rv d2" style="margin-top:1.4rem">${rich(p.body)}</p>` : ''}
    ${steps}

    ${next}`
    },
  }

  const signoff = sections.includes('signoff')
    ? `<div class="signoff rv d2">
      <div class="s-mark">Maison <b>d'&Eacute;lites</b></div>
      <div class="s-r">Jacques &middot; Founder<br><a href="https://maisondelites.com" target="_blank" rel="noopener">maisondelites.com</a></div>
    </div>`
    : ''
  const blocks = body.map((k, i) => {
    const last = i === body.length - 1
    return `<section class="section${i % 2 ? ' alt' : ''}" id="${ids.get(k)}">
  <div class="wrap">
    <span class="snum rv">${String(i + 1).padStart(2, '0')} &middot; ${SNUM[k]}</span>
    ${render[k]!()}${last ? `\n    ${signoff}` : ''}
  </div>
</section>`
  })
  // A report with only a cover still signs off.
  if (!body.length && signoff) blocks.push(`<section class="section"><div class="wrap">${signoff}</div></section>`)

  const dots = sections
    .filter((k) => k !== 'signoff')
    .map((k) => `<a href="#${ids.get(k)}"><span>${DOT_LABEL[k]}</span></a>`)
    .join('\n  ')

  const config = {
    print: o.mode === 'print',
    hero: prog ? Math.min(1, prog.pct / 100) : null,
    share:
      spec.clips.shareCount > 0 && t.views > 0
        ? clips.slice(0, Math.min(spec.clips.shareCount, clips.length)).reduce((s, x) => s + x.views, 0) / t.views
        : null,
    top: Math.min(spec.clips.shareCount, clips.length),
    multi,
    week,
    CL: clips.map((c) => ({
      p: c.handle,
      pf: name(c.platform),
      id: c.postId,
      url: c.url,
      v: c.views,
      l: c.likes,
      s: c.shares,
      d: c.postedAt ? dayMon(c.postedAt) : '',
      f: c.followers !== null ? short(c.followers) : null,
      img: o.covers[c.id] ?? null,
    })),
    P: week ? spec.plan.steps : [],
  }

  return `<!DOCTYPE html>
<html lang="en"${o.mode === 'print' ? ' class="print"' : ''}>
<head>
<meta charset="UTF-8">
${o.baseHref ? `<base href="${esc(o.baseHref)}">\n` : ''}<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${esc(spec.artist)} &middot; ${title} &middot; Maison d'&Eacute;lites</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${REPORT_CSS}
${EXTRA_CSS}
</style>
</head>
<body>

<div id="progress"></div>
<nav id="dots" aria-label="Sections">
  ${dots}
</nav>

${sections.includes('hero') ? hero : ''}

${blocks.join('\n\n')}

<script>
window.__R=${JSON.stringify(config).replace(/</g, '\\u003c')};
${REPORT_SCRIPT}
</script>
</body>
</html>
`
}

function stepHtml(s: ReportSpec['plan']['steps'][number], i: number, n: number) {
  const bPct = Math.max(5, Math.min(95, s.split?.bPct ?? 25))
  return (
    `<div class="dk">Step ${i + 1} of ${n}</div><h4>${esc(s.title)}</h4><p>${esc(s.body)}</p>` +
    (s.list.length ? `<ul class="targets">${s.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
    (s.split
      ? `<div class="split"><div class="s1" style="width:${100 - bPct}%">${esc(s.split.a)}</div><div class="s2" style="width:${bPct}%">${esc(s.split.b)}</div></div>`
      : '') +
    (s.tag ? `<span class="tagline">${esc(s.tag)}</span>` : '')
  )
}

// Rules the reference pages do not need: a clip without a stored picture shows the page's initial, and
// the PDF (A4, dark background kept, no motion).
const EXTRA_CSS = String.raw`
  .clip .av span{display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-family:'Archivo',sans-serif;font-weight:800;font-size:1rem;color:var(--gold-soft);text-transform:uppercase}
  .vt-media .vt-none{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Archivo',sans-serif;font-weight:800;font-size:2.4rem;color:var(--panel-3);text-transform:uppercase}
  .plan-all{display:flex;flex-direction:column;gap:1rem;margin-top:2rem}
  .plan-all .detail{min-height:0}
  @page{size:A4;margin:0}
  html.print{scroll-behavior:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html.print body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html.print #progress,html.print #dots,html.print body::after,html.print .vt-play{display:none}
  html.print *,html.print *:before,html.print *:after{transition:none!important;animation:none!important}
  html.print .rv{opacity:1;transform:none}
  html.print .hero{min-height:297mm;break-after:page}
  html.print .fact,html.print .g,html.print .plat,html.print .vtile,html.print .clip,html.print .ln,html.print .detail,html.print .share,html.print .prog,html.print .cmpbars,html.print .note,html.print .pipe,html.print .big,html.print .signoff,html.print .nextrep{break-inside:avoid}
  html.print .ring{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(21,18,13,.94)}
`
