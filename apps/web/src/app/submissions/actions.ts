'use server'

import { db } from '@mde/db'
import {
  answerInfo,
  APPEALABLE,
  latestViewProof,
  openAppeal,
  PROOF_CODE_HOURS,
  PROOF_RULES,
  PROVABLE_STATES,
  requestViewProof,
  ReviewError,
  submitViewProof,
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
  /** The newest proof of views the creator sent, if any (owner request, 2026-10-14). */
  proof: ViewProofSummary | null
  /** Whether the creator may ask for a new proof code now. */
  canProveViews: boolean
  proofRules: string[]
}

export type ViewProofSummary = {
  id: string
  status: 'requested' | 'submitted' | 'approved' | 'rejected'
  code: string
  expiresAt: string
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
    expiresAt: new Date(p.createdAt.getTime() + PROOF_CODE_HOURS * 3_600_000).toISOString(),
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
  const proof = await latestViewProof(db(), id)
  const now = Date.now()
  const openProof =
    proof &&
    (proof.status === 'submitted' ||
      (proof.status === 'requested' && now < proof.createdAt.getTime() + PROOF_CODE_HOURS * 3_600_000))
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
    canProveViews:
      PROVABLE_STATES.includes(s.state) &&
      !openProof &&
      !(
        proof?.status === 'approved' &&
        proof.reviewedAt &&
        now < proof.reviewedAt.getTime() + PROOF_CODE_HOURS * 3_600_000
      ),
    proofRules: PROOF_RULES,
  }
}

export type ProofFormState = { error?: string; ok?: boolean }

/** A code for the creator's recording. The same open code comes back while it is live. */
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

/** The creator sends the two files (already uploaded) and the count their analytics show. */
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
