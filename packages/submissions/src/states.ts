// What creators see for each internal state (01_PRODUCT.md section 7). Safe in the browser.
export type CreatorStateTone = 'good' | 'wait' | 'bad' | 'off'

export const CREATOR_STATE: Record<string, { label: string; tone: CreatorStateTone }> = {
  checking: { label: 'Checking', tone: 'wait' },
  rejected_auto: { label: 'Rejected', tone: 'bad' },
  needs_review: { label: 'In review', tone: 'wait' },
  needs_info: { label: 'Needs info', tone: 'wait' },
  approved: { label: 'Approved', tone: 'good' },
  earning: { label: 'Earning', tone: 'good' },
  flagged: { label: 'In review', tone: 'wait' },
  final: { label: 'Final', tone: 'good' },
  paid_out: { label: 'Paid out', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' },
  removed: { label: 'Removed', tone: 'bad' },
  appealed: { label: 'Appeal open', tone: 'wait' },
}

/** The creator's filters, one per label, each covering the internal states behind it. */
export const CREATOR_FILTERS: { key: string; label: string; states: string[] }[] = [
  { key: 'in-review', label: 'In review', states: ['checking', 'needs_review', 'flagged', 'needs_info'] },
  { key: 'approved', label: 'Approved', states: ['approved'] },
  { key: 'earning', label: 'Earning', states: ['earning'] },
  { key: 'final', label: 'Final', states: ['final'] },
  { key: 'paid-out', label: 'Paid out', states: ['paid_out'] },
  { key: 'rejected', label: 'Rejected', states: ['rejected_auto', 'rejected', 'removed'] },
  { key: 'appeals', label: 'Appeal open', states: ['appealed'] },
]

export const DECISION_LABEL: Record<string, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  request_info: 'More information asked for',
  reverse: 'Decision reversed',
  remove: 'Removed',
}
