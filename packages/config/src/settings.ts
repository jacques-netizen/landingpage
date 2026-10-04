import { z } from 'zod'

// Settings keys and defaults from 03_SYSTEMS.md section 15 and the open decisions in docs/README.md.
// Money is whole cents, percentages are basis points.
export const settingsSchema = z.object({
  max_linked_accounts: z.number().int().positive(),
  max_post_age_hours: z.number().int().positive(),
  view_check_intervals: z.object({
    first_72h_hours: z.number().int().positive(),
    until_close_hours: z.number().int().positive(),
    keep_live_hours: z.number().int().positive(),
  }),
  deleted_post_grace_hours: z.number().int().positive(),
  review_window_days: z.number().int().nonnegative(),
  withdrawal_min_cents: z.number().int().nonnegative(),
  withdrawal_fee_bps: z.number().int().nonnegative(),
  withdrawal_fee_min_cents: z.number().int().nonnegative(),
  appeal_reply_business_days: z.number().int().positive(),
  strike_days: z.number().int().positive(),
  auto_approve_clean_creators: z.boolean(),
  fraud_thresholds: z.object({
    view_jump_median_multiple: z.number().int().positive(),
    view_jump_median_checks: z.number().int().positive(),
    view_jump_views_per_hour: z.number().int().positive(),
    view_jump_small_account_followers: z.number().int().positive(),
    engagement_floor_bps: z.number().int().nonnegative(),
    engagement_floor_after_views: z.number().int().nonnegative(),
    follower_drop_bps: z.number().int().positive(),
    velocity_new_account_posts_first_hour: z.number().int().positive(),
  }),
  bio_code_prefix: z.string().min(1),
  require_staff_2fa: z.boolean(),
})

export type Settings = z.infer<typeof settingsSchema>
export type SettingKey = keyof Settings

export const SETTINGS_DEFAULTS: Settings = {
  max_linked_accounts: 8,
  max_post_age_hours: 24,
  view_check_intervals: { first_72h_hours: 2, until_close_hours: 12, keep_live_hours: 24 },
  deleted_post_grace_hours: 48,
  review_window_days: 7,
  withdrawal_min_cents: 2000,
  withdrawal_fee_bps: 0,
  withdrawal_fee_min_cents: 0,
  appeal_reply_business_days: 5,
  strike_days: 60,
  auto_approve_clean_creators: false,
  // 03_SYSTEMS.md section 6 names these rules but leaves the numbers to settings. Starting values are in DECISIONS.md.
  fraud_thresholds: {
    view_jump_median_multiple: 10,
    view_jump_median_checks: 5,
    view_jump_views_per_hour: 100000,
    view_jump_small_account_followers: 1000,
    engagement_floor_bps: 20,
    engagement_floor_after_views: 10000,
    follower_drop_bps: 5000,
    velocity_new_account_posts_first_hour: 5,
  },
  bio_code_prefix: 'MDE',
  require_staff_2fa: true,
}
