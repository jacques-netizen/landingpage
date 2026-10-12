import type { Metadata } from 'next'
import { cachedReport, campaignForReportToken, parseReportQuery } from '@/server/report'
import { ReportView } from './report-view'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }

// The client's campaign report (client report brief, 2026-10-12): public, read-only, no login, found
// only by its signed link. Never indexed.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params
  const campaign = await campaignForReportToken(token)
  const title = campaign ? `${campaign.title} Campaign Report` : 'Campaign Report'
  return {
    title: `${title} | Maison d'Élites`,
    description: "Campaign performance on Maison d'Élites",
    robots: { index: false, follow: false },
    openGraph: { title, description: "Campaign performance on Maison d'Élites", type: 'website' },
  }
}

export default async function ReportPage({ params, searchParams }: Params) {
  const { token } = await params
  const campaign = await campaignForReportToken(token)
  const sp = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => !!e[1]))
  const query = parseReportQuery(sp)
  const report = campaign ? await cachedReport(token, campaign.id, query) : null
  if (!campaign || !report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-6 font-sans text-ink">
        <div className="text-center">
          <img src="/designed/logo-nav-clear.png" alt="Maison d'Élites" className="mx-auto mb-8 h-[26px] w-auto" />
          <h1 className="m-0 font-serif text-[32px] font-normal">This report link is no longer active.</h1>
          <p className="mt-3 mb-0 text-[15px] text-muted">Ask your contact at Maison d'Élites for a new one.</p>
        </div>
      </main>
    )
  }
  return (
    <main className="min-h-screen bg-page font-sans text-ink">
      <ReportView
        token={token}
        initial={report}
        initialFilters={{
          from: sp.get('from') ?? '',
          to: sp.get('to') ?? '',
          mode: query.mode,
          page: query.page,
          platform: query.platform ?? '',
          status: query.status ?? '',
          sort: query.sort ?? 'views',
        }}
      />
    </main>
  )
}
