import { tables, type DbOrTx } from '@mde/db'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { CheckResult } from './checks'

const { submissions, campaigns, viewSnapshots, reviewDecisions, appeals } = tables

/** The creator's own submissions, newest first, optionally limited to some states. */
export async function listCreatorSubmissions(d: DbOrTx, creatorId: string, states?: string[]) {
  return d
    .select({
      id: submissions.id,
      campaignId: submissions.campaignId,
      campaignTitle: campaigns.title,
      platform: submissions.platform,
      postUrl: submissions.postUrl,
      state: submissions.state,
      reasonCode: submissions.reasonCode,
      latestViews: submissions.latestViews,
      countedViews: submissions.countedViews,
      earnedCents: submissions.earnedCents,
      submittedAt: submissions.submittedAt,
    })
    .from(submissions)
    .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
    .where(and(eq(submissions.creatorId, creatorId), states?.length ? inArray(submissions.state, states) : undefined))
    .orderBy(desc(submissions.submittedAt))
}

/** One of the creator's submissions with its view history, decisions and appeal. Null if not theirs. */
export async function getCreatorSubmission(d: DbOrTx, creatorId: string, id: string) {
  const [s] = await d
    .select({ s: submissions, campaignTitle: campaigns.title })
    .from(submissions)
    .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
    .where(and(eq(submissions.id, id), eq(submissions.creatorId, creatorId)))
  if (!s) return null
  const [snapshots, decisions, [appeal]] = await Promise.all([
    d
      .select({ takenAt: viewSnapshots.takenAt, views: viewSnapshots.views, isPublic: viewSnapshots.isPublic })
      .from(viewSnapshots)
      .where(eq(viewSnapshots.submissionId, id))
      .orderBy(asc(viewSnapshots.takenAt)),
    // Reviewer names are never shown to creators; only the outcome, reason, note and time.
    d
      .select({
        outcome: reviewDecisions.outcome,
        reasonCode: reviewDecisions.reasonCode,
        note: reviewDecisions.note,
        automatic: reviewDecisions.reviewerId,
        createdAt: reviewDecisions.createdAt,
      })
      .from(reviewDecisions)
      .where(eq(reviewDecisions.submissionId, id))
      .orderBy(asc(reviewDecisions.createdAt)),
    d.select().from(appeals).where(eq(appeals.submissionId, id)),
  ])
  return {
    ...s.s,
    campaignTitle: s.campaignTitle,
    checkResults: (s.s.checkResults ?? []) as CheckResult[],
    snapshots,
    decisions: decisions.map((x) => ({ ...x, automatic: x.automatic === null })),
    appeal: appeal ?? null,
    lastCheckedAt: snapshots.at(-1)?.takenAt ?? null,
  }
}
