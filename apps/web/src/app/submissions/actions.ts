'use server'

import { db } from '@mde/db'
import { CREATOR_STATE, DECISION_LABEL, getCreatorSubmission } from '@mde/submissions'
import { reasonMessages } from '@/server/submissions'
import { getViewer } from '@/server/viewer'

export type SubmissionDetail = {
  id: string
  campaignTitle: string
  campaignId: string
  postUrl: string
  state: string
  stateLabel: string
  reason: string | null
  reasonNote: string | null
  creatorNote: string | null
  submittedAt: string
  lastCheckedAt: string | null
  views: { at: string; views: number }[]
  latestViews: number
  countedViews: number
  earnedCents: number
  checks: { check: number; label: string; status: 'pass' | 'fail' | 'review'; message?: string }[]
  history: { at: string; text: string; note: string | null }[]
  appeal: { status: string; reply: string | null } | null
}

/** One of the signed-in creator's submissions, for the detail drawer. */
export async function submissionDetailAction(id: string): Promise<SubmissionDetail | null> {
  const viewer = await getViewer()
  if (!viewer) return null
  const s = await getCreatorSubmission(db(), viewer.id, id)
  if (!s) return null
  const messages = await reasonMessages()
  const reasonText = (code: string | null) => (code && code !== 'other' ? (messages[code] ?? null) : null)
  return {
    id: s.id,
    campaignTitle: s.campaignTitle,
    campaignId: s.campaignId,
    postUrl: s.postUrl,
    state: s.state,
    stateLabel: CREATOR_STATE[s.state]?.label ?? s.state,
    reason: reasonText(s.reasonCode),
    reasonNote: s.reasonNote,
    creatorNote: s.creatorNote,
    submittedAt: s.submittedAt.toISOString(),
    lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
    views: s.snapshots.filter((v) => v.views !== null).map((v) => ({ at: v.takenAt.toISOString(), views: v.views! })),
    latestViews: s.latestViews,
    countedViews: s.countedViews,
    earnedCents: s.earnedCents,
    checks: s.checkResults.map((c) => ({
      check: c.check,
      label: c.label,
      status: c.status,
      message: c.status === 'fail' ? [reasonText(c.reason ?? null), c.detail].filter(Boolean).join(' ') : c.detail,
    })),
    history: [
      { at: s.submittedAt.toISOString(), text: 'Submitted', note: null },
      ...s.decisions.map((d) => ({
        at: d.createdAt.toISOString(),
        text: `${DECISION_LABEL[d.outcome] ?? d.outcome}${d.automatic ? ' by the automatic checks' : ' by a reviewer'}${
          reasonText(d.reasonCode) ? `: ${reasonText(d.reasonCode)}` : ''
        }`,
        note: d.note,
      })),
    ],
    appeal: s.appeal ? { status: s.appeal.status, reply: s.appeal.reply } : null,
  }
}
