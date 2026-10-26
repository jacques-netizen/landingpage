import { expect, test, type Page } from '@playwright/test'
import Redis from 'ioredis'
import postgres from 'postgres'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

async function clearCaches() {
  const r = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: 1 })
  try {
    const keys = [...(await r.keys('campaign-report-data:*')), ...(await r.keys('rl:report-pdf:*'))]
    if (keys.length) await r.del(...keys)
  } finally {
    r.disconnect()
  }
}

// Winnerman's first week as the reference report shows it: TikTok only, $2,000 at a $2 client CPM.
const CLIPS: [string, string, number, number][] = [
  ['dk_baj', '7697296279830940944', 17379, 3434],
  ['dk_baj', '7697383810723286290', 16927, 3274],
  ['lirickoss22', '7697993527162129685', 4920, 87],
  ['ander_lyrics', '7697284834724449558', 3771, 335],
  ['lirickoss22', '7697310375837994261', 2998, 41],
  ['felyrics38', '7698557012912672021', 2772, 138],
]

async function makeCampaign(tag: string) {
  const [c] = await sql`
    insert into campaigns
    select (jsonb_populate_record(null::campaigns, to_jsonb(c) || jsonb_build_object(
      'id', gen_random_uuid(), 'title', ${`Davido X ${tag}-Audio`}::text, 'status', 'live', 'report_secret', null,
      'start_at', now() - interval '10 days', 'budget_cents', 100000, 'client_budget_cents', 200000,
      'rate_cents_per_1000', 100, 'client_spend_factor', 2, 'min_views_to_earn', 1000, 'platforms', array['tiktok'],
      'demo', false, 'closed_at', null, 'release_at', null))).*
    from campaigns c where title = 'Sample clipping' returning id, current_terms_version_id as terms`
  for (const [i, [handle, postId, views, likes]] of CLIPS.entries()) {
    const email = `${tag}${i}@test.invalid`
    const [u] = await sql`insert into users (email, username) values (${email}, ${`${tag}${i}`}) returning id`
    await sql`insert into creator_profiles (user_id) values (${u!.id})`
    const [s] = await sql`
      insert into submissions (campaign_id, creator_id, platform, post_url, platform_post_id, state, terms_version_id,
        rate_cents_per_1000_locked, submitted_at, published_at, latest_views, counted_views, earned_cents)
      values (${c!.id}, ${u!.id}, 'tiktok', ${`https://www.tiktok.com/@${handle}/video/${postId}`}, ${postId}, 'approved',
        ${c!.terms}, 100, now() - interval '9 days', now() - interval '9 days', ${views}, ${views}, ${Math.floor(views / 10)})
      returning id`
    await sql`insert into view_snapshots (submission_id, taken_at, views, likes, comments, shares) values (${s!.id}, now(), ${views}, ${likes}, 10, 20)`
    await sql`insert into view_snapshot_days (submission_id, day, taken_at, views, likes, comments, shares)
      values (${s!.id}, (now() at time zone 'UTC')::date, now(), ${views}, ${likes}, 10, 20)`
  }
  return c!.id as string
}

const preview = (page: Page) => page.frameLocator('iframe[title="Report preview"]')

test('staff create, edit and publish a weekly report, which stays frozen, and a final report that reads live numbers', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000)
  const tag = `wm${Date.now() % 1e7}`
  const campaignId = await makeCampaign(tag)
  await signInAs(page, 'admin@seed.invalid')
  await page.goto(`/admin/campaigns/${campaignId}?tab=reports`)
  await expect(page.getByText('No reports yet.')).toBeVisible()
  await page.getByLabel('Artist name').fill(`Winnerman ${tag}`)
  await page.getByLabel('Prepared for (optional)').fill('winnermanuniverse')
  await expect(page.getByText(`/reports/winnerman-${tag}-week-1`)).toBeVisible()
  await page.getByRole('button', { name: 'Create report', exact: true }).click()
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}/)

  // The preview is the report page itself, from the campaign's data.
  const frame = preview(page)
  await expect(frame.locator('h1')).toContainText('Week 1 report')
  await expect(frame.getByText('Prepared for @winnermanuniverse')).toBeVisible()
  await expect(frame.getByText('Progress toward 1M views')).toBeVisible()
  await expect(frame.locator('.vtile')).toHaveCount(6)
  await expect(frame.getByText('Results by platform')).toHaveCount(0)

  // A switch makes a version; undo goes back to the one before.
  await page.getByRole('checkbox', { name: /What we learned/ }).uncheck()
  await expect(frame.getByText('What we learned')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Versions' }).getByText('Hid learned')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(frame.locator('.snum', { hasText: 'What we learned' })).toHaveCount(1)

  // Publish; the public page opens with no login.
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Published' })).toBeVisible()
  await expect(page.getByLabel('What to change')).toBeDisabled()
  const slug = `winnerman-${tag}-week-1`
  const client = await (await browser.newContext()).newPage()
  await client.goto(`/reports/${slug}`)
  await expect(client.locator('h1')).toContainText('Week 1 report')
  await expect(client.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  const views = await client.locator('.prog .pv b').first().textContent()
  expect(views).toBe('48.8K')

  // Frozen: new views do not change a published weekly report.
  await sql`update view_snapshot_days set views = views + 500000 where submission_id in (select id from submissions where campaign_id = ${campaignId})`
  await clearCaches()
  await client.reload()
  await expect(client.locator('.prog .pv b').first()).toHaveText('48.8K')

  // The PDF is the same page, printed.
  const pdf = await client.request.get(`/reports/${slug}.pdf`)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')

  // A final report reads the numbers again on every open, and staff see the text that went stale.
  await page.goto(`/admin/campaigns/${campaignId}?tab=reports`)
  await page.getByRole('radio', { name: 'Final report' }).click()
  await page.getByLabel('Artist name').fill(`Winnerman ${tag}`)
  await page.getByRole('button', { name: 'Create report', exact: true }).click()
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}/)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Published' })).toBeVisible()
  await client.goto(`/reports/winnerman-${tag}-final`)
  await expect(client.locator('h1')).toContainText('Final report')
  const before = await client.locator('.big .bv').first().textContent()
  await sql`update view_snapshot_days set views = views + 400000 where submission_id in (select id from submissions where campaign_id = ${campaignId})`
  await clearCaches()
  await client.reload()
  await expect(client.locator('.big .bv').first()).not.toHaveText(before!)
  await page.goto(`/admin/campaigns/${campaignId}?tab=reports`)
  await expect(page.getByText(/quote[s]? a number that has changed since it was published/)).toBeVisible()

  // Unpublished addresses are not found.
  const gone = await client.request.get(`/reports/winnerman-${tag}-week-9`)
  expect(gone.status()).toBe(404)
})
