// Fees. Safe to import in the browser: the withdraw form shows the fee and total with this same
// function the server uses (02_DATA_AND_MONEY.md section 6). Import from '@mde/money/quote'.
import { roundHalfUpBps } from './math'

export { roundHalfUpBps }

/** MDE service fee on a campaign budget: budget * fee bps / 10,000, rounded half up. */
export function serviceFeeCents(budgetCents: number, serviceFeeBps: number): number {
  return roundHalfUpBps(budgetCents, serviceFeeBps)
}

export type WithdrawalFeeSettings = {
  withdrawal_fee_bps: number
  withdrawal_fee_min_cents: number
  withdrawal_min_cents: number
}

export type WithdrawalQuote =
  | { ok: true; amountCents: number; feeCents: number; netCents: number }
  | { ok: false; code: 'not_whole_cents' | 'below_minimum' | 'fee_exceeds_amount'; message: string }

const dollars = (c: number) => `$${Math.floor(c / 100).toLocaleString('en-US')}.${String(c % 100).padStart(2, '0')}`

/** Fee and net for a withdrawal. The amount is taken from available; the creator receives net. */
export function withdrawalQuote(amountCents: number, s: WithdrawalFeeSettings): WithdrawalQuote {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0)
    return { ok: false, code: 'not_whole_cents', message: 'Enter an amount in dollars and cents.' }
  if (amountCents < s.withdrawal_min_cents || amountCents === 0)
    return {
      ok: false,
      code: 'below_minimum',
      message: `The minimum withdrawal is ${dollars(Math.max(s.withdrawal_min_cents, 1))}.`,
    }
  const feeCents = Math.max(s.withdrawal_fee_min_cents, roundHalfUpBps(amountCents, s.withdrawal_fee_bps))
  const netCents = amountCents - feeCents
  if (netCents <= 0)
    return {
      ok: false,
      code: 'fee_exceeds_amount',
      message: `The fee of ${dollars(feeCents)} is more than this amount.`,
    }
  return { ok: true, amountCents, feeCents, netCents }
}
