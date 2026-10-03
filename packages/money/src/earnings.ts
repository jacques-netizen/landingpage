/**
 * Earnings for one post, from docs/02_DATA_AND_MONEY.md section 5. Pure, integer only (bigint), no database.
 * The engine recomputes the post total from counted views every time and posts only the difference.
 */
export type EarningsInput = {
  countedViews: number | bigint
  /** Locked at submit time. Later campaign rate changes never apply to an existing post. */
  rateCentsPer1000: number
  minViewsToEarn: number | null
  capPerPostCents?: bigint | null
  capPerCreatorCents?: bigint | null
  /** What this creator has already earned in the campaign on their other posts. */
  creatorEarnedElsewhereCents: bigint
  /** Balance of the campaign budget account right now. */
  budgetBalanceCents: bigint
  /** What has already been moved into pending for this post. */
  alreadyEarnedCents: bigint
  /** False once the campaign is closing or closed. Then only corrections down apply. */
  acceptingNewEarnings: boolean
}

export type EarningsResult = {
  rawCents: bigint
  postCents: bigint
  deltaCents: bigint
  /** Budget balance after posting the delta. */
  budgetAfterCents: bigint
  budgetExhausted: boolean
}

const min = (...xs: bigint[]) => xs.reduce((a, b) => (b < a ? b : a))

export function computePostEarnings(input: EarningsInput): EarningsResult {
  const counted = BigInt(input.countedViews)
  if (counted < 0n) throw new Error('Counted views cannot be negative')
  if (!Number.isInteger(input.rateCentsPer1000) || input.rateCentsPer1000 <= 0) {
    throw new Error('Rate must be a positive whole number of cents per 1,000 views')
  }

  const belowMinimum = counted < BigInt(input.minViewsToEarn ?? 0)
  // floor, so rounding never creates money
  const rawCents = belowMinimum ? 0n : (counted * BigInt(input.rateCentsPer1000)) / 1000n

  const limits: bigint[] = [rawCents]
  if (input.capPerPostCents != null) limits.push(input.capPerPostCents)
  if (input.capPerCreatorCents != null) {
    limits.push(input.capPerCreatorCents - input.creatorEarnedElsewhereCents)
  }
  // The budget can pay what is left plus what this post already took from it.
  limits.push(input.budgetBalanceCents + input.alreadyEarnedCents)

  let postCents = min(...limits)
  if (postCents < 0n) postCents = 0n
  // Closing or closed campaigns never grow a post, but views corrected down still reduce it.
  if (!input.acceptingNewEarnings) postCents = min(postCents, input.alreadyEarnedCents)

  const deltaCents = postCents - input.alreadyEarnedCents
  const budgetAfterCents = input.budgetBalanceCents - deltaCents
  return {
    rawCents,
    postCents,
    deltaCents,
    budgetAfterCents,
    budgetExhausted: budgetAfterCents <= 0n,
  }
}
