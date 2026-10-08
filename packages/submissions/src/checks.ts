// The automatic checks on submission, in order (03_SYSTEMS.md section 4). Each is a small pure
// function so it can be tested alone. Labels follow the review mockup ("Posted on a linked account",
// "Required hashtag present", "Minimum duration", "Same clip posted before") with Pass, Fail and Review.
import type { ReasonCode } from '@mde/config'
import type { PostData } from '@mde/platforms'

export type CheckStatus = 'pass' | 'fail' | 'review'
export type CheckResult = { check: number; label: string; status: CheckStatus; reason?: ReasonCode; detail?: string }

const pass = (check: number, label: string, detail?: string): CheckResult => ({ check, label, status: 'pass', detail })
const fail = (check: number, label: string, reason: ReasonCode, detail?: string): CheckResult => ({
  check,
  label,
  status: 'fail',
  reason,
  detail,
})
const review = (check: number, label: string, detail: string): CheckResult => ({
  check,
  label,
  status: 'review',
  detail,
})

export type CampaignRules = {
  status: string
  startAt: Date | null
  endAt: Date | null
  platforms: string[]
  maxPostsPerAccount: number | null
  minFollowers: number | null
  minAccountAgeDays: number | null
  minDurationSeconds: number | null
  requiredHashtags: string[] | null
  requireAdDisclosure: boolean
}

export type Account = {
  id: string
  platform: string
  handle: string
  status: string
  platformUserId: string | null
  followers: number | null
  accountCreatedAt: Date | null
}

const DAY = 86_400_000
const HOUR = 3_600_000

/** 1. The creator has joined, and the campaign is live and inside its window. */
export function checkOpen(c: CampaignRules, joined: boolean, now: Date): CheckResult {
  const label = 'Joined and open for posts'
  if (!joined) return fail(1, label, 'other', 'Join the campaign before submitting.')
  if (c.status !== 'live' || (c.endAt && c.endAt <= now)) return fail(1, label, 'posted_after_end')
  if (c.startAt && c.startAt > now) return fail(1, label, 'posted_before_start', 'Submissions have not opened yet.')
  return pass(1, label)
}

/** 2. The link is a post on a platform this campaign allows. */
export function checkPlatform(c: CampaignRules, parsed: { platform: string } | null): CheckResult {
  const label = 'Link is a post on an allowed platform'
  if (!parsed)
    return fail(2, label, 'other', 'This link is not a post we can read. Copy the link from the post itself.')
  if (!c.platforms.includes(parsed.platform)) return fail(2, label, 'wrong_platform')
  return pass(2, label)
}

/**
 * 3. The post's author is one of the creator's verified accounts on that platform. When the platform
 * does not say who the author is, the handle in the link must match the account.
 */
export function checkAuthor(
  accounts: Account[],
  platform: string,
  post: Pick<PostData, 'authorPlatformUserId'>,
  urlHandle: string | null,
): { result: CheckResult; account: Account | null } {
  const label = 'Posted on a linked account'
  const verified = accounts.filter((a) => a.platform === platform && a.status === 'verified')
  const byId = post.authorPlatformUserId
    ? verified.find((a) => a.platformUserId === post.authorPlatformUserId)
    : undefined
  const byHandle = !post.authorPlatformUserId && urlHandle ? verified.find((a) => a.handle === urlHandle) : undefined
  const account = byId ?? byHandle ?? null
  if (!account) return { result: fail(3, label, 'not_linked_account'), account: null }
  return { result: pass(3, label, `@${account.handle}`), account }
}

/**
 * 3 and 8 while account linking is switched off (owner decision, 2026-10-08): nobody links an account, so
 * a reviewer checks that the post is the creator's own, and that the account meets any follower or
 * account age minimum. Never a rejection on its own.
 */
export function authorForReview(): CheckResult {
  return review(
    3,
    'Posted on a linked account',
    'Accounts are not linked for now. A reviewer checks this post is yours.',
  )
}
export function accountRulesForReview(c: CampaignRules): CheckResult {
  const label = 'Account meets the rules'
  if (c.minFollowers !== null || c.minAccountAgeDays !== null)
    return review(8, label, 'A reviewer checks the account meets the follower and age rules.')
  return pass(8, label)
}

/** 4. The same post is not already in this campaign. */
export function checkNotDuplicate(alreadySubmitted: boolean): CheckResult {
  const label = 'Not already in this campaign'
  return alreadySubmitted ? fail(4, label, 'duplicate_post') : pass(4, label)
}

/** 5. The account has not reached the campaign's posts per account. */
export function checkPostLimit(c: CampaignRules, postsFromAccount: number): CheckResult {
  const label = 'Within the post limit'
  if (c.maxPostsPerAccount !== null && postsFromAccount >= c.maxPostsPerAccount)
    return fail(5, label, 'post_limit_reached', `${c.maxPostsPerAccount} per account`)
  return pass(5, label)
}

/** 6. The post exists, is public, and its stats are visible. */
export function checkPublic(post: Pick<PostData, 'exists' | 'isPublic' | 'views'>): CheckResult {
  const label = 'Post and stats are public'
  if (!post.exists || !post.isPublic || post.views === null) return fail(6, label, 'private_or_hidden_stats')
  return pass(6, label)
}

/** 7. Published after the campaign opened, and no more than max_post_age_hours before submitting. */
export function checkTiming(
  c: CampaignRules,
  post: Pick<PostData, 'publishedAt'>,
  maxPostAgeHours: number,
  now: Date,
): CheckResult {
  const label = 'Posted at the right time'
  if (!post.publishedAt)
    return review(7, label, 'The platform did not give the time it was posted. A reviewer will check.')
  if (c.startAt && post.publishedAt < c.startAt) return fail(7, label, 'posted_before_start')
  if (now.getTime() - post.publishedAt.getTime() > maxPostAgeHours * HOUR) return fail(7, label, 'posted_too_early')
  return pass(7, label)
}

/** 8. The account meets the follower and account age minimums. */
export function checkAccountRules(c: CampaignRules, account: Account, now: Date): CheckResult {
  const label = 'Account meets the rules'
  if (c.minFollowers !== null && (account.followers === null || account.followers < c.minFollowers))
    return fail(8, label, 'account_below_followers')
  if (c.minAccountAgeDays !== null) {
    if (!account.accountCreatedAt)
      return review(8, label, 'The platform does not show when this account was made. A reviewer will check its age.')
    if (now.getTime() - account.accountCreatedAt.getTime() < c.minAccountAgeDays * DAY)
      return fail(8, label, 'account_too_new')
  }
  return pass(8, label)
}

/** 9. The video is at least the minimum duration. */
export function checkDuration(c: CampaignRules, post: Pick<PostData, 'durationSeconds'>): CheckResult {
  const label = 'Minimum duration'
  if (c.minDurationSeconds === null) return pass(9, label)
  if (post.durationSeconds === null)
    return review(9, label, 'The platform did not give the length. A reviewer will check.')
  if (post.durationSeconds < c.minDurationSeconds) return fail(9, label, 'below_min_duration')
  return pass(9, label)
}

function hashtags(caption: string) {
  return new Set((caption.toLowerCase().match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t))
}

/** 10. The caption has every required hashtag. There is no ad disclosure rule (owner decision). */
export function checkCaption(c: CampaignRules, post: Pick<PostData, 'caption'>): CheckResult {
  const label = 'Required hashtag present'
  const caption = post.caption ?? ''
  const tags = hashtags(caption)
  const missing = (c.requiredHashtags ?? [])
    .map((t) => `#${t.trim().replace(/^#+/, '').toLowerCase()}`)
    .filter((t) => t.length > 1 && !tags.has(t))
  if (missing.length) return fail(10, label, 'missing_hashtag', `Missing ${missing.join(' ')}`)
  return pass(10, label)
}

/** 11. A close match to another post in the campaign is flagged for review, never rejected. */
export function checkMedia(hash: string | null, others: string[], maxDistance = 10): CheckResult {
  const label = 'Same clip posted before'
  if (!hash) return pass(11, label, 'Not compared')
  const close = others.some((o) => hammingHex(hash, o) <= maxDistance)
  return close
    ? review(11, label, 'Looks like a clip already in this campaign. A reviewer will check.')
    : pass(11, label)
}

/** Bits that differ between two hex hashes of the same length. */
export function hammingHex(a: string, b: string) {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY
  let d = 0
  for (let i = 0; i < a.length; i += 8) {
    let x = parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16)
    while (x) {
      d += x & 1
      x >>>= 1
    }
  }
  return d
}
