import 'server-only'
import { db, tables, writeAudit } from '@mde/db'
import { and, desc, eq } from 'drizzle-orm'
import { draftSpec } from '@/reports/draft'
import { slugify } from '@/reports/format'
import { renderReport } from '@/reports/render'
import { checkWriting, staleFlags, type RuleProblem, type StaleFlag } from '@/reports/rules'
import { ReportSpec, shownClips, type ReportData, type ReportKind } from '@/reports/spec'
import { streamClipMedia } from '../clip-media'
import { redis } from '../rate-limit'
import { saveUpload } from '../storage'
import { claudeConfigured, ReportWriteError, writeWithClaude } from './claude'
import { reportData } from './data'

// Campaign reports for clients (owner brief, 2026-10-26). Every change is a new version, made from the
// version being edited; undo goes back to the version it came from. Publishing makes a version public
// at /reports/<slug>: a weekly report is frozen with the figures of that moment and cannot be edited
// until it is unlocked; a final report keeps its approved words and reads its figures again on each open.

export type ReportRow = typeof tables.campaignReports.$inferSelect
export type VersionRow = typeof tables.campaignReportVersions.$inferSelect
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; problems?: RuleProblem[] }

const LIVE_CACHE_SECONDS = 60

export class ReportError extends Error {}

export async function getReport(id: string) {
  const [r] = await db().select().from(tables.campaignReports).where(eq(tables.campaignReports.id, id))
  return r ?? null
}

async function version(id: string | null) {
  if (!id) return null
  const [v] = await db().select().from(tables.campaignReportVersions).where(eq(tables.campaignReportVersions.id, id))
  return v ?? null
}

export const specOf = (v: VersionRow) => ReportSpec.parse(v.spec)
const kindOf = (r: ReportRow) => r.kind as ReportKind

export const reportPath = (slug: string) => `/reports/${slug}`

/** The campaign's figures now, kept for a minute so a busy final report does not query on every open. */
export async function liveData(campaignId: string): Promise<ReportData | null> {
  const key = `campaign-report-data:v1:${campaignId}`
  try {
    const hit = await redis().get(key)
    if (hit) return JSON.parse(hit) as ReportData
  } catch {
    // No Redis: read it directly.
  }
  const data = await reportData(campaignId)
  if (data)
    redis()
      .set(key, JSON.stringify(data), 'EX', LIVE_CACHE_SECONDS)
      .catch(() => undefined)
  return data
}

export async function listReports(campaignId: string) {
  return db()
    .select()
    .from(tables.campaignReports)
    .where(eq(tables.campaignReports.campaignId, campaignId))
    .orderBy(desc(tables.campaignReports.createdAt))
}

export async function listVersions(reportId: string) {
  return db()
    .select({
      id: tables.campaignReportVersions.id,
      number: tables.campaignReportVersions.number,
      parentId: tables.campaignReportVersions.parentId,
      note: tables.campaignReportVersions.note,
      createdAt: tables.campaignReportVersions.createdAt,
      by: tables.users.username,
    })
    .from(tables.campaignReportVersions)
    .leftJoin(tables.users, eq(tables.users.id, tables.campaignReportVersions.createdBy))
    .where(eq(tables.campaignReportVersions.reportId, reportId))
    .orderBy(desc(tables.campaignReportVersions.number))
}

async function addVersion(
  r: ReportRow,
  input: { spec: ReportSpec; data: ReportData; note: string; actorId: string; parentId: string | null },
) {
  return db().transaction(async (tx) => {
    const [last] = await tx
      .select({ n: tables.campaignReportVersions.number })
      .from(tables.campaignReportVersions)
      .where(eq(tables.campaignReportVersions.reportId, r.id))
      .orderBy(desc(tables.campaignReportVersions.number))
      .limit(1)
    const [v] = await tx
      .insert(tables.campaignReportVersions)
      .values({
        reportId: r.id,
        number: (last?.n ?? 0) + 1,
        parentId: input.parentId,
        spec: input.spec,
        data: input.data,
        note: input.note.slice(0, 500),
        createdBy: input.actorId,
      })
      .returning()
    await tx
      .update(tables.campaignReports)
      .set({ currentVersionId: v!.id, updatedAt: new Date() })
      .where(eq(tables.campaignReports.id, r.id))
    return v!
  })
}

/** Copy the shown clips' pictures to our storage; the platforms' picture links expire. Never throws. */
async function keepCovers(r: ReportRow, data: ReportData, spec: ReportSpec, actorId: string) {
  const covers = { ...(r.covers ?? {}) }
  const missing = shownClips(data, spec).filter((c) => !covers[c.id])
  if (!missing.length) return covers
  const [c] = await db()
    .select({ demo: tables.campaigns.demo })
    .from(tables.campaigns)
    .where(eq(tables.campaigns.id, r.campaignId))
  for (const clip of missing) {
    try {
      const [s] = await db()
        .select({
          id: tables.submissions.id,
          platform: tables.submissions.platform,
          postUrl: tables.submissions.postUrl,
          platformPostId: tables.submissions.platformPostId,
          videoUrl: tables.submissions.videoUrl,
          thumbnailUrl: tables.submissions.thumbnailUrl,
        })
        .from(tables.submissions)
        .where(eq(tables.submissions.id, clip.id))
      if (!s) continue
      const res = await streamClipMedia(s, 'image', null, c?.demo ?? false)
      const type = res.headers.get('content-type') ?? ''
      if (res.status !== 200 || !type.startsWith('image/') || !res.body) continue
      const bytes = Buffer.from(await res.arrayBuffer())
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
      const saved = await saveUpload(
        {
          name: `clip-${clip.postId}.${ext}`,
          contentType: type,
          size: bytes.length,
          body: new Response(bytes).body!,
        },
        actorId,
      )
      covers[clip.id] = saved.url
    } catch (err) {
      console.error(JSON.stringify({ level: 'warn', msg: 'report cover copy failed', clip: clip.id, err: String(err) }))
    }
  }
  await db().update(tables.campaignReports).set({ covers }).where(eq(tables.campaignReports.id, r.id))
  return covers
}

/** Words staff typed on this report, so numbers they gave may be used. */
async function typedOn(reportId: string) {
  const rows = await db()
    .select({ note: tables.campaignReportVersions.note })
    .from(tables.campaignReportVersions)
    .where(eq(tables.campaignReportVersions.reportId, reportId))
  return rows
    .map((r) => r.note)
    .filter(
      (n) =>
        !/^(Written by Claude|First draft|Restored version|Showed|Hid|Changed the clips|Sections unchanged)/.test(n),
    )
}

function locked(r: ReportRow) {
  return r.kind === 'week' && r.status === 'published'
}
const LOCKED = 'This weekly report is published and frozen. Unlock it to edit.'

export async function createReport(input: {
  campaignId: string
  kind: ReportKind
  weekNumber: number | null
  artist: string
  preparedFor: string | null
  actorId: string
}): Promise<Result<{ id: string; warning?: string }>> {
  const artist = input.artist.trim()
  if (!artist) return { ok: false, error: 'Give the artist name.' }
  if (input.kind === 'week' && (!input.weekNumber || input.weekNumber < 1 || input.weekNumber > 99))
    return { ok: false, error: 'Give the week number.' }
  const slug = `${slugify(artist)}-${input.kind === 'week' ? `week-${input.weekNumber}` : 'final'}`
  const [taken] = await db()
    .select({ id: tables.campaignReports.id })
    .from(tables.campaignReports)
    .where(eq(tables.campaignReports.slug, slug))
  if (taken) return { ok: false, error: `There is already a report at ${reportPath(slug)}.` }
  const data = await reportData(input.campaignId)
  if (!data) return { ok: false, error: 'That campaign is gone.' }
  const preparedFor = input.preparedFor?.trim() ? `@${input.preparedFor.trim().replace(/^@/, '')}` : null
  let spec = draftSpec(data, input.kind, artist, preparedFor)
  let note = 'First draft from the data'
  let warning: string | undefined
  if (claudeConfigured()) {
    try {
      const w = await writeWithClaude({
        data,
        kind: input.kind,
        weekNumber: input.weekNumber,
        spec,
        instruction: null,
        typed: [],
      })
      spec = w.spec
      note = `Written by Claude: ${w.note}`
    } catch (err) {
      warning = `${err instanceof Error ? err.message : 'Claude failed.'} The report starts from a plain draft; type an instruction to have Claude rewrite it.`
    }
  } else {
    warning = 'Claude is not set up (ANTHROPIC_API_KEY), so the report starts from a plain draft written from the data.'
  }
  const [r] = await db()
    .insert(tables.campaignReports)
    .values({
      campaignId: input.campaignId,
      kind: input.kind,
      weekNumber: input.kind === 'week' ? input.weekNumber : null,
      slug,
      createdBy: input.actorId,
    })
    .returning()
  await addVersion(r!, { spec, data, note, actorId: input.actorId, parentId: null })
  await keepCovers(r!, data, spec, input.actorId)
  await writeAudit(db(), {
    actorId: input.actorId,
    action: 'campaign_report.create',
    entity: 'campaign_report',
    entityId: r!.id,
    after: { campaignId: input.campaignId, slug, kind: input.kind },
  })
  return { ok: true, id: r!.id, warning }
}

async function editable(reportId: string): Promise<{ r: ReportRow; v: VersionRow; spec: ReportSpec } | string> {
  const r = await getReport(reportId)
  if (!r) return 'That report is gone.'
  if (locked(r)) return LOCKED
  const v = await version(r.currentVersionId)
  if (!v) return 'That report has no version to edit.'
  return { r, v, spec: specOf(v) }
}

/** A typed instruction, carried out by Claude and checked before it is saved. */
export async function instructReport(reportId: string, instruction: string, actorId: string): Promise<Result> {
  const text = instruction.trim()
  if (!text) return { ok: false, error: 'Type what to change.' }
  if (text.length > 2000) return { ok: false, error: 'Keep the instruction under 2,000 characters.' }
  const e = await editable(reportId)
  if (typeof e === 'string') return { ok: false, error: e }
  const data = await reportData(e.r.campaignId)
  if (!data) return { ok: false, error: 'That campaign is gone.' }
  try {
    const w = await writeWithClaude({
      data,
      kind: kindOf(e.r),
      weekNumber: e.r.weekNumber,
      spec: e.spec,
      instruction: text,
      typed: await typedOn(reportId),
    })
    await addVersion(e.r, { spec: w.spec, data, note: text, actorId, parentId: e.v.id })
    await keepCovers(e.r, data, w.spec, actorId)
    return { ok: true }
  } catch (err) {
    if (err instanceof ReportWriteError) return { ok: false, error: err.message, problems: err.problems }
    throw err
  }
}

/** Section switches and clip order, set by hand. */
export async function setLayout(
  reportId: string,
  change: { show?: ReportSpec['show']; order?: string[] },
  actorId: string,
): Promise<Result> {
  const e = await editable(reportId)
  if (typeof e === 'string') return { ok: false, error: e }
  const data = await reportData(e.r.campaignId)
  if (!data) return { ok: false, error: 'That campaign is gone.' }
  const known = new Set(data.clips.map((c) => c.id))
  const spec: ReportSpec = {
    ...e.spec,
    show: change.show ?? e.spec.show,
    clips: change.order
      ? {
          ...e.spec.clips,
          order: [...new Set(change.order.filter((id) => known.has(id)))].slice(0, 6),
          shareCount: Math.min(e.spec.clips.shareCount, Math.max(1, change.order.length)),
        }
      : e.spec.clips,
  }
  const note = change.show
    ? Object.entries(change.show)
        .filter(([k, on]) => e.spec.show[k as keyof ReportSpec['show']] !== on)
        .map(([k, on]) => `${on ? 'Showed' : 'Hid'} ${k}`)
        .join(', ') || 'Sections unchanged'
    : 'Changed the clips shown'
  await addVersion(e.r, { spec, data: specData(e.v, data), note, actorId, parentId: e.v.id })
  if (change.order) await keepCovers(e.r, data, spec, actorId)
  return { ok: true }
}

/** Layout changes keep the figures the words were written against, so stale warnings stay right. */
const specData = (v: VersionRow, fresh: ReportData): ReportData => ({ ...(v.data as ReportData), clips: fresh.clips })

/** Back to the version this one was made from. */
export async function undoReport(reportId: string): Promise<Result> {
  const e = await editable(reportId)
  if (typeof e === 'string') return { ok: false, error: e }
  if (!e.v.parentId) return { ok: false, error: 'Nothing to undo.' }
  await db()
    .update(tables.campaignReports)
    .set({ currentVersionId: e.v.parentId, updatedAt: new Date() })
    .where(eq(tables.campaignReports.id, reportId))
  return { ok: true }
}

/** An older version becomes the newest one. */
export async function restoreVersion(reportId: string, versionId: string, actorId: string): Promise<Result> {
  const e = await editable(reportId)
  if (typeof e === 'string') return { ok: false, error: e }
  const old = await version(versionId)
  if (!old || old.reportId !== reportId) return { ok: false, error: 'That version is gone.' }
  await addVersion(e.r, {
    spec: specOf(old),
    data: old.data as ReportData,
    note: `Restored version ${old.number}`,
    actorId,
    parentId: e.v.id,
  })
  return { ok: true }
}

export async function publishReport(reportId: string, actorId: string): Promise<Result> {
  const r = await getReport(reportId)
  if (!r) return { ok: false, error: 'That report is gone.' }
  if (locked(r)) return { ok: false, error: 'This weekly report is already published.' }
  const v = await version(r.currentVersionId)
  if (!v) return { ok: false, error: 'That report has no version to publish.' }
  const data = await reportData(r.campaignId)
  if (!data) return { ok: false, error: 'That campaign is gone.' }
  const spec = specOf(v)
  // The rules hold on what goes out, whatever happened since the text was written.
  const problems = checkWriting(spec, data, await typedOn(reportId))
  if (problems.some((p) => !/not in the campaign's data/.test(p.problem)))
    return { ok: false, error: 'The text breaks the writing rules. Fix it before publishing.', problems }
  await keepCovers(r, data, spec, actorId)
  const now = new Date()
  await db()
    .update(tables.campaignReports)
    .set({
      status: 'published',
      publishedVersionId: v.id,
      publishedAt: now,
      publishedData: r.kind === 'week' ? data : null,
      updatedAt: now,
    })
    .where(eq(tables.campaignReports.id, reportId))
  await writeAudit(db(), {
    actorId,
    action: 'campaign_report.publish',
    entity: 'campaign_report',
    entityId: reportId,
    before: { status: r.status, publishedVersionId: r.publishedVersionId },
    after: { status: 'published', publishedVersionId: v.id, version: v.number, slug: r.slug },
  })
  return { ok: true }
}

/** A published weekly report goes back to draft and off its public address until published again. */
export async function unlockReport(reportId: string, actorId: string): Promise<Result> {
  const r = await getReport(reportId)
  if (!r) return { ok: false, error: 'That report is gone.' }
  if (r.status !== 'published') return { ok: false, error: 'This report is not published.' }
  await db()
    .update(tables.campaignReports)
    .set({ status: 'draft', publishedVersionId: null, publishedData: null, publishedAt: null, updatedAt: new Date() })
    .where(eq(tables.campaignReports.id, reportId))
  await writeAudit(db(), {
    actorId,
    action: 'campaign_report.unpublish',
    entity: 'campaign_report',
    entityId: reportId,
    before: { status: 'published', publishedVersionId: r.publishedVersionId },
    after: { status: 'draft' },
  })
  return { ok: true }
}

export async function deleteReport(reportId: string, actorId: string): Promise<Result> {
  const r = await getReport(reportId)
  if (!r) return { ok: false, error: 'That report is gone.' }
  await db().transaction(async (tx) => {
    await tx.delete(tables.campaignReportVersions).where(eq(tables.campaignReportVersions.reportId, reportId))
    await tx.delete(tables.campaignReports).where(eq(tables.campaignReports.id, reportId))
  })
  await writeAudit(db(), {
    actorId,
    action: 'campaign_report.delete',
    entity: 'campaign_report',
    entityId: reportId,
    before: { slug: r.slug, status: r.status },
  })
  return { ok: true }
}

/** What the editor shows: the version being edited, its figures, and its sentences that went stale. */
export async function editorState(reportId: string) {
  const r = await getReport(reportId)
  if (!r) return null
  const v = await version(r.currentVersionId)
  if (!v) return null
  const spec = specOf(v)
  const live = await reportData(r.campaignId)
  if (!live) return null
  const data = locked(r) && r.publishedData ? (r.publishedData as ReportData) : live
  const stale: StaleFlag[] = locked(r) ? [] : staleFlags(spec, v.data as ReportData, live)
  const published = r.publishedVersionId ? await version(r.publishedVersionId) : null
  const publishedStale =
    published && r.kind === 'final' ? staleFlags(specOf(published), published.data as ReportData, live) : []
  return { r, v, spec, data, live, stale, published, publishedStale, locked: locked(r) }
}

/** The page for the admin preview: the version being edited (or any version) with today's figures. */
export async function previewHtml(reportId: string, versionId: string | null, mode: 'web' | 'print' = 'web') {
  const s = await editorState(reportId)
  if (!s) return null
  const v = versionId ? await version(versionId) : s.v
  if (!v || v.reportId !== reportId) return null
  return renderReport(s.data, specOf(v), {
    kind: kindOf(s.r),
    weekNumber: s.r.weekNumber,
    mode,
    covers: s.r.covers ?? {},
  })
}

/** The public page, or null when there is no published report at that address. */
export async function publicReport(slug: string, mode: 'web' | 'print', baseHref?: string) {
  const [r] = await db()
    .select()
    .from(tables.campaignReports)
    .where(and(eq(tables.campaignReports.slug, slug), eq(tables.campaignReports.status, 'published')))
  if (!r || !r.publishedVersionId) return null
  const v = await version(r.publishedVersionId)
  if (!v) return null
  const data = r.kind === 'week' ? (r.publishedData as ReportData | null) : await liveData(r.campaignId)
  if (!data) return null
  const html = renderReport(data, specOf(v), {
    kind: kindOf(r),
    weekNumber: r.weekNumber,
    mode,
    covers: r.covers ?? {},
    baseHref,
  })
  // Weekly: the frozen version. Final: the version and the minute its figures were read.
  const cacheKey = r.kind === 'week' ? `${r.id}:${v.id}:${r.publishedAt?.getTime()}` : `${r.id}:${v.id}:${data.asOf}`
  return { html, cacheKey, slug: r.slug }
}
