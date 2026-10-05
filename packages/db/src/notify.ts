import type { DbOrTx } from './client'
import { notifications } from './schema'

// In-app notifications (03_SYSTEMS.md section 9). Each event writes one row in the same transaction as
// the change it reports; the email for it is sent from that row by the worker.
export type NotificationKind =
  | 'submission_approved'
  | 'submission_rejected'
  | 'submission_removed'
  | 'needs_info'
  | 'earnings_released'
  | 'withdrawal_status'
  | 'appeal_reply'
  | 'new_campaign'
  | 'warning_issued'
  | 'appeal_opened'
  | 'campaign_event'
  | 'payout_failed'

export async function notify(
  d: DbOrTx,
  userId: string,
  kind: NotificationKind,
  n: { title: string; body?: string | null; link?: string | null },
) {
  await d.insert(notifications).values({ userId, kind, title: n.title, body: n.body ?? null, link: n.link ?? null })
}
