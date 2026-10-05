import { expect, test } from '@playwright/test'
import http from 'node:http'
import { signUpNewCreator } from './helpers'

// Phase 3 acceptance: a creator links an account by YouTube login. Google's consent page, token
// endpoint and the YouTube API are faked; the app's own routes, checks and storage are real.
// The server is started with GOOGLE_TOKEN_URL_OVERRIDE and YOUTUBE_API_URL_OVERRIDE pointing here.
const FAKE_PORT = 3199
const channelId = `UCe2e${Date.now()}`
let fake: http.Server

test.beforeAll(async () => {
  fake = http.createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${FAKE_PORT}`)
    res.setHeader('content-type', 'application/json')
    if (url.pathname === '/token' && req.method === 'POST')
      return res.end(JSON.stringify({ access_token: 'fake-access', refresh_token: 'fake-refresh', expires_in: 3600 }))
    if (url.pathname === '/youtube/v3/channels' && req.headers.authorization === 'Bearer fake-access')
      return res.end(
        JSON.stringify({
          items: [
            {
              id: channelId,
              snippet: { customUrl: `@e2e${channelId.slice(-6)}`, publishedAt: '2018-04-01T00:00:00Z' },
              statistics: { subscriberCount: '32100' },
            },
          ],
        }),
      )
    res.statusCode = 404
    res.end('{}')
  })
  await new Promise<void>((r) => fake.listen(FAKE_PORT, r))
})
test.afterAll(() => new Promise<void>((r) => fake.close(() => r())))

test('a creator links a YouTube channel by YouTube login', async ({ page }) => {
  test.skip(!process.env.YOUTUBE_API_URL_OVERRIDE, 'needs the fake Google endpoints (set in CI)')
  await signUpNewCreator(page)
  // Google's consent page approves at once and sends the creator back with a code. Playwright cannot
  // intercept a redirect target, so the app's own start route is fetched here and Google's part is
  // played in its place, keeping the state cookie the app sets.
  await page.route('**/api/oauth/youtube/start', async (route) => {
    const res = await route.fetch({ maxRedirects: 0 })
    const google = new URL(res.headers()['location']!)
    expect(google.origin).toBe('https://accounts.google.com')
    expect(google.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/youtube.readonly')
    const back = new URL(google.searchParams.get('redirect_uri')!)
    back.searchParams.set('code', 'fake-code')
    back.searchParams.set('state', google.searchParams.get('state')!)
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/html', 'set-cookie': res.headers()['set-cookie']! },
      body: `<script>location.replace(${JSON.stringify(back.toString())})</script>`,
    })
  })
  await page.goto('/accounts')
  await page.getByRole('link', { name: /Link with YouTube login/ }).click()
  await expect(page.getByText('Your YouTube channel is linked and verified.')).toBeVisible()
  await expect(page.getByText(`@e2e${channelId.slice(-6)}`.toLowerCase())).toBeVisible()
  await expect(page.getByText('Verified', { exact: true })).toBeVisible()
  await expect(page.getByText('32,100')).toBeVisible()
})

test('a forged sign-in answer links nothing', async ({ page }) => {
  test.skip(!process.env.YOUTUBE_API_URL_OVERRIDE, 'needs the fake Google endpoints (set in CI)')
  await signUpNewCreator(page)
  await page.goto('/api/oauth/youtube/callback?code=fake-code&state=someone-else.abc')
  await expect(page.getByText('That sign-in link expired. Start again.')).toBeVisible()
  await expect(page.getByText('No accounts linked yet.')).toBeVisible()
})
