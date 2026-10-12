import { Queue, Worker, type ConnectionOptions } from 'bullmq'
import IORedis, { type RedisOptions } from 'ioredis'
import type { Db } from '@mde/db'
import type { LinkedAccount, ProviderRouter } from '@mde/platforms'
import { SCHEDULED_JOBS, type ScheduledJob } from './jobs'

export const QUEUE_NAME = 'mde-scheduled'

type Options = {
  connection: ConnectionOptions
  db: Db
  router: ProviderRouter
  tokenFor?: (account: LinkedAccount) => Promise<string | null>
  jobs?: Record<string, ScheduledJob>
  /** Redis key prefix, so tests can run beside a real worker. */
  prefix?: string
  log?: (entry: Record<string, unknown>) => void
}

const defaultLog = (entry: Record<string, unknown>) => console.log(JSON.stringify(entry))

// One queue for scheduled jobs. Each job has a scheduler that adds it on its interval; failed runs
// retry with backoff, and runs that fail every attempt stay in the failed set as the dead letter
// list for staff to inspect (03_SYSTEMS.md section 11).
export async function startWorker({
  connection,
  db,
  router,
  tokenFor,
  jobs = SCHEDULED_JOBS,
  prefix,
  log = defaultLog,
}: Options) {
  const queue = new Queue(QUEUE_NAME, { connection, prefix })
  // The heartbeat's own connection: the queue's is bullmq's to manage.
  const heartbeat = new IORedis({ ...(connection as RedisOptions), maxRetriesPerRequest: 1, lazyConnect: true })
  heartbeat.on('error', (e) => log({ level: 'warn', msg: 'worker heartbeat connection', err: String(e) }))
  for (const [name, job] of Object.entries(jobs)) {
    await queue.upsertJobScheduler(
      name,
      { every: job.every },
      {
        name,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 1000,
        },
      },
    )
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (j) => {
      const job = jobs[j.name]
      if (!job) throw new Error(`Unknown job ${j.name}`)
      const started = Date.now()
      const result = await job.run({ db, now: new Date(), router, tokenFor })
      log({ level: 'info', msg: 'job done', job: j.name, ms: Date.now() - started, ...result })
      // A heartbeat the web app's health check and staff dashboard read (owner request, 2026-10-12).
      try {
        const at = new Date().toISOString()
        await heartbeat.set(`${prefix ?? 'mde'}:worker:last_seen`, at)
        await heartbeat.set(`${prefix ?? 'mde'}:worker:job:${j.name}`, JSON.stringify({ at, ...result }))
      } catch (e) {
        log({ level: 'warn', msg: 'worker heartbeat failed', err: String(e) })
      }
      return result
    },
    // One scheduled job at a time per worker keeps database load predictable.
    { connection, prefix, concurrency: 1 },
  )
  worker.on('failed', (j, err) =>
    log({ level: 'error', msg: 'job failed', job: j?.name, attempt: j?.attemptsMade, err: String(err) }),
  )

  return {
    queue,
    worker,
    async close() {
      await worker.close()
      await queue.close()
      heartbeat.disconnect()
    },
  }
}
