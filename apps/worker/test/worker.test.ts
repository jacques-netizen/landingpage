import type { Db } from '@mde/db'
import IORedis from 'ioredis'
import { afterAll, describe, expect, it } from 'vitest'
import { SCHEDULED_JOBS, type ScheduledJob } from '../src/jobs'
import { startWorker } from '../src/worker'

const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
const connection = { host: redisUrl.hostname, port: Number(redisUrl.port || 6379), maxRetriesPerRequest: null }
const fakeDb = { execute: async () => [] } as unknown as Db
const prefix = `mde-test-${process.pid}-${Date.now()}`

afterAll(async () => {
  const r = new IORedis(connection)
  const keys = await r.keys(`${prefix}:*`)
  if (keys.length) await r.del(keys)
  await r.quit()
})

const waitFor = async (check: () => boolean, ms = 10_000) => {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe('scheduled jobs', () => {
  it('runs the campaign lifecycle every 5 minutes', async () => {
    expect(SCHEDULED_JOBS['campaign-lifecycle']!.every).toBe(5 * 60_000)
    await expect(SCHEDULED_JOBS['campaign-lifecycle']!.run({ db: fakeDb, now: new Date() })).resolves.toEqual({
      closed: 0,
    })
  })

  it('runs each job on its interval and logs the result', async () => {
    let runs = 0
    const logs: Record<string, unknown>[] = []
    const jobs: Record<string, ScheduledJob> = {
      tick: { every: 300, run: async () => ({ n: ++runs }) },
    }
    const w = await startWorker({ connection, db: fakeDb, jobs, prefix: `${prefix}-a`, log: (e) => logs.push(e) })
    try {
      await waitFor(() => runs >= 2)
      expect(logs.some((l) => l.msg === 'job done' && l.job === 'tick')).toBe(true)
      // Restarting registers the same scheduler again instead of adding a second one.
      await w.queue.upsertJobScheduler('tick', { every: 300 }, { name: 'tick' })
      expect(await w.queue.getJobSchedulersCount()).toBe(1)
    } finally {
      await w.close()
    }
  })

  it('logs a failing job and schedules a retry with backoff', async () => {
    let attempts = 0
    const logs: Record<string, unknown>[] = []
    const jobs: Record<string, ScheduledJob> = {
      broken: {
        every: 60_000,
        run: async () => {
          attempts++
          throw new Error('database unavailable')
        },
      },
    }
    const w = await startWorker({ connection, db: fakeDb, jobs, prefix: `${prefix}-b`, log: (e) => logs.push(e) })
    try {
      await waitFor(() => attempts >= 1)
      await waitFor(() => logs.filter((l) => l.msg === 'job failed').length >= 1)
      expect(logs.find((l) => l.msg === 'job failed')).toMatchObject({
        job: 'broken',
        err: 'Error: database unavailable',
      })
      const delayed = await w.queue.getDelayed()
      expect(delayed.some((j) => j.name === 'broken' && j.attemptsMade === 1)).toBe(true)
    } finally {
      await w.close()
    }
  })
})
