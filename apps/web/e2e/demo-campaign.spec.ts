import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { DEMOS } from '../src/demo'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

// A demo campaign for a showcase video (owner request, 2026-10-14): made once from its clip file, hidden
// from creators, skipped by the worker, and its report shows the clips with their real views.
test('an admin makes the demo campaign once; creators never see it and the report shows its clips', async ({
  page,
  browser,
}) => {
  test.setTimeout(10 * 60_000)
  const spec = DEMOS[0]!
  test.skip(spec.clips.length === 0, 'The clip file is empty.')
  expect(spec.clips.length).toBeGreaterThan(100)
  const fileViews = spec.clips.reduce((a, c) => a + c.views, 0)
  expect(fileViews).toBeGreaterThanOrEqual(60_000_000)

  await signInAs(page, 'admin@seed.invalid')
  await page.goto('/admin/demo')
  await expect(page.getByRole('heading', { name: spec.title })).toBeVisible()
  const made = await sql`select id from campaigns where title = ${spec.title} and demo`
  if (made.length === 0) {
    await page.getByRole('button', { name: `Create ${spec.title}` }).click()
    await expect(page.getByText(/^Made /)).toBeVisible({ timeout: 8 * 60_000 })
  }
  const [c] =
    await sql`select id, status, visibility, demo, budget_cents from campaigns where title = ${spec.title} and demo`
  expect(c!.status).toBe('live')
  expect(c!.visibility).toBe('private')
  expect(Number(c!.budget_cents)).toBe(spec.budgetCents)
  const [t] =
    await sql`select count(*)::int as posts, sum(counted_views)::bigint as views, sum(earned_cents)::bigint as earned,
    count(*) filter (where next_check_at is not null)::int as scheduled from submissions where campaign_id = ${c!.id}`
  expect(t!.posts).toBe(spec.clips.length)
  expect(Number(t!.views)).toBe(fileViews)
  expect(Number(t!.earned)).toBe(Math.floor((fileViews / 1000) * spec.rateCentsPer1000))
  expect(t!.scheduled).toBe(0)

  // Made once: the page now shows the figures instead of the button.
  await page.reload()
  await expect(page.getByText(/^Made: /)).toBeVisible()
  await expect(page.getByRole('button', { name: `Create ${spec.title}` })).toHaveCount(0)

  // The worker never picks its posts up, and the leaderboard ignores its creators.
  const health = (await (await page.request.get('/api/health')).json()) as { worker: { tracking: { id: string }[] } }
  expect(health.worker.tracking.map((x) => x.id)).not.toContain(c!.id)
  await page.goto('/leaderboard')
  await expect(page.getByText(spec.clips[0]!.channel, { exact: true })).toHaveCount(0)

  // The client report shows the clips with their views.
  await page.goto(`/admin/campaigns/${c!.id}`)
  await page.getByRole('button', { name: 'Create report link' }).click()
  await expect(page.getByText('Report link created and copied.')).toBeVisible()
  const link = await page.getByRole('textbox', { name: 'Report link' }).inputValue()
  const client = await browser.newContext()
  const report = await client.newPage()
  await report.goto(link)
  await expect(report.getByRole('heading', { name: spec.title })).toBeVisible()
  const json = (await (await report.request.get(`/api/r/${link.split('/r/')[1]}/report`)).json()) as {
    totals: { views: number }
    counts: { approved: number }
  }
  expect(json.totals.views).toBe(fileViews)
  expect(json.counts.approved).toBe(spec.clips.length)
  await client.close()

  // A creator browsing campaigns never sees it.
  const creator = await browser.newContext()
  const cp = await creator.newPage()
  await signInAs(cp, 'creator01@seed.invalid')
  await cp.goto('/campaigns')
  await expect(cp.getByText(spec.title, { exact: true })).toHaveCount(0)
  await creator.close()
})
