// Fraud rules run on each new view snapshot or account check (03_SYSTEMS.md section 6). Pure
// functions; every number comes from settings. A flag pauses earnings; it never removes money.
export type Thresholds = {
  view_jump_median_multiple: number
  view_jump_median_checks: number
  view_jump_views_per_hour: number
  view_jump_small_account_followers: number
  engagement_floor_bps: number
  engagement_floor_after_views: number
  follower_drop_bps: number
}

export type Snap = { takenAt: Date; views: number | null }

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/**
 * view_jump: the latest growth is more than X times the median growth of the previous N intervals, or
 * more than Y views an hour on an account under Z followers. Snapshots are oldest first, the newest last.
 */
export function viewJump(snaps: Snap[], followers: number | null, t: Thresholds): Record<string, number> | null {
  const seen = snaps.filter((s) => s.views !== null) as { takenAt: Date; views: number }[]
  if (seen.length < 2) return null
  const steps = seen.slice(1).map((s, i) => ({
    gain: Math.max(0, s.views - seen[i]!.views),
    hours: Math.max(1 / 60, (s.takenAt.getTime() - seen[i]!.takenAt.getTime()) / 3_600_000),
  }))
  const last = steps.at(-1)!
  const before = steps.slice(0, -1).slice(-t.view_jump_median_checks)
  if (before.length >= t.view_jump_median_checks) {
    const m = median(before.map((s) => s.gain))
    if (m > 0 && last.gain > t.view_jump_median_multiple * m) return { gain: last.gain, median: m }
  }
  if (followers !== null && followers < t.view_jump_small_account_followers) {
    // Whole views an hour, rounded down: integer maths only.
    const perHour = Math.floor((last.gain * 60) / Math.round(last.hours * 60))
    if (perHour > t.view_jump_views_per_hour) return { gain: last.gain, viewsPerHour: perHour, followers }
  }
  return null
}

/**
 * engagement_below_floor: (likes + comments + shares) / views below the campaign minimum, or below the
 * settings floor when the campaign sets none, once views pass the threshold. Unknown counts are skipped.
 */
export function engagementBelowFloor(
  s: { views: number | null; likes: number | null; comments: number | null; shares: number | null },
  campaignMinBps: number | null,
  t: Thresholds,
): Record<string, number> | null {
  if (s.views === null || s.views < t.engagement_floor_after_views || s.views === 0) return null
  if (s.likes === null || s.comments === null) return null
  const engaged = s.likes + s.comments + (s.shares ?? 0)
  const floor = campaignMinBps ?? t.engagement_floor_bps
  // engaged / views < floor / 10,000, compared without division.
  if (engaged * 10_000 < floor * s.views) return { engaged, views: s.views, floorBps: floor }
  return null
}

/** follower_drop: the account lost more than the setting's share of followers since the last check. */
export function followerDrop(
  before: number | null,
  after: number | null,
  t: Thresholds,
): Record<string, number> | null {
  if (before === null || after === null || before <= 0) return null
  if ((before - after) * 10_000 > t.follower_drop_bps * before) return { before, after }
  return null
}
