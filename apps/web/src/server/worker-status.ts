import 'server-only'
import { staleCampaigns, trackingStatus } from '@mde/tracking'
import { db } from '@mde/db'
import { redis } from './rate-limit'

// What the worker last did, from its Redis heartbeat, and which live campaigns have gone without a
// view snapshot for over 3 hours (owner request, 2026-10-12). For the health check and the staff dashboard.
export type WorkerStatus = {
  lastSeen: string | null
  /** Minutes since the worker last finished a job; null when it never has. */
  minutesAgo: number | null
  viewChecks: {
    at: string
    due?: number
    revived?: number
    checked?: number
    unavailable?: number
    failed?: number
  } | null
  stale: { id: string; title: string; lastSnapshotAt: string | null; trackedPosts: number }[]
  /** Where tracking stands on each live campaign: tracked posts, posts with no check scheduled, next due, last snapshot. */
  tracking: Awaited<ReturnType<typeof trackingStatus>>
}

export async function workerStatus(): Promise<WorkerStatus> {
  let lastSeen: string | null = null
  let viewChecks: WorkerStatus['viewChecks'] = null
  try {
    const [seen, checks] = await Promise.all([
      redis().get('mde:worker:last_seen'),
      redis().get('mde:worker:job:view-checks'),
    ])
    lastSeen = seen
    viewChecks = checks ? (JSON.parse(checks) as WorkerStatus['viewChecks']) : null
  } catch (err) {
    console.error(JSON.stringify({ level: 'warn', msg: 'worker heartbeat unreadable', err: String(err) }))
  }
  const [stale, tracking] = await Promise.all([
    staleCampaigns(db()).catch(() => []),
    trackingStatus(db()).catch(() => []),
  ])
  return {
    lastSeen,
    minutesAgo: lastSeen ? Math.round((Date.now() - new Date(lastSeen).getTime()) / 60_000) : null,
    viewChecks,
    stale,
    tracking,
  }
}
