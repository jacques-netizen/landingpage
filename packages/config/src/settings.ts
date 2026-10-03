import { z } from 'zod'

/** Settings keys and defaults from docs/03_SYSTEMS.md section 15. Editable by admins, each change audited. */
export const settingsDefaults = {
  max_linked_accounts: 8,
  max_post_age_hours: 24,
  /** Hours between view checks by age of submission (docs/03_SYSTEMS.md 3.2). */
  view_check_intervals: { first72h: 2, untilClose: 12, keepLive: 24 },
  deleted_post_grace_hours: 48,
  review_window_days: 7,
  withdrawal_min_cents: 2000,
  withdrawal_fee_bps: 0,
  withdrawal_fee_min_cents: 0,
  appeal_reply_business_days: 5,
  strike_days: 60,
  auto_approve_clean_creators: false,
  fraud_thresholds: {
    view_jump_median_multiple: 5,
    view_jump_median_checks: 6,
    view_jump_views_per_hour: 20000,
    view_jump_small_account_followers: 1000,
    engagement_floor_bps: 20,
    engagement_min_views: 10000,
    follower_drop_percent: 50,
    velocity_new_account_posts_first_hour: 5,
  },
  bio_code_prefix: 'MDE',
  require_staff_2fa: true,
} as const

export type SettingKey = keyof typeof settingsDefaults
export type Settings = typeof settingsDefaults

export const settingKeys = Object.keys(settingsDefaults) as SettingKey[]

const int = z.number().int()
/** Validation for each key when an admin edits it. */
export const settingSchemas: Record<SettingKey, z.ZodType> = {
  max_linked_accounts: int.min(1).max(50),
  max_post_age_hours: int.min(1).max(720),
  view_check_intervals: z.object({
    first72h: int.min(1),
    untilClose: int.min(1),
    keepLive: int.min(1),
  }),
  deleted_post_grace_hours: int.min(0).max(720),
  review_window_days: int.min(0).max(90),
  withdrawal_min_cents: int.min(0),
  withdrawal_fee_bps: int.min(0).max(10000),
  withdrawal_fee_min_cents: int.min(0),
  appeal_reply_business_days: int.min(1).max(30),
  strike_days: int.min(1).max(365),
  auto_approve_clean_creators: z.boolean(),
  fraud_thresholds: z.object({
    view_jump_median_multiple: int.min(1),
    view_jump_median_checks: int.min(1),
    view_jump_views_per_hour: int.min(1),
    view_jump_small_account_followers: int.min(0),
    engagement_floor_bps: int.min(0).max(10000),
    engagement_min_views: int.min(0),
    follower_drop_percent: int.min(1).max(100),
    velocity_new_account_posts_first_hour: int.min(1),
  }),
  bio_code_prefix: z.string().regex(/^[A-Z]{2,6}$/),
  require_staff_2fa: z.boolean(),
}
