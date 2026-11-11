import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { signInAs } from './helpers'

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/mde', {
  max: 1,
  onnotice: () => {},
})
test.afterAll(() => sql.end())

async function newCreator(tag: string) {
  const email = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.invalid`
  const [u] = await sql`insert into users (email, display_name) values (${email}, ${tag}) returning id`
  await sql`insert into creator_profiles (user_id) values (${u!.id})`
  return u!.id as string
}

test('a reviewer messages one clipper without a warning, and every clipper of a campaign at once', async ({ page }) => {
  const one = await newCreator('messaged')
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto(`/admin/creators/${one}`)
  await expect(page.getByText('A plain message, not a warning: it adds no strike.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Title' }).fill('Posting tip')
  await page.getByRole('textbox', { name: 'Message' }).fill('Please add the sound link to your captions.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Message sent.')).toBeVisible()
  const [m] = await sql`select title, body from notifications where user_id = ${one} and kind = 'staff_message'`
  expect(m).toMatchObject({ title: 'Posting tip', body: 'Please add the sound link to your captions.' })
  const [p] = await sql`select strikes_active from creator_profiles where user_id = ${one}`
  expect(p!.strikes_active).toBe(0)

  // Everyone who joined a campaign, from its Clippers tab.
  const [c] = await sql`select id from campaigns where title = 'Sample music'`
  const a = await newCreator('member-a')
  const b = await newCreator('member-b')
  await sql`insert into campaign_members (campaign_id, creator_id, joined_at) values (${c!.id}, ${a}, now()), (${c!.id}, ${b}, now())`
  const [{ n: members }] =
    (await sql`select count(*)::int as n from campaign_members where campaign_id = ${c!.id}`) as [{ n: number }]
  await page.goto(`/admin/campaigns/${c!.id}?tab=clippers`)
  await page.getByRole('textbox', { name: 'Message' }).fill('New sound pack is up in the assets.')
  await page.getByRole('button', { name: 'Send to every clipper' }).click()
  await expect(page.getByText(`Message sent to ${members} clippers.`)).toBeVisible()
  const got =
    await sql`select user_id, title from notifications where kind = 'staff_message' and body = 'New sound pack is up in the assets.'`
  expect(got.map((r) => r.user_id)).toEqual(expect.arrayContaining([a, b]))
  expect(got[0]!.title).toBe('A message from the team')
})

test('finance switches payout method alerts off and on; reviewers do not see the switch', async ({ page }) => {
  await signInAs(page, 'reviewer@seed.invalid')
  await page.goto('/admin/notifications')
  await expect(page.getByText('Tell me when a clipper adds or changes their payout method')).toHaveCount(0)

  await signInAs(page, 'finance@seed.invalid')
  await page.goto('/admin/notifications')
  const box = page.getByRole('checkbox', { name: /Tell me when a clipper adds or changes their payout method/ })
  await expect(box).toBeChecked()
  await box.uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved. Payout method alerts are off.')).toBeVisible()
  const [off] = await sql`select notify_payout_changes from users where email = 'finance@seed.invalid'`
  expect(off!.notify_payout_changes).toBe(false)
  await page.reload()
  await page.getByRole('checkbox', { name: /Tell me when a clipper adds/ }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved. You will be told about payout method changes.')).toBeVisible()
  const [on] = await sql`select notify_payout_changes from users where email = 'finance@seed.invalid'`
  expect(on!.notify_payout_changes).toBe(true)
})
