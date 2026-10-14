import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import type { DemoSpec } from '../src/server/demo-import'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

const spec = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/demo/zohran-mamdani.json'), 'utf8')) as DemoSpec

// The demo campaign for a showcase video (owner request, 2026-10-14): built from the admin page in small
// steps, with clips from TikTok, Instagram and X through the data provider (a stand-in here, when the
// server runs with DATA_PROVIDER_API_URL_OVERRIDE) and YouTube from the file, all posted inside the
// campaign's window before he became mayor; then closed. Hidden from creators and from every job.
test('an admin builds the demo campaign; its clips sit inside its window and creators never see it', async ({
  page,
  browser,
}) => {
  test.setTimeout(15 * 60_000)
  test.skip(spec.clips.length < 100, 'The clip file is not complete.')
  const searched = !!process.env.DATA_PROVIDER_API_URL_OVERRIDE

  await signInAs(page, 'admin@seed.invalid')
  await page.goto('/admin/demo')
  await expect(page.getByRole('heading', { name: spec.title })).toBeVisible()
  await expect(page.getByText(/spending at most 1,000 credits/)).toBeVisible()
  const build = page.getByRole('button', { name: new RegExp(`^(Build|Rebuild) ${spec.title}$`) })
  await build.click()
  await expect(page.getByText(new RegExp(`^${spec.title} is ready:`))).toBeVisible({ timeout: 14 * 60_000 })

  const [c] = await sql`select id, status, visibility, demo, budget_cents, closed_at, end_at, start_at, release_at
    from campaigns where title = ${spec.title} and demo and deleted_at is null`
  expect(c!.status).toBe('closed')
  expect(c!.visibility).toBe('private')
  expect(c!.release_at).toBeNull()
  expect(new Date(c!.closed_at).toISOString()).toBe(new Date(spec.endAt).toISOString())
  expect(new Date(c!.start_at).toISOString()).toBe(new Date(spec.startAt).toISOString())
  const [t] = await sql`select count(*)::int as posts, sum(earned_cents)::bigint as earned,
      min(published_at) as first, max(published_at) as last,
      count(*) filter (where next_check_at is not null)::int as scheduled,
      count(*) filter (where state <> 'final')::int as open,
      count(distinct platform)::int as platforms
    from submissions where campaign_id = ${c!.id}`
  expect(t!.posts).toBeGreaterThan(100)
  expect(Number(t!.earned)).toBeLessThanOrEqual(spec.budgetCents)
  expect(new Date(t!.first).getTime()).toBeGreaterThanOrEqual(new Date(spec.startAt).getTime())
  expect(new Date(t!.last).getTime()).toBeLessThan(new Date(spec.endAt).getTime())
  expect(t!.scheduled).toBe(0)
  expect(t!.open).toBe(0)
  if (searched) {
    expect(t!.platforms).toBe(4)
    expect(t!.posts).toBeGreaterThanOrEqual(1000)
  }
  // No post earned past the cap.
  const [over] =
    await sql`select count(*)::int as n from submissions where campaign_id = ${c!.id} and earned_cents > ${spec.capPerPostCents}`
  expect(over!.n).toBe(0)

  // The page shows what was built; the jobs skip it.
  await page.reload()
  await expect(page.getByText(/^Built: /)).toBeVisible()
  const health = (await (await page.request.get('/api/health')).json()) as { worker: { tracking: { id: string }[] } }
  expect(health.worker.tracking.map((x) => x.id)).not.toContain(c!.id)

  // The client report: ended, dated inside the window, spend spread over the campaign's days.
  await page.goto(`/admin/campaigns/${c!.id}`)
  await page.getByRole('button', { name: 'Create report link' }).click()
  await expect(page.getByText('Report link created and copied.')).toBeVisible()
  const link = await page.getByRole('textbox', { name: 'Report link' }).inputValue()
  const client = await browser.newContext()
  const report = await client.newPage()
  await report.goto(link)
  await expect(report.getByRole('heading', { name: spec.title })).toBeVisible()
  const json = (await (await report.request.get(`/api/r/${link.split('/r/')[1]}/report`)).json()) as {
    campaign: { status: string }
    range: { from: string; to: string }
    spendByDay: { day: string; spendCents: number }[]
    totals: { likes: number; comments: number }
  }
  expect(json.campaign.status).toBe('Ended')
  expect(json.range.to).toBe(spec.endAt.slice(0, 10))
  expect(json.range.from >= spec.startAt.slice(0, 10)).toBe(true)
  expect(json.spendByDay.filter((d) => d.spendCents > 0).length).toBeGreaterThan(20)
  expect(json.spendByDay.every((d) => d.day <= spec.endAt.slice(0, 10))).toBe(true)
  expect(json.totals.likes).toBeGreaterThan(0)
  expect(json.totals.comments).toBeGreaterThan(0)
  await client.close()

  // A creator browsing campaigns never sees it.
  const creator = await browser.newContext()
  const cp = await creator.newPage()
  await signInAs(cp, 'creator01@seed.invalid')
  await cp.goto('/campaigns')
  await expect(cp.getByText(spec.title, { exact: true })).toHaveCount(0)
  await creator.close()
})
