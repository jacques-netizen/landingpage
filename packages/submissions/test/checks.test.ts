import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import {
  checkAccountRules,
  checkAuthor,
  checkCaption,
  checkDuration,
  checkMedia,
  checkNotDuplicate,
  checkOpen,
  checkPlatform,
  checkPostLimit,
  checkPublic,
  checkTiming,
  dHash,
  decodeImage,
  hammingHex,
  type Account,
  type CampaignRules,
} from '../src'

// Phase 3 acceptance: each automatic check has a test and returns the right reason code.
const now = new Date('2026-10-05T12:00:00Z')
const rules: CampaignRules = {
  status: 'live',
  startAt: new Date('2026-10-01T00:00:00Z'),
  endAt: new Date('2026-10-31T00:00:00Z'),
  platforms: ['tiktok', 'youtube'],
  maxPostsPerAccount: 2,
  minFollowers: 1000,
  minAccountAgeDays: 30,
  minDurationSeconds: 15,
  requiredHashtags: ['#walmart', 'deals'],
  requireAdDisclosure: true,
}
const account: Account = {
  id: 'a1',
  platform: 'tiktok',
  handle: 'maya',
  status: 'verified',
  platformUserId: 'tt-1',
  followers: 5000,
  accountCreatedAt: new Date('2024-01-01T00:00:00Z'),
}
const hours = (h: number) => new Date(now.getTime() - h * 3_600_000)

describe('check 1: joined, live and inside the window', () => {
  it('passes for a joined creator in a live campaign', () => expect(checkOpen(rules, true, now).status).toBe('pass'))
  it('needs joining first', () => expect(checkOpen(rules, false, now)).toMatchObject({ status: 'fail' }))
  it('fails after the end date with posted_after_end', () =>
    expect(checkOpen({ ...rules, endAt: hours(1) }, true, now).reason).toBe('posted_after_end'))
  it('fails when the campaign is closing or closed with posted_after_end', () =>
    expect(checkOpen({ ...rules, status: 'closing' }, true, now).reason).toBe('posted_after_end'))
  it('fails before the start with posted_before_start', () =>
    expect(checkOpen({ ...rules, startAt: new Date('2026-10-06T00:00:00Z') }, true, now).reason).toBe(
      'posted_before_start',
    ))
})

describe('check 2: a post link on an allowed platform', () => {
  it('passes for an allowed platform', () => expect(checkPlatform(rules, { platform: 'tiktok' }).status).toBe('pass'))
  it('fails a platform the campaign does not allow with wrong_platform', () =>
    expect(checkPlatform(rules, { platform: 'instagram' }).reason).toBe('wrong_platform'))
  it('fails a link that is not a post', () => expect(checkPlatform(rules, null).status).toBe('fail'))
})

describe('check 3: posted on a linked account', () => {
  it('matches the author id to a verified account', () => {
    const r = checkAuthor([account], 'tiktok', { authorPlatformUserId: 'tt-1' }, null)
    expect(r.result.status).toBe('pass')
    expect(r.account?.id).toBe('a1')
  })
  it('fails another author with not_linked_account', () =>
    expect(checkAuthor([account], 'tiktok', { authorPlatformUserId: 'tt-9' }, 'maya').result.reason).toBe(
      'not_linked_account',
    ))
  it('fails an account that is not verified yet', () =>
    expect(
      checkAuthor([{ ...account, status: 'pending' }], 'tiktok', { authorPlatformUserId: 'tt-1' }, null).result.reason,
    ).toBe('not_linked_account'))
  it('falls back to the handle in the link when the platform gives no author', () => {
    expect(checkAuthor([account], 'tiktok', { authorPlatformUserId: null }, 'maya').result.status).toBe('pass')
    expect(checkAuthor([account], 'tiktok', { authorPlatformUserId: null }, null).result.reason).toBe(
      'not_linked_account',
    )
  })
})

describe('check 4: not already in the campaign', () => {
  it('passes a new post', () => expect(checkNotDuplicate(false).status).toBe('pass'))
  it('fails a repeat with duplicate_post', () => expect(checkNotDuplicate(true).reason).toBe('duplicate_post'))
})

describe('check 5: posts per account', () => {
  it('passes under the limit', () => expect(checkPostLimit(rules, 1).status).toBe('pass'))
  it('fails at the limit with post_limit_reached', () =>
    expect(checkPostLimit(rules, 2).reason).toBe('post_limit_reached'))
  it('has no limit when none is set', () =>
    expect(checkPostLimit({ ...rules, maxPostsPerAccount: null }, 500).status).toBe('pass'))
})

describe('check 6: public post with visible stats', () => {
  const ok = { exists: true, isPublic: true, views: 10 }
  it('passes a public post', () => expect(checkPublic(ok).status).toBe('pass'))
  it.each([
    ['missing', { ...ok, exists: false }],
    ['private', { ...ok, isPublic: false }],
    ['hidden stats', { ...ok, views: null }],
  ])('fails a %s post with private_or_hidden_stats', (_, post) =>
    expect(checkPublic(post).reason).toBe('private_or_hidden_stats'),
  )
})

describe('check 7: published at the right time', () => {
  it('passes a post from 3 hours ago', () =>
    expect(checkTiming(rules, { publishedAt: hours(3) }, 24, now).status).toBe('pass'))
  it('fails a post from before the start with posted_before_start', () =>
    expect(checkTiming(rules, { publishedAt: new Date('2026-09-30T00:00:00Z') }, 24, now).reason).toBe(
      'posted_before_start',
    ))
  it('fails a post older than max_post_age_hours with posted_too_early', () =>
    expect(checkTiming(rules, { publishedAt: hours(25) }, 24, now).reason).toBe('posted_too_early'))
  it('follows the setting', () => expect(checkTiming(rules, { publishedAt: hours(25) }, 48, now).status).toBe('pass'))
  it('leaves an unknown time to a reviewer', () =>
    expect(checkTiming(rules, { publishedAt: null }, 24, now).status).toBe('review'))
})

describe('check 8: follower and account age minimums', () => {
  it('passes an account that meets both', () => expect(checkAccountRules(rules, account, now).status).toBe('pass'))
  it('fails too few followers with account_below_followers', () =>
    expect(checkAccountRules(rules, { ...account, followers: 999 }, now).reason).toBe('account_below_followers'))
  it('fails hidden followers when a minimum is set', () =>
    expect(checkAccountRules(rules, { ...account, followers: null }, now).reason).toBe('account_below_followers'))
  it('fails a new account with account_too_new', () =>
    expect(checkAccountRules(rules, { ...account, accountCreatedAt: hours(24 * 10) }, now).reason).toBe(
      'account_too_new',
    ))
  it('leaves an unknown account age to a reviewer', () =>
    expect(checkAccountRules(rules, { ...account, accountCreatedAt: null }, now).status).toBe('review'))
})

describe('check 9: minimum duration', () => {
  it('passes a long enough video', () => expect(checkDuration(rules, { durationSeconds: 15 }).status).toBe('pass'))
  it('fails a short video with below_min_duration', () =>
    expect(checkDuration(rules, { durationSeconds: 14 }).reason).toBe('below_min_duration'))
  it('leaves an unknown length to a reviewer', () =>
    expect(checkDuration(rules, { durationSeconds: null }).status).toBe('review'))
})

describe('check 10: hashtags and ad disclosure', () => {
  it('passes with every hashtag and #ad, ignoring case', () =>
    expect(checkCaption(rules, { caption: 'Great find #Walmart #DEALS #ad' }).status).toBe('pass'))
  it('fails a missing hashtag with missing_hashtag', () => {
    const r = checkCaption(rules, { caption: 'Great find #walmart #ad' })
    expect(r.reason).toBe('missing_hashtag')
    expect(r.detail).toBe('Missing #deals')
  })
  it('does not accept a longer tag as the required one', () =>
    expect(checkCaption(rules, { caption: '#walmartdeals #deals #ad' }).reason).toBe('missing_hashtag'))
  it('fails a missing disclosure with missing_disclosure', () =>
    expect(checkCaption(rules, { caption: '#walmart #deals' }).reason).toBe('missing_disclosure'))
  it('accepts "Paid partnership" as a disclosure', () =>
    expect(checkCaption(rules, { caption: 'Paid partnership with Walmart #walmart #deals' }).status).toBe('pass'))
  it('needs no disclosure when the campaign does not ask', () =>
    expect(checkCaption({ ...rules, requireAdDisclosure: false }, { caption: '#walmart #deals' }).status).toBe('pass'))
})

describe('check 11: duplicate media', () => {
  it('flags a close match for review instead of rejecting', () => {
    const r = checkMedia('ffff0000ffff0000', ['ffff0000ffff0001'])
    expect(r.status).toBe('review')
    expect(r.reason).toBeUndefined()
  })
  it('passes a different clip', () => expect(checkMedia('ffff0000ffff0000', ['0000ffff0000ffff']).status).toBe('pass'))
  it('passes when there is nothing to compare', () =>
    expect(checkMedia(null, ['ffff0000ffff0000']).status).toBe('pass'))
  it('counts differing bits', () => {
    expect(hammingHex('00000000', '00000003')).toBe(2)
    expect(hammingHex('ffffffffffffffff', '0000000000000000')).toBe(64)
  })

  it('gives the same clip near hashes and a different clip a far one', () => {
    const img = (w: number, h: number, f: (x: number, y: number) => number) => {
      const png = new PNG({ width: w, height: h })
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const v = Math.max(0, Math.min(255, Math.round(f(x / w, y / h))))
          png.data[i] = png.data[i + 1] = png.data[i + 2] = v
          png.data[i + 3] = 255
        }
      return decodeImage(PNG.sync.write(png))!
    }
    const scene = (x: number, y: number) => 128 + 100 * Math.sin(x * 9) * Math.cos(y * 7)
    const a = dHash(img(320, 180, scene))
    const resized = dHash(img(160, 90, scene))
    const brighter = dHash(img(320, 180, (x, y) => scene(x, y) * 0.9 + 20))
    const other = dHash(img(320, 180, (x, y) => 128 + 100 * Math.cos(x * 4 + 1) * Math.sin(y * 11)))
    expect(hammingHex(a, resized)).toBeLessThanOrEqual(10)
    expect(hammingHex(a, brighter)).toBeLessThanOrEqual(10)
    expect(hammingHex(a, other)).toBeGreaterThan(10)
  })
})
