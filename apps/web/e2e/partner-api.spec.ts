import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

// The partner API (owner decision, 2026-10-28): an admin makes a key in Developers, the partner reads
// campaigns with it, and the public docs explain how.
test('an admin makes a partner key that reads campaigns through the API, and revokes it', async ({ page, request }) => {
  await signInAs(page, 'admin@seed.invalid')
  await page.goto('/admin/developers')
  await page.getByLabel('Partner').fill(`E2E partner ${Date.now()}`)
  await page.getByLabel('Kind of key').selectOption('live')
  await page.getByRole('button', { name: 'Create key' }).click()
  const key = await page.getByRole('textbox', { name: 'New API key' }).inputValue()
  expect(key).toMatch(/^mde_live_[A-Za-z0-9]{32}$/)

  const auth = { Authorization: `Bearer ${key}` }
  const me = await request.get('/api/v1/me', { headers: auth })
  expect(me.status()).toBe(200)
  expect(await me.json()).toMatchObject({ object: 'api_key', livemode: true })
  const list = await (await request.get('/api/v1/campaigns?limit=100', { headers: auth })).json()
  const sample = list.data.find((c: { title: string }) => c.title === 'Sample clipping')
  expect(sample).toMatchObject({ object: 'campaign', status: 'live' })
  const clips = await (await request.get(`/api/v1/campaigns/${sample.id}/clips?limit=5`, { headers: auth })).json()
  expect(clips.object).toBe('list')
  expect(JSON.stringify(clips)).not.toMatch(/email|earned/)
  expect((await request.get('/api/v1/me')).status()).toBe(401)

  await page.getByRole('button', { name: 'Done' }).click()
  page.once('dialog', (d) => d.accept())
  await page
    .getByRole('listitem')
    .filter({ hasText: key.slice(0, 13) })
    .getByRole('button', { name: 'Revoke' })
    .click()
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: key.slice(0, 13) })
      .getByText(/Revoked/),
  ).toBeVisible()
  expect((await request.get('/api/v1/me', { headers: auth })).status()).toBe(401)
})

test('the developer docs are public, with a reference page for every endpoint', async ({ page, request }) => {
  await page.goto('/developers')
  await expect(page.getByRole('heading', { name: "Build on Maison d'Élites" })).toBeVisible()
  const spec = await (await request.get('/api/v1/openapi.json')).json()
  const ids = Object.values(spec.paths as Record<string, Record<string, { operationId: string }>>).flatMap((m) =>
    Object.values(m).map((o) => o.operationId),
  )
  expect(ids.length).toBeGreaterThanOrEqual(10)
  for (const id of ids) expect((await request.get(`/developers/reference/${id}`)).status(), id).toBe(200)
  for (const p of [
    'quickstart',
    'authentication',
    'sandbox',
    'webhooks',
    'pagination',
    'errors',
    'changelog',
    'access',
  ])
    expect((await request.get(`/developers/${p}`)).status(), p).toBe(200)
  await page.goto('/developers/webhooks')
  await expect(page.getByRole('heading', { name: 'Check the signature' })).toBeVisible()
})
