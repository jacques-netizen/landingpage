// Scheduled jobs (03_SYSTEMS.md section 11). Every job must be safe to run twice: a retry or two
// workers picking up the same tick must not change the result.
import { runCampaignLifecycle } from '@mde/campaigns'
import type { Db } from '@mde/db'
import type { LinkedAccount, ProviderRouter } from '@mde/platforms'
import { runAccountRechecks, runDueViewChecks } from '@mde/tracking'

export type JobContext = {
  db: Db
  now: Date
  router: ProviderRouter
  tokenFor?: (account: LinkedAccount) => Promise<string | null>
}

export type ScheduledJob = {
  /** How often the job runs, in milliseconds. */
  every: number
  run: (ctx: JobContext) => Promise<Record<string, unknown>>
}

const MINUTE = 60_000

export const SCHEDULED_JOBS: Record<string, ScheduledJob> = {
  // Closes campaigns whose end date has passed or whose budget is used up.
  'campaign-lifecycle': { every: 5 * MINUTE, run: ({ db, now }) => runCampaignLifecycle(db, now) },
  // Each post carries its own next check time (the interval table); this picks up whatever is due.
  'view-checks': {
    every: MINUTE,
    run: ({ db, now, router, tokenFor }) => runDueViewChecks(db, { router, tokenFor, now }),
  },
  // Each verified account once a day; running hourly spreads the work and catches up after downtime.
  'account-recheck': {
    every: 60 * MINUTE,
    run: ({ db, now, router, tokenFor }) => runAccountRechecks(db, { router, tokenFor, now }),
  },
}
