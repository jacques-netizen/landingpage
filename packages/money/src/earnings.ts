// Earnings rules from 02_DATA_AND_MONEY.md section 5. Pure functions, no database.
import { assertNonNegative, mulDivFloor } from './math'

/** Views after submission. Views from before submission never count. */
export function countedViews(latestViews: number, baselineViews: number): number {
  assertNonNegative(latestViews, 'Views')
  assertNonNegative(baselineViews, 'Baseline views')
  return Math.max(0, latestViews - baselineViews)
}

export type PostEarningsInput = {
  countedViews: number
  /** The rate copied onto the submission when it was created (the rate lock). */
  rateCentsPer1000Locked: number
  minViewsToEarn: number
  capPerPostCents: number | null
  capPerCreatorCents: number | null
  /** What this creator has earned in the campaign on their other posts. */
  creatorEarnedElsewhereCents: number
  campaignBudgetBalanceCents: number
  /** What this post has already been paid into pending. */
  earnedCentsAlready: number
}

/**
 * What one post should have earned in total, recomputed from its total counted views every time
 * (never by adding increments), and the change from what it has already earned.
 */
export function postEarnings(i: PostEarningsInput): { rawCents: number; postCents: number; deltaCents: number } {
  assertNonNegative(i.countedViews, 'Counted views')
  assertNonNegative(i.rateCentsPer1000Locked, 'Rate')
  assertNonNegative(i.minViewsToEarn, 'Minimum views')
  assertNonNegative(i.creatorEarnedElsewhereCents, 'Creator earnings')
  assertNonNegative(i.campaignBudgetBalanceCents, 'Budget balance')
  assertNonNegative(i.earnedCentsAlready, 'Earned so far')
  if (i.capPerPostCents !== null) assertNonNegative(i.capPerPostCents, 'Cap per post')
  if (i.capPerCreatorCents !== null) assertNonNegative(i.capPerCreatorCents, 'Cap per creator')

  const rawCents = i.countedViews < i.minViewsToEarn ? 0 : mulDivFloor(i.countedViews, i.rateCentsPer1000Locked, 1000)
  let postCents = rawCents
  if (i.capPerPostCents !== null) postCents = Math.min(postCents, i.capPerPostCents)
  if (i.capPerCreatorCents !== null)
    postCents = Math.min(postCents, Math.max(0, i.capPerCreatorCents - i.creatorEarnedElsewhereCents))
  postCents = Math.min(postCents, i.campaignBudgetBalanceCents + i.earnedCentsAlready)
  return { rawCents, postCents, deltaCents: postCents - i.earnedCentsAlready }
}
