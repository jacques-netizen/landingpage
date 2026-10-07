// Expected refusals carry a stable code so callers can show the right message.
export type MoneyErrorCode =
  | 'not_whole_cents'
  | 'not_found'
  | 'insufficient_client_funds'
  | 'insufficient_available'
  | 'insufficient_balance'
  | 'below_minimum'
  | 'fee_exceeds_amount'
  | 'payout_not_verified'
  | 'creator_suspended'
  | 'withdrawal_already_requested'
  | 'wrong_withdrawal_status'
  | 'not_releasable'
  | 'nothing_to_reverse'
  | 'campaign_not_closed'
  | 'memo_required'
  | 'actor_required'
  | 'budget_below_spent'

export class MoneyError extends Error {
  constructor(
    readonly code: MoneyErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'MoneyError'
  }
}
