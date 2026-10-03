/** Fees from docs/02_DATA_AND_MONEY.md sections 4 and 6. Pure and integer only. Fees round half up. */

const BPS = 10_000n

/** round_half_up(amount * bps / 10000) for non-negative amounts. */
function roundHalfUpBps(amountCents: bigint, bps: number): bigint {
  if (!Number.isSafeInteger(bps) || bps < 0)
    throw new Error('Basis points must be a non-negative whole number')
  if (amountCents < 0n) throw new Error('Amount cannot be negative')
  return (amountCents * BigInt(bps) + BPS / 2n) / BPS
}

/** MDE service fee on a client's budget. The client pays budget plus this fee. */
export function serviceFee(budgetCents: bigint, serviceFeeBps: number): bigint {
  return roundHalfUpBps(budgetCents, serviceFeeBps)
}

export function clientFundingTotal(budgetCents: bigint, serviceFeeBps: number): bigint {
  return budgetCents + serviceFee(budgetCents, serviceFeeBps)
}

export type WithdrawalFeeSettings = { feeBps: number; feeMinCents: number }
export type WithdrawalQuote = { amountCents: bigint; feeCents: bigint; netCents: bigint }

/**
 * The one function that quotes a withdrawal. The browser and the server both call it, so the number
 * shown before confirming is the number the server uses.
 */
export function withdrawalQuote(
  amountCents: bigint,
  settings: WithdrawalFeeSettings,
): WithdrawalQuote {
  if (amountCents <= 0n) throw new Error('Withdrawal amount must be more than zero')
  const percent = roundHalfUpBps(amountCents, settings.feeBps)
  const minimum = BigInt(settings.feeMinCents)
  const feeCents = percent > minimum ? percent : minimum
  if (feeCents >= amountCents)
    throw new Error('The fee is as large as the amount, so nothing would be paid out')
  return { amountCents, feeCents, netCents: amountCents - feeCents }
}
