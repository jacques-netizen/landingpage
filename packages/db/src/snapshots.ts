import { sql } from 'drizzle-orm'
import type { DbOrTx } from './client'
import { viewSnapshotDays, viewSnapshots } from './schema'

export type SnapshotInput = {
  submissionId: string
  takenAt: Date
  views: number | null
  likes?: number | null
  comments?: number | null
  shares?: number | null
  saves?: number | null
  isPublic?: boolean | null
  source?: string | null
  raw?: unknown
}

/**
 * Record a view check's result: the snapshot row every check writes, plus the post's latest figures
 * for that UTC day (client report brief, 2026-10-12). A check that saw no numbers keeps the snapshot
 * only, so a day's figures never go back to nothing.
 */
export async function recordSnapshot(d: DbOrTx, s: SnapshotInput) {
  await d.insert(viewSnapshots).values({
    submissionId: s.submissionId,
    takenAt: s.takenAt,
    views: s.views,
    likes: s.likes ?? null,
    comments: s.comments ?? null,
    shares: s.shares ?? null,
    saves: s.saves ?? null,
    isPublic: s.isPublic ?? null,
    source: s.source ?? null,
    raw: (s.raw ?? null) as never,
  })
  if (s.views === null) return
  const day = s.takenAt.toISOString().slice(0, 10)
  await d
    .insert(viewSnapshotDays)
    .values({
      submissionId: s.submissionId,
      day,
      takenAt: s.takenAt,
      views: s.views,
      likes: s.likes ?? null,
      comments: s.comments ?? null,
      shares: s.shares ?? null,
    })
    .onConflictDoUpdate({
      target: [viewSnapshotDays.submissionId, viewSnapshotDays.day],
      set: {
        takenAt: s.takenAt,
        views: s.views,
        likes: s.likes ?? null,
        comments: s.comments ?? null,
        shares: s.shares ?? null,
      },
      // A later check for the same day wins; an out-of-order one never overwrites it.
      setWhere: sql`${viewSnapshotDays.takenAt} <= ${s.takenAt.toISOString()}::timestamptz`,
    })
}
