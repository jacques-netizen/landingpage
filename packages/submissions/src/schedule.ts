// When to check a post's views next (03_SYSTEMS.md 3.2). All intervals come from settings.
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Posts in these states are no longer tracked. */
export const UNTRACKED_STATES = ['rejected_auto', 'rejected', 'removed']

export type Intervals = { first_72h_hours: number; until_close_hours: number; keep_live_hours: number }

/**
 * The next check time, or null when tracking has ended: the post was rejected or removed, or the
 * keep-live window after the campaign closed is over.
 */
export function nextCheckAt(
  s: { state: string; submittedAt: Date },
  c: { closedAt: Date | null; keepLiveDays: number },
  intervals: Intervals,
  now: Date,
): Date | null {
  if (UNTRACKED_STATES.includes(s.state)) return null
  const age = now.getTime() - s.submittedAt.getTime()
  let hours: number
  if (age < 72 * HOUR && (!c.closedAt || c.closedAt > now)) hours = intervals.first_72h_hours
  else if (!c.closedAt || c.closedAt > now) hours = intervals.until_close_hours
  else if (now.getTime() < c.closedAt.getTime() + c.keepLiveDays * DAY) hours = intervals.keep_live_hours
  else return null
  return new Date(now.getTime() + hours * HOUR)
}
