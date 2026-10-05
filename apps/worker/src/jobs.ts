// Scheduled jobs (03_SYSTEMS.md section 11). Every job must be safe to run twice: a retry or two
// workers picking up the same tick must not change the result.
import { runCampaignLifecycle } from '@mde/campaigns'
import { writeAudit, type Db } from '@mde/db'
import { ledgerCheck } from '@mde/money'
import type { LinkedAccount, ProviderRouter } from '@mde/platforms'
import { expireStrikes } from '@mde/review'
import { runAccountRechecks, runDueViewChecks, runReleases } from '@mde/tracking'

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
  // Releases earnings once a closed campaign's review window has passed, then returns unused budget.
  'release-earnings': { every: 60 * MINUTE, run: ({ db, now }) => runReleases(db, now) },
  // The money property checks on live data. Any failure is logged as an error and kept in the audit
  // log for staff (03_SYSTEMS.md section 11 and the alert in section 13).
  'ledger-check': {
    every: 24 * 60 * MINUTE,
    run: async ({ db }) => {
      const problems = await ledgerCheck(db)
      if (problems.length) {
        console.error(JSON.stringify({ level: 'error', msg: 'ledger check failed', problems }))
        await writeAudit(db, { actorId: null, action: 'ledger_check.failed', entity: 'ledger', after: problems })
      }
      return { errors: problems.length }
    },
  },
  // Warnings stop counting as strikes after strike_days (03_SYSTEMS.md section 8).
  'strike-expiry': { every: 24 * 60 * MINUTE, run: ({ db, now }) => expireStrikes(db, now) },
}
