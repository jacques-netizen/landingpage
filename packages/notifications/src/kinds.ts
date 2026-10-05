import type { NotificationKind } from '@mde/db'

// Email subjects per kind. They are fixed words on purpose: a subject never carries a money amount or a
// reason (03_SYSTEMS.md section 9). The detail is in the body.
export const EMAIL_SUBJECT: Record<NotificationKind, string> = {
  submission_approved: 'Your post was approved',
  submission_rejected: 'An update on your post',
  submission_removed: 'An update on your post',
  needs_info: 'A reviewer has a question about your post',
  earnings_released: 'Earnings released to your wallet',
  withdrawal_status: 'An update on your withdrawal',
  appeal_reply: 'Your appeal has a reply',
  new_campaign: 'A new campaign for your accounts',
  warning_issued: 'A warning on your account',
  account_status: 'An update on a linked account',
  appeal_opened: 'New appeal to answer',
  appeal_due: 'An appeal is due soon',
  campaign_event: 'Campaign update',
  payout_failed: 'A payout failed',
}
