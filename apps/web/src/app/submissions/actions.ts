'use server'

import { db } from '@mde/db'
import {
  answerInfo,
  APPEALABLE,
  INSTAGRAM_POST_TEXT,
  latestViewProof,
  openAppeal,
  PROOF_RULES,
  requestViewProof,
  ReviewError,
  submitViewProof,
  VERIFY_INSTRUCTION,
  VERIFY_LIMITS,
  verifyOptions,
  type VerifyWhy,
} from '@mde/review'
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
  appeal: { status: string; reply: string | null; dueAt: string } | null
  canAppeal: boolean
  /** The newest view verification the creator sent, if any (owner brief, 2026-10-15). */
  proof: ViewProofSummary | null
  /** Whether "Verify views" is open now, why, and what stops it otherwise. */
  verify: VerifyState
  proofRules: string[]
  verifyText: { instruction: string; limits: string; instagram: string }
}

export type VerifyState = {
  can: boolean
  why: VerifyWhy | null
  pending: boolean
  blocked: boolean
  /** When the next verification may be sent after an approved one. */
  nextAt: string | null
}

export type ViewProofSummary = {
  id: string
  status: 'requested' | 'submitted' | 'approved' | 'rejected'
  code: string
  claimedViews: number | null
  setViews: number | null
  decisionNote: string | null
  submittedAt: string | null
  reviewedAt: string | null
}

function proofSummary(p: NonNullable<Awaited<ReturnType<typeof latestViewProof>>>): ViewProofSummary {
  return {
    id: p.id,
    status: p.status as ViewProofSummary['status'],
    code: p.code,
    claimedViews: p.claimedViews,
    setViews: p.setViews,
    decisionNote: p.decisionNote,
    submittedAt: p.submittedAt?.toISOString() ?? null,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
  }
}

/** One of the signed-in creator's submissions, for the detail drawer. */
export async function submissionDetailAction(id: string): Promise<SubmissionDetail | null> {
  const viewer = await getViewer()
  if (!viewer) return null
  const s = await getCreatorSubmission(db(), viewer.id, id)
  if (!s) return null
  const messages = await reasonMessages()
  const reasonText = (code: string | null) => (code && code !== 'other' ? (messages[code] ?? null) : null)
  const [proof, opts] = await Promise.all([latestViewProof(db(), id), verifyOptions(db(), viewer.id, [s])])
  const opt = opts.get(id) ?? { why: null, pending: false, blocked: false, nextAt: null }
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
    appeal: s.appeal ? { status: s.appeal.status, reply: s.appeal.reply, dueAt: s.appeal.dueAt.toISOString() } : null,
    canAppeal: !s.appeal && APPEALABLE.includes(s.state),
    proof: proof ? proofSummary(proof) : null,
    verify: {
      can: !!opt.why && !opt.pending && !opt.blocked && !opt.nextAt,
      why: opt.why,
      pending: opt.pending,
      blocked: opt.blocked,
      nextAt: opt.nextAt?.toISOString() ?? null,
    },
    proofRules: PROOF_RULES,
    verifyText: { instruction: VERIFY_INSTRUCTION, limits: VERIFY_LIMITS, instagram: INSTAGRAM_POST_TEXT },
  }
}

export type ProofFormState = { error?: string; ok?: boolean }

/** Open a verification. The same open one comes back while it is unsent. */
export async function requestViewProofAction(
  submissionId: string,
): Promise<ProofFormState & { proof?: ViewProofSummary }> {
  const viewer = await getViewer()
  if (!viewer) return { error: 'Sign in to continue.' }
  try {
    await requestViewProof(db(), { submissionId, creatorId: viewer.id })
    const p = await latestViewProof(db(), submissionId)
    return { ok: true, proof: p ? proofSummary(p) : undefined }
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message }
    throw e
  }
}

/** The creator sends the recording (already uploaded), the count their insights show, and a screenshot if any. */
export async function submitViewProofAction(
  proofId: string,
  _prev: ProofFormState,
  form: FormData,
): Promise<ProofFormState> {
  const viewer = await getViewer()
  if (!viewer) return { error: 'Sign in to continue.' }
  const views = Number(String(form.get('views') ?? '').replace(/[^0-9]/g, ''))
  const fileId = (k: string) => {
    const v = String(form.get(k) ?? '')
    return /^[0-9a-f-]{36}$/i.test(v) ? v : null
  }
  try {
    await submitViewProof(db(), {
      proofId,
      creatorId: viewer.id,
      claimedViews: views,
      screenshotFileId: fileId('screenshotFileId'),
      recordingFileId: fileId('recordingFileId'),
      note: String(form.get('note') ?? ''),
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message }
    throw e
  }
}

export type AppealFormState = { error?: string; ok?: boolean }

/** Appeal a rejected or removed post: one per submission, message up to 1,000 characters (01 8.5). */
export async function appealAction(id: string, _prev: AppealFormState, form: FormData): Promise<AppealFormState> {
  const viewer = await getViewer()
  if (!viewer) return { error: 'Sign in again to appeal.' }
  const links = String(form.get('links') ?? '')
    .split(/\s+/)
    .filter(Boolean)
  try {
    await openAppeal(db(), viewer.id, id, { message: String(form.get('message') ?? ''), links })
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message }
    throw e
  }
  return { ok: true }
}

/** Answer a reviewer's question; the post goes back to the review queue (03_SYSTEMS.md section 9). */
export async function answerInfoAction(id: string, _prev: AppealFormState, form: FormData): Promise<AppealFormState> {
  const viewer = await getViewer()
  if (!viewer) return { error: 'Sign in again to answer.' }
  try {
    await answerInfo(db(), viewer.id, id, String(form.get('answer') ?? ''))
  } catch (e) {
    if (e instanceof ReviewError) return { error: e.message }
    throw e
  }
  return { ok: true }
}
