import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs, signUpNewCreator } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

/** A post on "Sample clipping" in the given state, for the given creator. */
async function seedPost(creatorId: string, state: string, tag: string) {
  const [c] =
    await sql`select id, current_terms_version_id as terms, rate_cents_per_1000 as rate from campaigns where title = 'Sample clipping'`
  const id = `${tag}${Date.now()}${Math.floor(Math.random() * 1e4)}`
  const [s] = await sql`
    insert into submissions (campaign_id, creator_id, platform, post_url, platform_post_id, state, terms_version_id,
      rate_cents_per_1000_locked, reason_code, submitted_at)
    values (${c!.id}, ${creatorId}, 'tiktok', ${`https://www.tiktok.com/@${tag}/video/${id}`}, ${id}, ${state},
      ${c!.terms}, ${c!.rate}, 'missing_hashtag', now() - interval '1 day')
    returning id`
  return s!.id as string
}

async function newCreator(tag: string) {
  const [u] =
    await sql`insert into users (email, display_name) values (${`${tag}-${Date.now()}@test.invalid`}, ${tag}) returning id`
  await sql`insert into creator_profiles (user_id) values (${u!.id})`
  return u!.id as string
}

test('a creator appeals a rejected post from the submission drawer', async ({ page }) => {
  const email = await signUpNewCreator(page, 'appealer')
  const [u] = await sql`select id from users where email = ${email}`
  const id = await seedPost(u!.id, 'rejected', 'appealer')
  await page.goto('/submissions')
  await page.getByRole('button', { name: 'Sample clipping' }).click()
  await page.getByLabel('Why should the decision change?').fill('The hashtag is in the first comment, see link.')
  await page.getByLabel('Links').fill('https://example.com/screenshot')
  await page.getByRole('button', { name: 'Send appeal' }).click()
  await expect(page.getByText('Appeal sent, waiting for a reply.')).toBeVisible()
  const [s] = await sql`select state from submissions where id = ${id}`
  expect(s!.state).toBe('appealed')
  const [a] = await sql`select message, links, previous_state from appeals where submission_id = ${id}`
  expect(a).toMatchObject({
    message: 'The hashtag is in the first comment, see link.',
    links: ['https://example.com/screenshot'],
    previous_state: 'rejected',
  })
})

test('staff see appeals ordered by deadline and the dashboard flags any within 24 hours', async ({ page }) => {
  const creator = await newCreator('deadline')
  const later = await seedPost(creator, 'appealed', 'later')
  const soon = await seedPost(creator, 'appealed', 'soon')
  const [laterAppeal] = await sql`
    insert into appeals (submission_id, creator_id, message, due_at, previous_state)
    values (${later}, ${creator}, 'Later one', now() + interval '3 days', 'rejected') returning id`
  const [soonAppeal] = await sql`
    insert into appeals (submission_id, creator_id, message, due_at, previous_state)
    values (${soon}, ${creator}, 'Soon one', now() + interval '5 hours', 'rejected') returning id`

  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto('/admin/appeals')
  const hrefs = await page
    .getByRole('table', { name: 'Open appeals by deadline' })
    .getByRole('link')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  const soonAt = hrefs.indexOf(`/admin/appeals/${soonAppeal!.id}`)
  const laterAt = hrefs.indexOf(`/admin/appeals/${laterAppeal!.id}`)
  expect(soonAt).toBeGreaterThanOrEqual(0)
  expect(soonAt).toBeLessThan(laterAt)
  await expect(page.getByText(/within 24 hours/).first()).toBeVisible()

  await page.goto('/admin')
  const due = page.getByRole('region', { name: 'Appeals due within 24 hours' })
  await expect(due.locator(`a[href="/admin/appeals/${soonAppeal!.id}"]`)).toBeVisible()
  await expect(due.locator(`a[href="/admin/appeals/${laterAppeal!.id}"]`)).toHaveCount(0)
})

test('overturning an appeal restores the post and tells the creator', async ({ page }) => {
  const creator = await newCreator('overturn')
  const id = await seedPost(creator, 'appealed', 'overturn')
  const [a] = await sql`
    insert into appeals (submission_id, creator_id, message, due_at, previous_state)
    values (${id}, ${creator}, 'Please look again', now() + interval '2 days', 'rejected') returning id`
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto(`/admin/appeals/${a!.id}`)
  await expect(page.getByText('Please look again')).toBeVisible()
  await page.getByLabel('Reply to the creator').fill('You are right, the hashtag is there.')
  await page.getByRole('button', { name: 'Overturn' }).click()
  await expect(page.getByText('Overturned. Reply: You are right, the hashtag is there.')).toBeVisible()
  const [s] = await sql`select state from submissions where id = ${id}`
  expect(s!.state).toBe('approved')
  const [appeal] = await sql`select status, reply from appeals where id = ${a!.id}`
  expect(appeal).toMatchObject({ status: 'overturned', reply: 'You are right, the hashtag is there.' })
})
