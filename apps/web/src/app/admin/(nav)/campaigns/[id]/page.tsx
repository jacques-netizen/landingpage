import { CAMPAIGN_STATUS } from '@mde/campaigns/status'
import { PLATFORM_LABELS } from '@mde/campaigns/templates'
import { campaignFigures, isFunded, missingForPublish } from '@mde/campaigns'
import { db, tables } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { serviceFeeCents } from '@mde/money/quote'
import { CREATOR_STATE } from '@mde/submissions/states'
import { EmptyState, StatusBadge } from '@mde/ui'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { clientHolding } from '@/server/admin-queries'
import { BUCKETS, campaignCreators, campaignOverview, campaignPages, type Bucket } from '@/server/campaign-overview'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { Notice } from '../../_components/ui'
import { Card, Dot, PlatformTag, Rule, RuleGroup, Th } from './parts'
import { PostActions } from './post-actions'
import { CampaignBuilder } from '../builder'
import { CampaignActions } from '../campaign-actions'
import { valuesFrom } from '../values'

export default async function CampaignAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; copied?: string; tab?: string; show?: string; q?: string }>
}) {
  const { id } = await params
  const { saved, copied, tab: tabParam, show, q } = await searchParams
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
  const locked = live ? ['capPerPost', 'capPerCreator', 'minViewsToEarn', 'clientId'] : []
  const status = CAMPAIGN_STATUS[c.status]
  const TABS = ['overview', 'creators', 'pages', 'submissions', 'edit'] as const
  type Tab = (typeof TABS)[number]
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : open ? 'edit' : 'overview'
  const bucket: Bucket = show === 'pending' || show === 'rejected' ? show : 'approved'
  const [o, creators, pages] = await Promise.all([
    campaignOverview(id, bucket, tab === 'submissions' ? q : undefined),
    tab === 'creators' ? campaignCreators(id, q) : Promise.resolve([]),
    tab === 'pages' ? campaignPages(id) : Promise.resolve([]),
  ])
  const reasons =
    tab === 'submissions'
      ? await d
          .select({ code: tables.reasonCodes.code, label: tables.reasonCodes.label })
          .from(tables.reasonCodes)
          .orderBy(asc(tables.reasonCodes.label))
      : []
  const canDelete = hasAccess(viewer, 'admin')
  const now = Date.now()
  // How long ago a post's stats were fetched, e.g. "13m ago".
  const ago = (t: Date | null) => {
    if (!t) return 'Not yet'
    const m = Math.max(0, Math.round((now - t.getTime()) / 60_000))
    return m < 60 ? `${m}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
  }
  const stat = (v: number | null) => (v === null ? '-' : n(v))
  const usedPercent = c.budgetCents > 0 ? Math.min(100, Math.round((figures.paidCents / c.budgetCents) * 100)) : 0
  const cpm = o.countedViews > 0 ? Math.round((o.earnedCents * 1000) / o.countedViews) : null
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

  return (
    <div className="mx-auto max-w-[1040px] px-8 py-6">
      <nav aria-label="Breadcrumb" className="mb-5 text-[13px] text-muted">
        <a href="/admin/campaigns" className="text-muted no-underline hover:text-ink">
          Campaigns
        </a>
        <span className="mx-2">›</span>
        <span className="text-ink">{c.title}</span>
      </nav>

      <section className="flex gap-6 rounded-[16px] border border-solid border-line bg-panel p-4">
        {c.coverImageUrl ? (
          <img src={c.coverImageUrl} alt="" className="h-[214px] w-[168px] flex-none rounded-[12px] object-cover" />
        ) : (
          <div className="flex h-[214px] w-[168px] flex-none items-center justify-center rounded-[12px] bg-field text-[12px] text-muted">
            No picture
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="m-0 font-mono text-[11px] text-muted">
                {c.id} · created {day(c.createdAt)}
              </p>
              <h1 className="m-0 mt-2 flex items-center gap-2 font-app text-[22px] font-bold">
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
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.platforms.map((p) => (
                  <PlatformTag key={p} platform={p} />
                ))}
              </div>
            </div>
            <StatusBadge status={status?.dot ?? 'neutral'}>{status?.label ?? c.status}</StatusBadge>
          </div>
          <div className="mt-auto flex flex-wrap gap-6 pt-4 text-[13px]">
            {[
              ['Budget', formatDollars(c.budgetCents)],
              ['Earned', formatDollars(figures.paidCents)],
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

      {saved ? (
        <div className="mt-4">
          <Notice kind="ok">Draft saved.</Notice>
        </div>
      ) : null}
      {copied ? (
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

      <nav aria-label="Campaign" className="mt-5 grid grid-cols-5 gap-1 rounded-[12px] bg-panel p-1 text-[13px]">
        {(
          [
            ['overview', 'Overview'],
            ['creators', `Creators`],
            ['pages', 'Pages'],
            ['submissions', `Submissions`],
            ['edit', 'Edit'],
          ] as const
        ).map(([key, label]) => (
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
          </a>
        ))}
      </nav>

      <div className="mt-4 flex flex-col gap-4">
        {tab === 'overview' ? (
          <>
            <dl className="m-0 grid grid-cols-4 gap-3 max-lg:grid-cols-2">
              {[
                ['Views on approved posts', n(o.views)],
                ['Counted views', n(o.countedViews)],
                ['Creators earning', n(o.creators)],
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
                <Rule label="Platforms">
                  {c.platforms.map((p) => PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] ?? p).join(', ')}
                </Rule>
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
                    <Rule key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase())}>
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
        ) : tab === 'creators' ? (
          <Card title="Campaign creators" note="Everyone who joined this campaign, newest first.">
            <form className="mb-4 flex gap-2">
              <input type="hidden" name="tab" value="creators" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search creators..."
                aria-label="Search creators"
                className="h-9 w-[240px] rounded-[9px] border border-solid border-line bg-field px-3 text-[13px] text-ink"
              />
            </form>
            {creators.length === 0 ? (
              <EmptyState body={q ? `No creator matches "${q}".` : 'Nobody has joined yet.'} />
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-solid border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-field">
                    <tr>
                      <Th>Creator</Th>
                      <Th>Accounts</Th>
                      <Th>Linked accounts</Th>
                      <Th right>Posts</Th>
                      <Th right>Approved</Th>
                      <Th right>Joined</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {creators.map((m) => {
                      const verified = m.accounts.filter((a) => a.status === 'verified').length
                      const waiting = m.accounts.filter((a) => a.status === 'pending').length
                      return (
                        <tr key={m.id} className="border-0 border-t border-solid border-line">
                          <td className="px-3 py-3">
                            <a href={`/admin/creators/${m.id}`} className="font-semibold text-ink">
                              {m.name}
                            </a>
                            {m.suspended ? <span className="ml-2 text-[11px] text-bad">Suspended</span> : null}
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {verified}/{m.accounts.length}
                            {waiting ? (
                              <span className="ml-2 rounded-pill border border-solid border-[rgba(224,169,74,0.5)] px-2 py-[1px] text-[11px] text-pending">
                                {waiting} pending
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex flex-wrap gap-3">
                              {m.accounts.slice(0, 3).map((a) => (
                                <span key={a.platform + a.handle} className="inline-flex items-center gap-1">
                                  @{a.handle}
                                  <Dot status={a.status} />
                                </span>
                              ))}
                              {m.accounts.length > 3 ? (
                                <span className="text-muted">+{m.accounts.length - 3} more</span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{m.posts}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{m.approved}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-muted">{day(m.joinedAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : tab === 'pages' ? (
          <Card title="Pages" note="The accounts creators in this campaign post from.">
            {pages.length === 0 ? (
              <EmptyState body="No accounts yet." />
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-solid border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-field">
                    <tr>
                      <Th>Account</Th>
                      <Th>Creator</Th>
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
                          {a.followers === null ? '—' : n(a.followers)}
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
        ) : tab === 'submissions' ? (
          <Card title="Submissions" note="Views, likes and comments refresh with each check, every 2 hours.">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <form action={base} className="flex gap-2">
                <input type="hidden" name="tab" value="submissions" />
                <input type="hidden" name="show" value={bucket} />
                <input
                  type="search"
                  name="q"
                  defaultValue={q ?? ''}
                  aria-label="Search posts"
                  placeholder="Search creator, account or link"
                  className="h-9 w-[260px] rounded-[10px] border border-solid border-line bg-field px-3 text-[13px] text-ink"
                />
                <button
                  type="submit"
                  className="h-9 cursor-pointer rounded-[10px] border border-solid border-line bg-field-2 px-4 text-[13px] text-ink"
                >
                  Search
                </button>
              </form>
              <nav aria-label="Posts by outcome" className="flex gap-2">
                {(Object.keys(BUCKETS) as Bucket[]).map((b) => (
                  <a
                    key={b}
                    href={`${base}?tab=submissions&show=${b}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                    aria-current={bucket === b ? 'true' : undefined}
                    className={`flex items-center gap-3 rounded-pill border border-solid px-4 py-[6px] text-[13px] no-underline ${
                      bucket === b
                        ? 'border-gold-soft bg-[rgba(216,197,143,0.12)] text-gold-soft'
                        : 'border-line text-muted-2'
                    }`}
                  >
                    {BUCKETS[b].label}
                    <span className="tabular-nums">{o.counts[b]}</span>
                  </a>
                ))}
              </nav>
            </div>
            {o.posts.length === 0 ? (
              <EmptyState
                body={
                  q
                    ? `No ${BUCKETS[bucket].label.toLowerCase()} posts match "${q}".`
                    : `No ${BUCKETS[bucket].label.toLowerCase()} posts yet.`
                }
              />
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-solid border-line">
                <table className="w-full border-collapse text-[13px]">
                  <caption className="sr-only">{BUCKETS[bucket].label} posts</caption>
                  <thead className="bg-field">
                    <tr>
                      <Th>Actions</Th>
                      <Th>Post</Th>
                      <Th>Submitted by</Th>
                      <Th>Status</Th>
                      <Th>Fetch</Th>
                      <Th right>Views</Th>
                      <Th>Engagement</Th>
                      <Th right>Earned</Th>
                      <Th right>Submitted</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.posts.map((p) => {
                      const engaged = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0)
                      return (
                        <tr key={p.id} className="border-0 border-t border-solid border-line align-top">
                          <td className="px-3 py-3">
                            <PostActions
                              campaignId={c.id}
                              id={p.id}
                              state={p.state}
                              reasons={reasons}
                              canDelete={canDelete}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <a href={p.postUrl} target="_blank" rel="noreferrer" className="text-gold-soft">
                              {p.handle
                                ? `@${p.handle}`
                                : `${PLATFORM_LABELS[p.platform as keyof typeof PLATFORM_LABELS] ?? p.platform} post`}
                            </a>
                            <div className="mt-1 flex items-center gap-2">
                              <PlatformTag platform={p.platform} small />
                              <a href={`/admin/submissions/${p.id}`} className="text-[12px] text-muted-2">
                                Details
                              </a>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <a href={`/admin/creators/${p.creatorId}`} className="text-ink">
                              {p.creator}
                            </a>
                          </td>
                          <td className="px-3 py-3">{CREATOR_STATE[p.state]?.label ?? p.state}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted-2">{ago(p.checkedAt)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{n(p.views)}</td>
                          <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                            {p.likes === null && p.comments === null ? (
                              <span className="text-muted">No check yet</span>
                            ) : (
                              <>
                                <span>{stat(p.likes)} likes</span>
                                <span className="ml-3">{stat(p.comments)} comments</span>
                                <span className="ml-3 text-muted" title="Likes, comments and shares per view">
                                  {p.views > 0 ? `${((engaged / p.views) * 100).toFixed(2)}%` : ''}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatDollars(p.earnedCents)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-muted">
                            {p.submittedAt.toISOString().slice(0, 10)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : canMoney && !['closed', 'cancelled'].includes(c.status) ? (
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
      </div>
    </div>
  )
}
