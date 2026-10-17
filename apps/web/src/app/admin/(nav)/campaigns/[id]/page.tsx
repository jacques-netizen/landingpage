import { CAMPAIGN_STATUS } from '@mde/campaigns/status'
import { PLATFORM_LABELS } from '@mde/campaigns/templates'
import { campaignFigures, isFunded, missingForPublish } from '@mde/campaigns'
import { db, tables } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { serviceFeeCents } from '@mde/money/quote'
import { listViewProofs } from '@mde/review'
import { CREATOR_STATE } from '@mde/submissions/states'
import { EmptyState, StatusBadge } from '@mde/ui'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { clientHolding } from '@/server/admin-queries'
import { campaignReport } from '@mde/campaigns'
import { BUCKETS, campaignOverview, campaignPages, type Bucket } from '@/server/campaign-overview'
import {
  campaignClippers,
  campaignClips,
  campaignHeadline,
  campaignPayouts,
  campaignReviewQueue,
  type ClipFilters,
  type PayoutStatus,
} from '@/server/campaign-workspace'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { Notice } from '../../_components/ui'
import { ClipsGrid } from './clips-grid'
import { CopyReportLink } from './copy-report-link'
import { Card, Dot, PlatformTag, Rule, RuleGroup, Th } from './parts'
import { RefreshButton } from './refresh-button'
import { ReportLink } from './report-link'
import { CampaignReview } from './review-cards'
import { CampaignVerifications, type VerificationRow } from './verifications'
import { CampaignBuilder } from '../builder'
import { CampaignActions } from '../campaign-actions'
import { valuesFrom } from '../values'

const TABS = ['review', 'verifications', 'clips', 'clippers', 'payouts', 'pages', 'overview', 'settings'] as const
type Tab = (typeof TABS)[number]
/** Old tab names still land somewhere sensible. */
const OLD_TABS: Record<string, Tab> = { creators: 'clippers', submissions: 'clips', edit: 'settings' }
const PAYOUT_LABEL: Record<PayoutStatus, string> = {
  reserved: 'Reserved',
  held: 'In hold',
  paid: 'Paid',
  returned: 'Returned',
}
const PAYOUT_TONE: Record<PayoutStatus, string> = {
  reserved: '#E0A94A',
  held: '#D8C58F',
  paid: '#4FB286',
  returned: '#9A958C',
}

type Search = {
  saved?: string
  copied?: string
  tab?: string
  show?: string
  q?: string
  status?: string
  platform?: string
  clipper?: string
  needs?: string
  sort?: string
}

// The staff campaign workspace (owner brief, 2026-10-15): everything about a campaign in one place,
// review and verifications included, with the clips playing inline.
export default async function CampaignAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Search>
}) {
  const { id } = await params
  const sp = await searchParams
  const viewer = await requireStaff('staff', `/admin/campaigns/${id}`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const d = db()
  const [c] = await d.select().from(tables.campaigns).where(eq(tables.campaigns.id, id))
  if (!c) notFound()
  const [client] = c.clientId ? await d.select().from(tables.clients).where(eq(tables.clients.id, c.clientId)) : []
  const clients = await d
    .select({ id: tables.clients.id, name: tables.clients.name })
    .from(tables.clients)
    .orderBy(asc(tables.clients.name))
  const funded = await isFunded(d, id)
  const [anyPost] = await d
    .select({ id: tables.submissions.id })
    .from(tables.submissions)
    .where(eq(tables.submissions.campaignId, id))
    .limit(1)
  const hasPosts = !!anyPost
  const figures = (await campaignFigures(d, [id])).get(id)!
  const feeCents = client ? serviceFeeCents(c.budgetCents, client.serviceFeeBps) : 0
  const holding = client ? await clientHolding(d, client.id) : 0
  const canMoney = hasAccess(viewer, 'money')
  const open = ['draft', 'awaiting_funding'].includes(c.status)
  const live = ['live', 'closing'].includes(c.status)
  const missing = missingForPublish(c)
  // The budget can always change; its difference moves through the ledger (see changeBudget).
  const locked = live ? ['minViewsToEarn', 'clientId'] : []
  const status = CAMPAIGN_STATUS[c.status]
  const head = await campaignHeadline(id)
  const asked = (sp.tab && OLD_TABS[sp.tab]) ?? sp.tab
  const tab: Tab = TABS.includes(asked as Tab)
    ? (asked as Tab)
    : open
      ? 'settings'
      : head.waiting > 0
        ? 'review'
        : 'overview'
  const clipFilters: ClipFilters = {
    status: ['approved', 'pending', 'rejected'].includes(sp.status ?? sp.show ?? '')
      ? ((sp.status ?? sp.show) as Bucket)
      : 'all',
    platform: ['tiktok', 'instagram', 'youtube', 'x'].includes(sp.platform ?? '') ? sp.platform : undefined,
    clipper: sp.clipper && /^[0-9a-f-]{36}$/i.test(sp.clipper) ? sp.clipper : undefined,
    needs: sp.needs === 'verification' ? 'verification' : undefined,
    sort: sp.sort === 'newest' || sp.sort === 'least' ? sp.sort : 'most',
    q: sp.q,
  }
  const [o, review, proofs, decidedProofs, clips, clippers, pages, payouts] = await Promise.all([
    tab === 'overview' ? campaignOverview(id, 'approved') : Promise.resolve(null),
    tab === 'review' ? campaignReviewQueue(id) : Promise.resolve([]),
    tab === 'verifications' ? listViewProofs(d, 'submitted', { campaignId: id }) : Promise.resolve([]),
    tab === 'verifications' ? listViewProofs(d, 'decided', { campaignId: id }) : Promise.resolve([]),
    tab === 'clips' ? campaignClips(id, clipFilters) : Promise.resolve([]),
    tab === 'clips' || tab === 'clippers' ? campaignClippers(id) : Promise.resolve([]),
    tab === 'pages' ? campaignPages(id) : Promise.resolve([]),
    tab === 'payouts' ? campaignPayouts(id) : Promise.resolve(null),
  ])
  // Platforms with their eCPM: staff only, moved off the client report (owner request, 2026-10-12).
  const byPlatform =
    tab === 'overview' ? ((await campaignReport(d, id, { mode: 'all', page: 1 }))?.platforms ?? []) : []
  const usedPercent = c.budgetCents > 0 ? Math.min(100, Math.round((figures.paidCents / c.budgetCents) * 100)) : 0
  const cpm = o && o.countedViews > 0 ? Math.round((o.earnedCents * 1000) / o.countedViews) : null
  const base = `/admin/campaigns/${c.id}`

  const n = (v: number) => v.toLocaleString('en-US')
  const day = (d: Date | null) =>
    d
      ? d.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null
  const tf = c.templateFields as Record<string, string | number | boolean>
  const platformLabel = (p: string) => PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] ?? p
  const fieldLabel = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase())
  /** The rules a reviewer checks against, shown once above the review cards. */
  const ruleLines: [string, string][] = [
    ['Platforms', c.platforms.map(platformLabel).join(', ')],
    ['Required hashtags', c.requiredHashtags?.length ? c.requiredHashtags.join(' ') : 'None'],
    ['Minimum video length', c.minDurationSeconds === null ? 'None' : `${c.minDurationSeconds} seconds`],
    ['Minimum followers', c.minFollowers === null ? 'None' : n(c.minFollowers)],
    ['Minimum account age', c.minAccountAgeDays === null ? 'None' : `${c.minAccountAgeDays} days`],
    ['Posts per account', c.maxPostsPerAccount === null ? 'No limit' : n(c.maxPostsPerAccount)],
    ['Pay per 1,000 views', formatDollars(c.rateCentsPer1000)],
    ['Max payout per post', c.capPerPostCents === null ? 'No cap' : formatDollars(c.capPerPostCents)],
    ...Object.entries(tf)
      .filter(([, v]) => v !== '' && v !== false)
      .map(([k, v]): [string, string] => [fieldLabel(k), v === true ? 'Yes' : String(v)]),
  ]
  const verificationRows = (xs: typeof proofs): VerificationRow[] =>
    xs.map((p) => ({
      id: p.id,
      status: p.status,
      claimedViews: p.claimedViews,
      setViews: p.setViews,
      scrapedViews: p.scrapedViews,
      flag: p.flag,
      note: p.note,
      decisionNote: p.decisionNote,
      submittedAt: p.submittedAt?.toISOString() ?? null,
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
      screenshotUrl: p.screenshotUrl,
      recordingUrl: p.recordingUrl,
      clip: {
        id: p.submission.id,
        platform: p.submission.platform,
        platformPostId: p.submission.platformPostId,
        postUrl: p.submission.postUrl,
        handle: p.creator.handle ? `@${p.creator.handle}` : (p.creator.username ?? p.creator.email),
        hasVideo: !!p.submission.videoUrl,
        hasThumbnail: !!p.submission.thumbnailUrl,
      },
      submission: {
        state: p.submission.state,
        latestViews: p.submission.latestViews,
        countedViews: p.submission.countedViews,
        earnedCents: p.submission.earnedCents,
        postedAt: p.submission.publishedAt?.toISOString() ?? null,
      },
      creator: { id: p.creator.id, name: p.creator.username ?? p.creator.name ?? p.creator.email },
    }))
  const clipHref = (patch: Partial<Record<keyof Search, string | undefined>>) => {
    const q = new URLSearchParams({ tab: 'clips' })
    const next = {
      status: clipFilters.status,
      platform: clipFilters.platform,
      clipper: clipFilters.clipper,
      needs: clipFilters.needs,
      sort: clipFilters.sort,
      q: clipFilters.q,
      ...patch,
    }
    for (const [k, v] of Object.entries(next)) if (v && v !== 'all' && !(k === 'sort' && v === 'most')) q.set(k, v)
    return `${base}?${q}`
  }
  const pill = (on: boolean, href: string, label: string, key?: string) => (
    <a
      key={key ?? label}
      href={href}
      aria-current={on ? 'true' : undefined}
      className={`rounded-pill border border-solid px-3 py-[5px] text-[12px] no-underline ${
        on ? 'border-gold-soft bg-[rgba(216,197,143,0.12)] text-gold-soft' : 'border-line text-muted-2'
      }`}
    >
      {label}
    </a>
  )
  const count = (v: number) =>
    v ? (
      <span className="ml-[6px] rounded-[6px] bg-[rgba(224,169,74,0.22)] px-[6px] text-[11px] text-pending">{v}</span>
    ) : null

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-6">
      <nav aria-label="Breadcrumb" className="mb-5 text-[13px] text-muted">
        <a href="/admin" className="text-muted no-underline hover:text-ink">
          Campaigns
        </a>
        <span className="mx-2">›</span>
        <span className="text-ink">{c.title}</span>
      </nav>

      <section className="flex gap-6 rounded-[16px] border border-solid border-line bg-panel p-4">
        {c.coverImageUrl ? (
          <img src={c.coverImageUrl} alt="" className="h-[180px] w-[140px] flex-none rounded-[12px] object-cover" />
        ) : (
          <div className="flex h-[180px] w-[140px] flex-none items-center justify-center rounded-[12px] bg-field text-[12px] text-muted">
            No picture
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="m-0 flex items-center gap-2 font-app text-[22px] font-bold">
                {c.title}
                <a
                  href={`/campaigns/${c.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Open the creator page"
                  className="text-gold-soft no-underline"
                >
                  ↗
                </a>
              </h1>
              <p className="mt-1 mb-0 text-[13px] text-muted">
                {client?.name ?? 'No client'} · {c.type}
                {c.startAt ? ` · starts ${day(c.startAt)}` : ''}
                {c.endAt ? ` · ends ${day(c.endAt)}` : ''}
                {c.demo ? ' · demo' : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.platforms.map((p) => (
                  <PlatformTag key={p} platform={p} />
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <StatusBadge status={status?.dot ?? 'neutral'}>{status?.label ?? c.status}</StatusBadge>
              {canMoney ? <CopyReportLink campaignId={c.id} /> : null}
            </div>
          </div>
          <div className="mt-auto flex flex-wrap items-end gap-6 pt-4 text-[13px]">
            <div className="min-w-[260px]">
              <div className="flex justify-between gap-2 text-muted">
                <span>Budget</span>
                <span className="tabular-nums">
                  <span className="text-ink">{formatDollars(figures.paidCents)}</span> of {formatDollars(c.budgetCents)}{' '}
                  · {usedPercent}%
                </span>
              </div>
              <span className="mt-1 block h-[5px] rounded-[3px] bg-field-2" aria-hidden>
                <span className="block h-full rounded-[3px] bg-[#4FB286]" style={{ width: `${usedPercent}%` }} />
              </span>
            </div>
            {[
              ['Total views', n(head.views)],
              ['Left', formatDollars(figures.leftCents)],
              ['Per 1,000 views', formatDollars(c.rateCentsPer1000)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-muted">{k}</div>
                <div className="mt-1 text-[16px] font-semibold tabular-nums">{v}</div>
              </div>
            ))}
            {live || c.status === 'closed' ? (
              <a href={`${base}/monitor`} className="self-end text-gold-soft">
                Monitor
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {sp.saved ? (
        <div className="mt-4">
          <Notice kind="ok">Draft saved.</Notice>
        </div>
      ) : null}
      {sp.copied ? (
        <div className="mt-4">
          <Notice kind="ok">Copied as a new draft. Set the dates and budget for this month.</Notice>
        </div>
      ) : null}

      {/* Ended campaigns keep the actions box so admins can still delete them. */}
      {canMoney && (open || live || viewer.roles.includes('admin')) ? (
        <section className="mt-4">
          <CampaignActions
            id={c.id}
            fundLabel={`Fund ${formatDollars(c.budgetCents + feeCents)} from client balance`}
            goLive={
              open
                ? {
                    lines: [
                      ['Budget for creators', formatDollars(c.budgetCents)],
                      [`Service fee (${(client?.serviceFeeBps ?? 0) / 100}%)`, formatDollars(feeCents)],
                      ['Client pays in total', formatDollars(c.budgetCents + feeCents)],
                      ...(holding > 0 && !funded
                        ? ([['Already paid in', formatDollars(holding)]] as [string, string][])
                        : []),
                    ],
                    missing: [...missing, ...(client ? [] : ['client'])],
                    owedNow: formatDollars(funded ? 0 : Math.max(0, c.budgetCents + feeCents - holding)),
                  }
                : null
            }
            can={{
              fund: !funded && !['closed', 'cancelled'].includes(c.status),
              publish: open,
              copy: true,
              close: live,
              cancel: open && !funded,
              delete: viewer.roles.includes('admin'),
            }}
            keepsRecords={funded || hasPosts}
          />
        </section>
      ) : null}
      {canMoney ? (
        <ReportLink campaignId={c.id} hasLinks={!!c.reportSecret} doubled={c.clientSpendFactor === 2} />
      ) : null}

      <nav aria-label="Campaign" className="mt-5 grid grid-cols-8 gap-1 rounded-[12px] bg-panel p-1 text-[13px]">
        {(
          [
            ['review', 'Review', head.waiting],
            ['verifications', 'Verifications', head.verifications],
            ['clips', 'Clips', 0],
            ['clippers', 'Clippers', 0],
            ['payouts', 'Payouts', 0],
            ['pages', 'Pages', 0],
            ['overview', 'Overview', 0],
            ['settings', 'Settings', 0],
          ] as const
        ).map(([key, label, waiting]) => (
          <a
            key={key}
            href={`${base}?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            className={`flex h-9 items-center justify-center rounded-[9px] no-underline ${
              tab === key
                ? 'border border-solid border-[rgba(216,197,143,0.35)] bg-[rgba(216,197,143,0.12)] font-medium text-gold-soft'
                : 'text-muted-2 hover:text-ink'
            }`}
          >
            {label}
            {count(waiting)}
          </a>
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-4">
        {tab === 'review' ? (
          <CampaignReview campaignId={c.id} items={review} reasons={head.reasons} rules={ruleLines} />
        ) : tab === 'verifications' ? (
          <CampaignVerifications
            campaignId={c.id}
            items={verificationRows(proofs)}
            decided={verificationRows(decidedProofs)}
          />
        ) : tab === 'clips' ? (
          <Card title="Clips" note="Every post in the campaign. Click a clip to play it here.">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <form action={base} className="flex gap-2">
                <input type="hidden" name="tab" value="clips" />
                {clipFilters.status !== 'all' ? <input type="hidden" name="status" value={clipFilters.status} /> : null}
                <input
                  type="search"
                  name="q"
                  defaultValue={clipFilters.q ?? ''}
                  aria-label="Search clips"
                  placeholder="Search clipper, handle or link"
                  className="h-9 w-[240px] rounded-[10px] border border-solid border-line bg-field px-3 text-[13px] text-ink"
                />
                <select
                  name="clipper"
                  defaultValue={clipFilters.clipper ?? ''}
                  aria-label="Clipper"
                  className="h-9 max-w-[200px] rounded-[10px] border border-solid border-line bg-field px-2 text-[13px] text-ink"
                >
                  <option value="">Every clipper</option>
                  {clippers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="h-9 cursor-pointer rounded-[10px] border border-solid border-line bg-field-2 px-4 text-[13px] text-ink"
                >
                  Filter
                </button>
              </form>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <nav aria-label="Clips by status" className="flex gap-2">
                {pill(clipFilters.status === 'all', clipHref({ status: 'all' }), 'All')}
                {(Object.keys(BUCKETS) as Bucket[]).map((b) =>
                  pill(clipFilters.status === b, clipHref({ status: b }), BUCKETS[b].label, b),
                )}
              </nav>
              <nav aria-label="Clips by platform" className="flex gap-2">
                {pill(!clipFilters.platform, clipHref({ platform: undefined }), 'Every platform')}
                {c.platforms.map((p) =>
                  pill(clipFilters.platform === p, clipHref({ platform: p }), platformLabel(p), p),
                )}
              </nav>
              {c.platforms.includes('instagram')
                ? pill(
                    clipFilters.needs === 'verification',
                    clipHref({ needs: clipFilters.needs ? undefined : 'verification' }),
                    'Instagram posts needing verification',
                  )
                : null}
              <nav aria-label="Sort clips" className="ml-auto flex gap-2">
                {pill(clipFilters.sort === 'newest', clipHref({ sort: 'newest' }), 'Newest')}
                {pill(clipFilters.sort === 'most', clipHref({ sort: 'most' }), 'Most views')}
                {pill(clipFilters.sort === 'least', clipHref({ sort: 'least' }), 'Least views')}
              </nav>
            </div>
            {clips.length === 0 ? (
              <EmptyState body="No clips match these filters." />
            ) : (
              <ClipsGrid
                campaignId={c.id}
                reasons={head.reasons}
                canDelete={hasAccess(viewer, 'admin')}
                clips={clips.map((p) => ({
                  id: p.id,
                  platform: p.platform,
                  platformPostId: p.platformPostId,
                  postUrl: p.postUrl,
                  handle: p.handle,
                  creator: p.creator,
                  creatorId: p.creatorId,
                  hasVideo: p.hasVideo,
                  hasThumbnail: p.hasThumbnail,
                  views: p.views,
                  verified: p.verified,
                  likes: p.likes,
                  comments: p.comments,
                  checkedAt: p.checkedAt?.toISOString() ?? null,
                  earnedCents: p.earnedCents,
                  state: p.state,
                  stateLabel: CREATOR_STATE[p.state]?.label ?? p.state,
                  bucket: p.bucket,
                  needsVerification: p.needsVerification,
                  submittedAt: p.submittedAt.toISOString(),
                }))}
              />
            )}
          </Card>
        ) : tab === 'clippers' ? (
          <Card title="Clippers" note="Everyone who joined this campaign. Click a clipper to see their clips.">
            {clippers.length === 0 ? (
              <EmptyState body="Nobody has joined yet." />
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-solid border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-field">
                    <tr>
                      <Th>Clipper</Th>
                      <Th>Handles</Th>
                      <Th right>Submissions</Th>
                      <Th right>Approved</Th>
                      <Th right>Rejected</Th>
                      <Th right>Total views</Th>
                      <Th right>Earned</Th>
                      <Th right>Verifications waiting</Th>
                      <Th>Flags</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {clippers.map((m) => (
                      <tr key={m.id} className="border-0 border-t border-solid border-line">
                        <td className="px-3 py-3">
                          <a href={clipHref({ clipper: m.id })} className="font-semibold text-ink">
                            {m.name}
                          </a>
                          <a href={`/admin/creators/${m.id}`} className="ml-2 text-[11px] text-muted-2">
                            Profile
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex flex-wrap gap-3">
                            {m.handles.slice(0, 3).map((a) => (
                              <span key={a.platform + a.handle} className="inline-flex items-center gap-1">
                                @{a.handle}
                                <Dot status={a.status} />
                              </span>
                            ))}
                            {m.handles.length > 3 ? (
                              <span className="text-muted">+{m.handles.length - 3} more</span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{m.submissions}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{m.approved}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{m.rejected}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{n(m.views)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatDollars(m.earnedCents)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {m.pendingVerifications ? (
                            <a href={`${base}?tab=verifications`} className="font-semibold text-pending">
                              {m.pendingVerifications}
                            </a>
                          ) : (
                            0
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {m.flags.length ? (
                            <span className="flex flex-wrap gap-1">
                              {m.flags.map((f) => (
                                <span
                                  key={f}
                                  className="rounded-[6px] border border-solid border-[rgba(229,103,92,0.5)] px-2 py-[1px] text-[11px] text-[#F08A80]"
                                >
                                  {f}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-muted">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : tab === 'payouts' && payouts ? (
          <Card
            title="Payouts"
            note="What each clip has earned and where that money stands. Dates come from the ledger."
          >
            <dl className="m-0 mb-4 grid grid-cols-4 gap-3 max-lg:grid-cols-2">
              {[
                ['Paid', formatDollars(payouts.totals.paidCents)],
                ['In hold', formatDollars(payouts.totals.holdCents)],
                ['Returned to budget', formatDollars(payouts.totals.returnedCents)],
                ['Remaining budget', formatDollars(payouts.totals.remainingCents)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[12px] border border-solid border-line bg-field px-4 py-3">
                  <dt className="text-[12px] text-muted">{k}</dt>
                  <dd className="m-0 mt-1 text-[20px] font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {payouts.rows.length === 0 ? (
              <EmptyState body="Nothing has earned yet." />
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-solid border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-field">
                    <tr>
                      <Th>Clipper</Th>
                      <Th>Clip</Th>
                      <Th right>Amount</Th>
                      <Th>Status</Th>
                      <Th right>Date</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.rows.map((p) => (
                      <tr key={p.submissionId} className="border-0 border-t border-solid border-line">
                        <td className="px-3 py-3">
                          <a href={`/admin/creators/${p.creatorId}`} className="text-ink">
                            {p.clipper}
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          <a href={`/admin/submissions/${p.submissionId}`} className="text-ink">
                            {p.handle}
                          </a>{' '}
                          <PlatformTag platform={p.platform} small />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatDollars(p.amountCents)}</td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex items-center gap-[6px] text-[12px] font-semibold"
                            style={{ color: PAYOUT_TONE[p.status] }}
                          >
                            <span
                              aria-hidden
                              className="size-[6px] rounded-full"
                              style={{ background: PAYOUT_TONE[p.status] }}
                            />
                            {PAYOUT_LABEL[p.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-muted">
                          {p.at ? p.at.toISOString().slice(0, 10) : 'Not yet'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : tab === 'pages' ? (
          <Card title="Pages" note="The accounts clippers in this campaign post from.">
            {pages.length === 0 ? (
              <EmptyState body="No accounts yet." />
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-solid border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-field">
                    <tr>
                      <Th>Account</Th>
                      <Th>Clipper</Th>
                      <Th>Status</Th>
                      <Th right>Followers</Th>
                      <Th right>Posts</Th>
                      <Th right>Views</Th>
                      <Th right>Earned</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((a) => (
                      <tr key={a.id} className="border-0 border-t border-solid border-line">
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-2">
                            <PlatformTag platform={a.platform} small />@{a.handle}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <a href={`/admin/creators/${a.creatorId}`} className="text-ink">
                            {a.creator}
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-2">
                            <Dot status={a.status} />
                            {a.status === 'verified'
                              ? 'Verified'
                              : a.status === 'pending'
                                ? 'Pending'
                                : 'Needs attention'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {a.followers === null ? '-' : n(a.followers)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{a.posts}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{n(a.views)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatDollars(a.earnedCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : tab === 'overview' && o ? (
          <>
            <dl className="m-0 grid grid-cols-4 gap-3 max-lg:grid-cols-2">
              {[
                ['Views on approved posts', n(o.views)],
                ['Counted views', n(o.countedViews)],
                ['Clippers earning', n(o.creators)],
                ['Cost per 1,000 counted views', cpm === null ? 'None yet' : formatDollars(cpm)],
                ['Approved posts', n(o.counts.approved)],
                ['Pending posts', n(o.counts.pending)],
                ['Denied posts', n(o.counts.rejected)],
                ['Budget earned', `${usedPercent}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[12px] border border-solid border-line bg-panel px-4 py-3">
                  <dt className="text-[12px] text-muted">{k}</dt>
                  <dd className="m-0 mt-1 text-[20px] font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <Card
              title="CPM by platform"
              note="CPM is the campaign rate per 1,000 views. eCPM is what was spent on a platform divided by its views, times 1,000. Staff only; the client report does not show it."
            >
              <div className="flex items-start justify-between gap-4">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-field">
                    <tr>
                      <Th>Platform</Th>
                      <Th right>Views</Th>
                      <Th right>Posts</Th>
                      <Th right>Spend</Th>
                      <Th right>CPM</Th>
                      <Th right>eCPM</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPlatform.map((p) => (
                      <tr key={p.platform} className="border-0 border-t border-solid border-line">
                        <td className="px-3 py-2">
                          <PlatformTag platform={p.platform} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{n(p.views)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{n(p.clips)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatDollars(p.spentCents)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatDollars(c.rateCentsPer1000)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.ecpmCents === null ? 'No views yet' : formatDollars(p.ecpmCents)}
                        </td>
                      </tr>
                    ))}
                    {byPlatform.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-muted">
                          No approved posts yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                <RefreshButton campaignId={c.id} />
              </div>
            </Card>

            <Card title="Description">
              {c.briefMarkdown ? (
                <p className="m-0 text-[14px] leading-[1.6] whitespace-pre-wrap">{c.briefMarkdown}</p>
              ) : (
                <p className="m-0 text-[14px] text-muted">No brief yet.</p>
              )}
              {c.examplePosts.length ? (
                <p className="mt-3 mb-0 text-[13px]">
                  <span className="font-semibold">Examples: </span>
                  {c.examplePosts.map((u, i) => (
                    <span key={u}>
                      {i ? ' · ' : ''}
                      <a href={u} target="_blank" rel="noreferrer" className="text-gold-soft">
                        Example {i + 1}
                      </a>
                    </span>
                  ))}
                </p>
              ) : null}
            </Card>

            <Card title="Campaign rules">
              <RuleGroup title="Page requirements">
                <Rule label="Minimum followers">{c.minFollowers === null ? 'None' : n(c.minFollowers)}</Rule>
                <Rule label="Minimum account age">
                  {c.minAccountAgeDays === null ? 'None' : `${c.minAccountAgeDays} days`}
                </Rule>
                <Rule label="Posts per account">
                  {c.maxPostsPerAccount === null ? 'No limit' : n(c.maxPostsPerAccount)}
                </Rule>
                <Rule label="Platforms">{c.platforms.map(platformLabel).join(', ')}</Rule>
                {c.languages?.length ? <Rule label="Languages">{c.languages.join(', ')}</Rule> : null}
                {c.allowedRegions?.length ? <Rule label="Regions">{c.allowedRegions.join(', ')}</Rule> : null}
              </RuleGroup>
              <RuleGroup title="Content requirements">
                <Rule label="Required hashtags">
                  {c.requiredHashtags?.length ? c.requiredHashtags.join(' ') : 'None'}
                </Rule>
                <Rule label="Minimum video length">
                  {c.minDurationSeconds === null ? 'None' : `${c.minDurationSeconds} seconds`}
                </Rule>
                {Object.entries(tf)
                  .filter(([, v]) => v !== '' && v !== false)
                  .map(([k, v]) => (
                    <Rule key={k} label={fieldLabel(k)}>
                      {v === true ? 'Yes' : String(v)}
                    </Rule>
                  ))}
              </RuleGroup>
              {c.assets.length ? (
                <RuleGroup title="Resources">
                  {c.assets.map((a) => (
                    <a
                      key={a.url}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="col-span-2 flex flex-col rounded-[10px] border border-solid border-line bg-field px-4 py-3 no-underline"
                    >
                      <span className="text-[13px] font-semibold text-ink">{a.label}</span>
                      <span className="truncate text-[12px] text-gold-soft">{a.url} ↗</span>
                    </a>
                  ))}
                </RuleGroup>
              ) : null}
              <RuleGroup title="Posting requirements">
                <Rule label="Keep posts up after the campaign ends">{`${c.keepLiveDays} days`}</Rule>
                <Rule label="Minimum views before a post earns">{c.minViewsToEarn ? n(c.minViewsToEarn) : 'None'}</Rule>
                <Rule label="Max payout per post">
                  {c.capPerPostCents === null ? 'No cap' : formatDollars(c.capPerPostCents)}
                </Rule>
                <Rule label="Max payout per creator">
                  {c.capPerCreatorCents === null ? 'No cap' : formatDollars(c.capPerCreatorCents)}
                </Rule>
                <Rule label="Pay per 1,000 counted views">{formatDollars(c.rateCentsPer1000)}</Rule>
                <Rule label="Who can join">{c.visibility === 'private' ? 'Access code only' : 'Everyone'}</Rule>
              </RuleGroup>
            </Card>
          </>
        ) : (
          <>
            {canMoney && !['closed', 'cancelled'].includes(c.status) ? (
              <Card title="Edit campaign">
                <CampaignBuilder id={c.id} initial={valuesFrom(c)} clients={clients} locked={locked} funded={funded} />
              </Card>
            ) : (
              <Card title="Edit campaign">
                <p className="m-0 text-[14px] text-muted-2">
                  {['closed', 'cancelled'].includes(c.status)
                    ? 'This campaign has ended and can no longer be edited.'
                    : 'Only finance and admin staff can edit campaigns.'}
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
