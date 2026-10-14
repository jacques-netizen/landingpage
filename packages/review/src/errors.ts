export class ReviewError extends Error {
  constructor(
    readonly code:
      | 'not_found'
      | 'wrong_state'
      | 'reason_required'
      | 'note_required'
      | 'already_appealed'
      | 'paid_out'
      | 'campaign_closed'
      | 'waiting'
      | 'too_soon'
      | 'file_required'
      | 'bad_file'
      | 'expired'
      | 'views_required'
      | 'views_down',
    message: string,
  ) {
    super(message)
    this.name = 'ReviewError'
  }
}
