import { guessArtist } from '@/reports/draft'
import { staleFlags } from '@/reports/rules'
import type { ReportData } from '@/reports/spec'
import { reportData } from '@/server/reports/data'
import { listReports, listVersions, reportPath, specOf } from '@/server/reports/service'
import { db, tables } from '@mde/db'
import { eq } from 'drizzle-orm'
import { NewReport } from './new-report'
import { Card } from './parts'

// The campaign's client reports (owner brief, 2026-10-26): each with its address, whether it is public,
// and, for a final report, the sentences a refreshed number has made wrong.
const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

export async function CampaignReports({
  campaignId,
  title,
  canEdit,
}: {
  campaignId: string
  title: string
  canEdit: boolean
}) {
  const reports = await listReports(campaignId)
  const live = reports.some((r) => r.kind === 'final' && r.status === 'published') ? await reportData(campaignId) : null
  const rows = await Promise.all(
    reports.map(async (r) => {
      const versions = await listVersions(r.id)
      let stale = 0
      if (live && r.kind === 'final' && r.publishedVersionId) {
        const [v] = await db()
          .select()
          .from(tables.campaignReportVersions)
          .where(eq(tables.campaignReportVersions.id, r.publishedVersionId))
        if (v) stale = staleFlags(specOf(v), v.data as ReportData, live).length
      }
      return { r, versions: versions.length, stale }
    }),
  )
  const nextWeek = Math.max(0, ...reports.filter((r) => r.kind === 'week').map((r) => r.weekNumber ?? 0)) + 1
  return (
    <>
      <Card
        title="Client reports"
        note="Weekly reports are frozen when published. Final reports show today's numbers each time they are opened."
      >
        {rows.length === 0 ? (
          <p className="m-0 text-[14px] text-muted-2">No reports yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {rows.map(({ r, versions, stale }) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-solid border-line bg-field px-4 py-3"
              >
                <div className="min-w-0">
                  <a
                    href={`/admin/campaigns/${campaignId}/reports/${r.id}`}
                    className="text-[14px] font-semibold text-ink no-underline hover:text-gold-soft"
                  >
                    {r.kind === 'week' ? `Week ${r.weekNumber} report` : 'Final report'}
                  </a>
                  <div className="mt-[2px] text-[12px] text-muted">
                    {reportPath(r.slug)} · {versions} {versions === 1 ? 'version' : 'versions'} · edited{' '}
                    {when(r.updatedAt)}
                  </div>
                  {stale ? (
                    <div className="mt-1 text-[12px] font-semibold text-pending">
                      {stale} {stale === 1 ? 'sentence quotes' : 'sentences quote'} a number that has changed since it
                      was published.
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-[12px]">
                  {r.status === 'published' ? (
                    <>
                      <span className="rounded-pill border border-solid border-[#4FB286] px-[10px] py-[2px] font-semibold text-[#4FB286]">
                        Published
                      </span>
                      <a href={reportPath(r.slug)} target="_blank" rel="noopener" className="text-gold-soft">
                        Open
                      </a>
                      <a href={`${reportPath(r.slug)}.pdf`} target="_blank" rel="noopener" className="text-gold-soft">
                        PDF
                      </a>
                    </>
                  ) : (
                    <span className="rounded-pill border border-solid border-[#E0A94A] px-[10px] py-[2px] font-semibold text-[#E0A94A]">
                      Draft
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canEdit ? (
        <Card title="New report">
          <NewReport campaignId={campaignId} artist={guessArtist(title)} nextWeek={nextWeek} />
        </Card>
      ) : null}
    </>
  )
}
