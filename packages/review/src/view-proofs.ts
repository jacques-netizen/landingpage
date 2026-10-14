// A creator's own proof of a post's views (owner request, 2026-10-14): for picture posts, whose views
// the platforms do not give, and for any post the automatic check cannot read. The creator asks for a
// one-time code, records their analytics screen with the code in the recording, uploads the recording
// and a screenshot, and staff set the views from what the recording shows. Money moves only through
// the engine, from the views staff set. Every decision is audited and the creator is told.
import crypto from 'node:crypto'
import { notify, recordSnapshot, tables, writeAudit, type Db, type DbOrTx } from '@mde/db'
import { accrueEarnings, createPgStore } from '@mde/money'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { ReviewError } from './errors'

const { submissions, campaigns, viewProofs, files, users, linkedAccounts } = tables

/** How long a code stays valid, and the least time between two proofs on one post. */
export const PROOF_CODE_HOURS = 24
/** Posts whose views a proof may set: anything still in the campaign. */
export const PROVABLE_STATES = ['needs_review', 'needs_info', 'flagged', 'approved', 'earning']

/**
 * Only picture posts may update their views with a proof (owner rule, 2026-10-14): photos and carousels,
 * whose views the platforms do not give. Reels, TikTok videos, YouTube videos and video tweets never can;
 * their views come from the hourly check. A post the platform described as a picture qualifies; so does a
 * TikTok photo post by its address when the platform has not answered yet. Anything else does not.
 */
export function canProveViews(s: { state: string; platform: string; postUrl: string; mediaKind: string | null }) {
  if (!PROVABLE_STATES.includes(s.state)) return false
  if (s.mediaKind === 'video' || s.platform === 'youtube') return false
  if (s.mediaKind === 'image') return true
  return s.platform === 'tiktok' && /tiktok\.com\/[^?#]*\/photo\//i.test(s.postUrl)
}
const EARNING = ['approved', 'earning']
// No look-alike characters, like the bio code (03_SYSTEMS.md 2.3).
const ALPHABET = '34679ACDEFGHJKMNPQRTUVWXY'

/** The rules a recording must follow. Shown to creators before they record and to staff while they check. */
export const PROOF_RULES = [
  'One continuous screen recording, 10 to 90 seconds, with no cuts, edits or speed changes.',
  'Start the recording on this page with your code on screen, then switch to the app without stopping.',
  'In the app, show your profile with your handle, open the post itself, then open its analytics with the view count.',
  'Keep the phone status bar with the clock visible the whole time.',
  'The screenshot is the analytics screen from that same recording, showing the same view count.',
  'The code expires after 24 hours. A recording made before you asked for the code is refused.',
  'Views only go up. A proof with fewer views than we already have is refused.',
  'An edited, stitched or re-recorded video, or a count that does not match the recording, is rejected and counts as a strike.',
]

const link = (submissionId: string) => `/submissions?open=${submissionId}`

function newCode() {
  let s = ''
  for (let i = 0; i < 4; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return `MDE-${s}`
}

async function ownPost(d: DbOrTx, submissionId: string, creatorId: string) {
  const [row] = await d
    .select({ s: submissions, status: campaigns.status })
    .from(submissions)
    .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
    .where(and(eq(submissions.id, submissionId), eq(submissions.creatorId, creatorId)))
  if (!row) throw new ReviewError('not_found', 'This post was not found.')
  return row
}

/** The newest proof on a post, whatever its status. */
export async function latestViewProof(d: DbOrTx, submissionId: string) {
  const [p] = await d
    .select()
    .from(viewProofs)
    .where(eq(viewProofs.submissionId, submissionId))
    .orderBy(desc(viewProofs.createdAt))
    .limit(1)
  return p ?? null
}

/**
 * A code for the creator to show in their recording. The same open request comes back while its code
 * is live; a proof waiting for review, or one approved within the last day, blocks a new one.
 */
export async function requestViewProof(db: Db, i: { submissionId: string; creatorId: string; now?: Date }) {
  const now = i.now ?? new Date()
  const { s, status } = await ownPost(db, i.submissionId, i.creatorId)
  if (!PROVABLE_STATES.includes(s.state))
    throw new ReviewError('wrong_state', 'Views can only be updated on a post that is still in the campaign.')
  if (!canProveViews(s))
    throw new ReviewError(
      'wrong_state',
      'Only picture posts can update their views with a proof. Views on videos and reels come from the hourly check.',
    )
  if (!['live', 'closing'].includes(status))
    throw new ReviewError('campaign_closed', 'This campaign is no longer running.')
  const last = await latestViewProof(db, i.submissionId)
  const window = PROOF_CODE_HOURS * 3_600_000
  if (last) {
    if (last.status === 'submitted') throw new ReviewError('waiting', 'Your last proof is still waiting for review.')
    if (last.status === 'requested' && now.getTime() < last.createdAt.getTime() + window)
      return { id: last.id, code: last.code, expiresAt: new Date(last.createdAt.getTime() + window) }
    if (last.status === 'approved' && last.reviewedAt && now.getTime() < last.reviewedAt.getTime() + window)
      throw new ReviewError('too_soon', 'Views can be updated with a proof once a day per post.')
  }
  const [p] = await db
    .insert(viewProofs)
    .values({ submissionId: i.submissionId, creatorId: i.creatorId, code: newCode(), createdAt: now, updatedAt: now })
    .returning()
  return { id: p!.id, code: p!.code, expiresAt: new Date(now.getTime() + window) }
}

async function ownFile(d: DbOrTx, id: string | null, creatorId: string, what: string, kind: 'image' | 'video') {
  if (!id) throw new ReviewError('file_required', `Add the ${what}.`)
  const [f] = await d
    .select({ id: files.id, by: files.uploadedBy, type: files.contentType })
    .from(files)
    .where(eq(files.id, id))
  if (!f || f.by !== creatorId || !f.type.startsWith(`${kind}/`))
    throw new ReviewError('bad_file', `The ${what} could not be used. Upload it again.`)
  return f.id
}

/** The creator sends the recording, the screenshot and the count they show. Staff decide from there. */
export async function submitViewProof(
  db: Db,
  i: {
    proofId: string
    creatorId: string
    claimedViews: number
    screenshotFileId: string | null
    recordingFileId: string | null
    note: string | null
    now?: Date
  },
) {
  const now = i.now ?? new Date()
  const [p] = await db
    .select()
    .from(viewProofs)
    .where(and(eq(viewProofs.id, i.proofId), eq(viewProofs.creatorId, i.creatorId)))
  if (!p) throw new ReviewError('not_found', 'This proof was not found.')
  if (p.status !== 'requested') throw new ReviewError('wrong_state', 'This proof was already sent.')
  if (now.getTime() >= p.createdAt.getTime() + PROOF_CODE_HOURS * 3_600_000)
    throw new ReviewError('expired', 'This code has expired. Ask for a new one and record again with it.')
  const { s } = await ownPost(db, p.submissionId, i.creatorId)
  if (!Number.isInteger(i.claimedViews) || i.claimedViews <= 0)
    throw new ReviewError('views_required', 'Enter the view count shown in your analytics.')
  if (i.claimedViews < s.latestViews)
    throw new ReviewError(
      'views_down',
      `Views only go up. We already have ${s.latestViews.toLocaleString('en-US')} for this post.`,
    )
  const screenshot = await ownFile(db, i.screenshotFileId, i.creatorId, 'screenshot', 'image')
  const recording = await ownFile(db, i.recordingFileId, i.creatorId, 'screen recording', 'video')
  await db
    .update(viewProofs)
    .set({
      status: 'submitted',
      claimedViews: i.claimedViews,
      screenshotFileId: screenshot,
      recordingFileId: recording,
      note: i.note?.trim() || null,
      submittedAt: now,
      updatedAt: now,
    })
    .where(eq(viewProofs.id, p.id))
}

/**
 * Staff approve with the views the recording shows (which may differ from the claim), or reject with a
 * note. Approving records a manual snapshot, moves the post's views, and pays it through the engine.
 */
export async function decideViewProof(
  db: Db,
  reviewerId: string,
  proofId: string,
  d: { outcome: 'approve'; views: number; note: string | null } | { outcome: 'reject'; note: string },
) {
  const now = new Date()
  const note = d.note?.trim() || null
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(viewProofs).where(eq(viewProofs.id, proofId)).for('update')
    if (!p) throw new ReviewError('not_found', 'This proof was not found.')
    if (p.status !== 'submitted') throw new ReviewError('wrong_state', 'This proof was already decided.')
    const [s] = await tx.select().from(submissions).where(eq(submissions.id, p.submissionId)).for('update')
    if (!s) throw new ReviewError('not_found', 'This post was not found.')
    const [c] = await tx.select({ title: campaigns.title }).from(campaigns).where(eq(campaigns.id, s.campaignId))
    if (d.outcome === 'reject') {
      if (!note) throw new ReviewError('note_required', 'Tell the creator why the proof was not accepted.')
      await tx
        .update(viewProofs)
        .set({ status: 'rejected', reviewerId, reviewedAt: now, decisionNote: note, updatedAt: now })
        .where(eq(viewProofs.id, p.id))
      await writeAudit(tx, {
        actorId: reviewerId,
        action: 'submission.view_proof_rejected',
        entity: 'submission',
        entityId: s.id,
        before: { proofId: p.id, claimedViews: p.claimedViews },
        after: { note },
      })
      await notify(tx, s.creatorId, 'view_proof', {
        title: 'Your view proof was not accepted',
        body: `${c?.title ?? 'Your campaign'}: ${note}`,
        link: link(s.id),
      })
      return { accrue: false, submissionId: s.id }
    }
    const views = d.views
    if (!Number.isInteger(views) || views < 0)
      throw new ReviewError('views_required', 'Enter the views the recording shows.')
    if (views < s.latestViews)
      throw new ReviewError(
        'views_down',
        `Views only go up. The post already has ${s.latestViews.toLocaleString('en-US')}.`,
      )
    await recordSnapshot(tx, {
      submissionId: s.id,
      takenAt: now,
      views,
      source: 'manual',
      raw: { proofId: p.id, reviewerId, claimedViews: p.claimedViews },
    })
    const earning = EARNING.includes(s.state)
    await tx
      .update(submissions)
      .set({
        latestViews: views,
        countedViews: earning ? Math.max(0, views - s.baselineViews) : s.countedViews,
        updatedAt: now,
      })
      .where(eq(submissions.id, s.id))
    await tx
      .update(viewProofs)
      .set({ status: 'approved', reviewerId, reviewedAt: now, setViews: views, decisionNote: note, updatedAt: now })
      .where(eq(viewProofs.id, p.id))
    await writeAudit(tx, {
      actorId: reviewerId,
      action: 'submission.views_set_by_proof',
      entity: 'submission',
      entityId: s.id,
      before: { latestViews: s.latestViews, countedViews: s.countedViews, claimedViews: p.claimedViews },
      after: { latestViews: views, proofId: p.id, note },
    })
    await notify(tx, s.creatorId, 'view_proof', {
      title: 'Your view proof was approved',
      body: `${c?.title ?? 'Your campaign'}: views set to ${views.toLocaleString('en-US')}.${note ? ` ${note}` : ''}`,
      link: link(s.id),
    })
    return { accrue: earning, submissionId: s.id }
  })
  if (!result.accrue) return { deltaCents: 0 }
  const r = await accrueEarnings(createPgStore(db), { submissionId: result.submissionId })
  return { deltaCents: r.deltaCents }
}

/** Proofs for staff, newest submitted first, with the post and creator beside each. */
export async function listViewProofs(db: Db, status: 'submitted' | 'decided') {
  const rows = await db
    .select({
      p: viewProofs,
      submission: {
        id: submissions.id,
        platform: submissions.platform,
        postUrl: submissions.postUrl,
        state: submissions.state,
        latestViews: submissions.latestViews,
        baselineViews: submissions.baselineViews,
        countedViews: submissions.countedViews,
        earnedCents: submissions.earnedCents,
        thumbnailUrl: submissions.thumbnailUrl,
      },
      campaign: { id: campaigns.id, title: campaigns.title },
      creator: { id: users.id, email: users.email, username: users.username, name: users.name },
      handle: linkedAccounts.handle,
    })
    .from(viewProofs)
    .innerJoin(submissions, eq(submissions.id, viewProofs.submissionId))
    .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
    .innerJoin(users, eq(users.id, viewProofs.creatorId))
    .leftJoin(linkedAccounts, eq(linkedAccounts.id, submissions.linkedAccountId))
    .where(
      status === 'submitted'
        ? eq(viewProofs.status, 'submitted')
        : inArray(viewProofs.status, ['approved', 'rejected']),
    )
    .orderBy(status === 'submitted' ? viewProofs.submittedAt : desc(viewProofs.reviewedAt))
    .limit(200)
  const fileIds = rows.flatMap((r) => [r.p.screenshotFileId, r.p.recordingFileId]).filter((x): x is string => !!x)
  const names = fileIds.length
    ? await db.select({ id: files.id, name: files.name }).from(files).where(inArray(files.id, fileIds))
    : []
  const url = (id: string | null) => {
    const f = names.find((n) => n.id === id)
    return f ? `/files/${f.id}/${f.name}` : null
  }
  return rows.map((r) => ({
    id: r.p.id,
    status: r.p.status,
    code: r.p.code,
    claimedViews: r.p.claimedViews,
    setViews: r.p.setViews,
    note: r.p.note,
    decisionNote: r.p.decisionNote,
    requestedAt: r.p.createdAt,
    submittedAt: r.p.submittedAt,
    reviewedAt: r.p.reviewedAt,
    screenshotUrl: url(r.p.screenshotFileId),
    recordingUrl: url(r.p.recordingFileId),
    submission: r.submission,
    campaign: r.campaign,
    creator: { ...r.creator, handle: r.handle },
  }))
}
