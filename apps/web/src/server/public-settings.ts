import 'server-only'
import { db, getSettings } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'

/** The numbers public pages quote, read from settings so they always match what the platform does. */
export async function publicNumbers() {
  const s = await getSettings(db())
  return {
    reviewWindowDays: s.review_window_days,
    availableWhen:
      s.review_window_days === 0
        ? 'as soon as the campaign closes'
        : `${s.review_window_days} ${s.review_window_days === 1 ? 'day' : 'days'} after the campaign closes, when the review window ends`,
    withdrawalMin: formatDollars(s.withdrawal_min_cents),
    withdrawalFee: withdrawalFeeText(s.withdrawal_fee_bps, s.withdrawal_fee_min_cents),
    maxLinkedAccounts: s.max_linked_accounts,
    maxPostAgeHours: s.max_post_age_hours,
    appealReplyDays: s.appeal_reply_business_days,
    deletedPostGraceHours: s.deleted_post_grace_hours,
  }
}

export type PublicNumbers = Awaited<ReturnType<typeof publicNumbers>>

/** 250 bps is "2.5%". Whole numbers only, no floats. */
export function percentFromBps(bps: number) {
  const whole = Math.floor(bps / 100)
  const rest = String(bps % 100)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return `${whole}${rest ? `.${rest}` : ''}%`
}

export function withdrawalFeeText(bps: number, minCents: number) {
  if (bps === 0 && minCents === 0) return 'None'
  if (bps === 0) return `${formatDollars(minCents)} per withdrawal`
  if (minCents === 0) return `${percentFromBps(bps)} of the amount`
  return `${percentFromBps(bps)} of the amount, at least ${formatDollars(minCents)}`
}
