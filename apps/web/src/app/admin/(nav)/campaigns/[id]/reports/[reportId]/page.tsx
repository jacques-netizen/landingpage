import { db, tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { PLATFORM_NAMES, SECTION_KEYS, SECTION_LABELS, shownClips, visibleSections } from '@/reports/spec'
import { requireStaff } from '@/server/guard'
import { claudeConfigured } from '@/server/reports/claude'
import { editorState, listVersions, reportPath } from '@/server/reports/service'
import { Notice } from '../../../../_components/ui'
import { ReportEditor } from './report-editor'

export const dynamic = 'force-dynamic'

// One client report (owner brief, 2026-10-26): the page as the client will see it beside the box where
// staff type what to change, the section switches, the clip order and every version.
export default async function ReportEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reportId: string }>
  searchParams: Promise<{ notice?: string }>
}) {
  const { id, reportId } = await params
  const { notice } = await searchParams
  await requireStaff('money', `/admin/campaigns/${id}/reports/${reportId}`)
  const s = await editorState(reportId)
  if (!s || s.r.campaignId !== id) notFound()
  const [[c], versions] = await Promise.all([
    db().select({ title: tables.campaigns.title }).from(tables.campaigns).where(eq(tables.campaigns.id, id)),
    listVersions(reportId),
  ])
  const kind = s.r.kind as 'week' | 'final'
  const shown = shownClips(s.data, s.spec)
  const visible = visibleSections(s.data, s.spec, kind)
  const title = kind === 'week' ? `Week ${s.r.weekNumber} report` : 'Final report'
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <a
            href={`/admin/campaigns/${id}?tab=reports`}
            className="text-[13px] text-muted-2 no-underline hover:text-ink"
          >
            {c?.title ?? 'Campaign'} · Reports
          </a>
          <h1 className="m-0 mt-1 font-app text-[22px] font-semibold">{title}</h1>
          <p className="m-0 mt-1 text-[13px] text-muted">
            app.maisondelites.com{reportPath(s.r.slug)} ·{' '}
            {s.r.status === 'published'
              ? `Published version ${s.published?.number ?? ''}${kind === 'week' ? ', frozen' : ', live numbers'}`
              : 'Draft, not public'}
          </p>
        </div>
      </div>
      {notice ? <Notice kind="ok">{notice}</Notice> : null}
      {!claudeConfigured() ? (
        <Notice kind="bad">
          Claude is not set up, so typed instructions cannot be carried out. Add ANTHROPIC_API_KEY to the web service in
          Railway.
        </Notice>
      ) : null}
      <ReportEditor
        key={s.v.id}
        campaignId={id}
        reportId={reportId}
        kind={kind}
        status={s.r.status as 'draft' | 'published'}
        locked={s.locked}
        slug={s.r.slug}
        versionId={s.v.id}
        canUndo={!!s.v.parentId}
        unpublished={s.r.status === 'published' && s.r.publishedVersionId !== s.v.id}
        show={s.spec.show}
        sections={SECTION_KEYS.map((k) => ({
          key: k,
          label: SECTION_LABELS[k],
          on: s.spec.show[k],
          empty: s.spec.show[k] && !visible.includes(k),
          why:
            k === 'platforms'
              ? 'Shows only when the campaign has more than one platform.'
              : k === 'plan'
                ? kind === 'final'
                  ? 'Weekly reports only.'
                  : 'Needs plan steps.'
                : k === 'learned'
                  ? 'Needs lessons.'
                  : '',
        }))}
        clips={s.data.clips.map((x) => ({
          id: x.id,
          label: `@${x.handle} · ${PLATFORM_NAMES[x.platform] ?? x.platform} · ${x.views.toLocaleString('en-US')} views`,
          shown: shown.some((y) => y.id === x.id),
        }))}
        order={shown.map((x) => x.id)}
        stale={s.stale}
        publishedStale={s.publishedStale}
        versions={versions.map((v) => ({
          id: v.id,
          number: v.number,
          note: v.note,
          by: v.by,
          at: v.createdAt.toISOString(),
          current: v.id === s.v.id,
          published: v.id === s.r.publishedVersionId,
        }))}
      />
    </div>
  )
}
