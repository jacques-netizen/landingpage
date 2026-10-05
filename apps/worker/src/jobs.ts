// Scheduled jobs (03_SYSTEMS.md section 11). Every job must be safe to run twice: a retry or two
// workers picking up the same tick must not change the result.
import { runCampaignLifecycle } from '@mde/campaigns'
import type { Db } from '@mde/db'

export type JobContext = { db: Db; now: Date }

export type ScheduledJob = {
  /** How often the job runs, in milliseconds. */
  every: number
  run: (ctx: JobContext) => Promise<Record<string, unknown>>
}

const MINUTE = 60_000

export const SCHEDULED_JOBS: Record<string, ScheduledJob> = {
  // Closes campaigns whose end date has passed or whose budget is used up.
  'campaign-lifecycle': { every: 5 * MINUTE, run: ({ db, now }) => runCampaignLifecycle(db, now) },
}
