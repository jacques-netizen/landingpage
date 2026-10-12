import { expect, test } from '@playwright/test'
import Redis from 'ioredis'
import postgres from 'postgres'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

/** The report JSON is cached for 60 seconds; a test that just changed the data clears that cache. */
async function clearReportCache() {
  const r = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 1 })
  try {
    const keys = await r.keys('report:*')
    if (keys.length) await r.del(...keys)
  } finally {
    r.disconnect()
  }
}

// The client's campaign report (client report brief, 2026-10-12): a share link made in admin opens the
// report with no login, new posts show without a reload, and revoking the link ends it.
test('a client opens the report from a share link, sees new posts without reloading, and loses access when it is revoked', async ({
  page,
  browser,
}) => {
  const [c] =
    await sql`select id, title, current_terms_version_id as terms, rate_cents_per_1000 as rate from campaigns where title = 'Sample clipping'`
  await signInAs(page, 'admin@seed.invalid')
  await page.goto(`/admin/campaigns/${c!.id}`)
  await page.getByRole('button', { name: 'Create report link' }).click()
  await expect(page.getByText('Report link created and copied.')).toBeVisible()
  const link = await page.getByRole('textbox', { name: 'Report link' }).inputValue()
  expect(link).toMatch(/\/r\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  expect(link).not.toContain(c!.id)

  // A private window: no cookies, no login.
  const client = await browser.newContext()
  const report = await client.newPage()
  await report.goto(link)
  await expect(report.getByRole('heading', { name: c!.title })).toBeVisible()
  await expect(report.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await expect(report.locator('meta[property="og:title"]')).toHaveAttribute('content', `${c!.title} Campaign Report`)
  for (const label of [
    'Views',
    'Likes',
    'Comments',
    'Shares',
    'Campaign Budget',
    'SUBMISSIONS',
    'PLATFORM STATS',
    'SPEND',
    'CLIPS',
    'Export CSV',
  ])
    await expect(report.getByText(label, { exact: true }).first()).toBeVisible()
  await expect(report.getByText(/Updated /)).toBeVisible()
  const before = (await (await report.request.get(`/api/r/${link.split('/r/')[1]}/report`)).json()) as {
    totals: { views: number }
  }

  // A post approved after the page opened: in the JSON at once, and on the page at its next refresh.
  const tag = `reporttest${Date.now() % 1e6}`
  const [u] = await sql`insert into users (email, username) values (${`${tag}@test.invalid`}, ${tag}) returning id`
  await sql`insert into creator_profiles (user_id) values (${u!.id})`
  const [s] = await sql`
    insert into submissions (campaign_id, creator_id, platform, post_url, platform_post_id, state, terms_version_id,
      rate_cents_per_1000_locked, submitted_at, published_at, latest_views, counted_views)
    values (${c!.id}, ${u!.id}, 'instagram', ${`https://www.instagram.com/reel/${tag}/`}, ${tag}, 'approved', ${c!.terms},
      ${c!.rate}, now(), now() - interval '1 hour', 123456, 123456) returning id`
  await sql`insert into view_snapshots (submission_id, taken_at, views, likes, comments, shares) values (${s!.id}, now(), 123456, 10, 2, 1)`
  await sql`insert into view_snapshot_days (submission_id, day, taken_at, views, likes, comments, shares) values (${s!.id}, (now() at time zone 'UTC')::date, now(), 123456, 10, 2, 1)`
  await clearReportCache()
  const after = (await (await report.request.get(`/api/r/${link.split('/r/')[1]}/report`)).json()) as {
    totals: { views: number }
    submissions: { rows: { handle: string }[] }
  }
  expect(after.totals.views - before.totals.views).toBe(123456)
  expect(after.submissions.rows[0]!.handle).toBe(`@${tag}`)
  // The page refetches when the tab comes back into focus (and every 2 minutes on its own).
  await report.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(report.getByText(`@${tag}`).first()).toBeVisible()
  // The CSV download carries the same rows.
  const csv = await report.request.get(`/api/r/${link.split('/r/')[1]}/report.csv`)
  expect(csv.headers()['content-type']).toContain('text/csv')
  expect(await csv.text()).toContain(`@${tag}`)

  // Revoke: the old link is dead at once.
  await page.getByRole('button', { name: 'Revoke report links' }).click()
  await page.getByRole('button', { name: 'Revoke links' }).click()
  await expect(page.getByText('Every report link for this campaign has stopped working.')).toBeVisible()
  await report.goto(link)
  await expect(report.getByText('This report link is no longer active.')).toBeVisible()
  expect((await report.request.get(`/api/r/${link.split('/r/')[1]}/report`)).status()).toBe(404)
  await client.close()
})

test('a made-up report link is not active', async ({ page }) => {
  await page.goto('/r/not-a-real-token.at-all')
  await expect(page.getByText('This report link is no longer active.')).toBeVisible()
})
