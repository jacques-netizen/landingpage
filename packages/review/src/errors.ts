export class ReviewError extends Error {
  constructor(
    readonly code: 'not_found' | 'wrong_state' | 'reason_required' | 'note_required' | 'already_appealed' | 'paid_out',
    message: string,
  ) {
    super(message)
    this.name = 'ReviewError'
  }
}
