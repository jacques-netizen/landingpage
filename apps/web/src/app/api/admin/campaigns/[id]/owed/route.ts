import { db, shownViews, tables } from '@mde/db'
import { eq, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { requireStaffApi } from '@/server/guard'
import { isId } from '@/server/input'

// What every clipper is owed on one campaign, as a spreadsheet (owner, 2026-11-24: "tell me what
// everyone is owed for the Fay Diamond campaign"). One row per clipper who earned or posted: posts,
// views, what they earned, how much of it is already released to their wallet and how much is not yet.
// Finance and admin staff only.

const cents = (n: number) => (n / 100).toFixed(2)
const cell = (v: string | number) => {
  const s = String(v)
  // Quote every text cell, and stop a spreadsheet reading a cell as a formula.
  return /^[=+\-@\t\r]/.test(s) ? `"'${s.replace(/"/g, '""')}"` : `"${s.replace(/"/g, '""')}"`
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireStaffApi('money')
  if (viewer instanceof NextResponse) return viewer
  const { id } = await params
  if (!isId(id))
    return NextResponse.json({ error: { code: 'not_found', message: 'No such campaign.' } }, { status: 404 })
  const d = db()
  const [c] = await d
    .select({ title: tables.campaigns.title })
    .from(tables.campaigns)
    .where(eq(tables.campaigns.id, id))
  if (!c) return NextResponse.json({ error: { code: 'not_found', message: 'No such campaign.' } }, { status: 404 })

  const rows = await d.execute<{
    name: string | null
    email: string
    handles: string | null
    posts: string
    approved: string
    views: string
    earned: string
    released: string
  }>(sql`
    select coalesce(u.username, u.display_name) as name, u.email,
      (select string_agg(distinct a.handle || ' (' || a.platform || ')', ', ') from linked_accounts a
        join submissions x on x.linked_account_id = a.id where x.campaign_id = ${id} and x.creator_id = u.id) as handles,
      count(*)::bigint as posts,
      count(*) filter (where s.state in ('approved', 'earning', 'final', 'paid_out'))::bigint as approved,
      coalesce(sum(${shownViews('s')}) filter (where s.state in ('approved', 'earning', 'final', 'paid_out')), 0)::bigint as views,
      coalesce(sum(s.earned_cents), 0)::bigint as earned,
      coalesce(sum(s.earned_cents) filter (where s.state = 'paid_out'), 0)::bigint as released
    from submissions s join users u on u.id = s.creator_id
    where s.campaign_id = ${id}
    group by u.id
    order by coalesce(sum(s.earned_cents), 0) desc, coalesce(u.username, u.display_name, u.email)`)

  const head = [
    'Clipper',
    'Email',
    'Handles',
    'Posts',
    'Approved posts',
    'Views',
    'Earned ($)',
    'Released to wallet ($)',
    'Not released yet ($)',
  ]
  const lines = [head.map(cell).join(',')]
  let earned = 0
  let released = 0
  for (const r of rows) {
    const e = Number(r.earned)
    const rel = Number(r.released)
    earned += e
    released += rel
    lines.push(
      [r.name ?? r.email, r.email, r.handles ?? '', r.posts, r.approved, r.views, cents(e), cents(rel), cents(e - rel)]
        .map(cell)
        .join(','),
    )
  }
  lines.push(
    ['Total', '', '', '', '', '', cents(earned), cents(released), cents(earned - released)].map(cell).join(','),
  )
  const file = `${
    c.title
      .replace(/[^\w -]+/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'campaign'
  }-owed.csv`
  return new Response(`\uFEFF${lines.join('\r\n')}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${file}"`,
      'cache-control': 'no-store',
    },
  })
}
