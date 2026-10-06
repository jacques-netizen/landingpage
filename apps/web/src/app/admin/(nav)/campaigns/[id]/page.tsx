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
import { BUCKETS, campaignOverview, type Bucket } from '@/server/campaign-overview'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { AdminPage, LinkButton, Notice } from '../../_components/ui'
import { CampaignBuilder } from '../builder'
import { CampaignActions } from '../campaign-actions'
import { valuesFrom } from '../values'

export default async function CampaignAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; copied?: string; tab?: string; show?: string }>
}) {
  const { id } = await params
  const { saved, copied, tab: tabParam, show } = await searchParams
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
  const figures = (await campaignFigures(d, [id])).get(id)!
  const feeCents = client ? serviceFeeCents(c.budgetCents, client.serviceFeeBps) : 0
  const holding = client ? await clientHolding(d, client.id) : 0
  const canMoney = hasAccess(viewer, 'money')
  const open = ['draft', 'awaiting_funding'].includes(c.status)
  const live = ['live', 'closing'].includes(c.status)
  const missing = missingForPublish(c)
  const locked = live
    ? ['budget', 'capPerPost', 'capPerCreator', 'minViewsToEarn', 'clientId']
    : funded
      ? ['budget']
      : []
  const status = CAMPAIGN_STATUS[c.status]
  const tab = tabParam === 'edit' || (!tabParam && open) ? 'edit' : 'overview'
  const bucket: Bucket = show === 'pending' || show === 'rejected' ? show : 'approved'
  const o = await campaignOverview(id, bucket)
  const usedPercent = c.budgetCents > 0 ? Math.min(100, Math.round((figures.paidCents / c.budgetCents) * 100)) : 0
  const cpm = o.countedViews > 0 ? Math.round((o.earnedCents * 1000) / o.countedViews) : null
  const base = `/admin/campaigns/${c.id}`

  return (
    <AdminPage
      title={c.title}
      lead={`${client?.name ?? 'No client'} · ${c.type}`}
      actions={
        live || c.status === 'closed' ? (
          <>
            <LinkButton href={`/admin/campaigns/${c.id}/monitor`}>Monitor</LinkButton>
            <LinkButton href={`/campaigns/${c.id}`} variant="secondary">
              View creator page
            </LinkButton>
          </>
        ) : null
      }
    >
      {saved ? <Notice kind="ok">Draft saved.</Notice> : null}
      {copied ? <Notice kind="ok">Copied as a new draft. Set the dates and budget for this month.</Notice> : null}

      <section className="py-6">
        {funded || !open ? (
          <p className="mt-0 mb-4 max-w-[640px] text-[15px] text-muted-2">
            {funded
              ? `Funded. ${formatDollars(c.budgetCents)} is in the campaign budget and the ${formatDollars(feeCents)} service fee was taken.`
              : null}
          </p>
        ) : null}
        {canMoney ? (
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
            }}
          />
        ) : null}
      </section>

      <nav
        aria-label="Campaign"
        className="mt-2 mb-8 flex gap-8 border-0 border-b border-solid border-line text-[15px]"
      >
        {(
          [
            ['overview', 'Overview'],
            ['edit', 'Edit campaign'],
          ] as const
        ).map(([key, label]) => (
          <a
            key={key}
            href={`${base}?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            className={`-mb-px border-0 border-b-2 border-solid pb-3 no-underline ${
              tab === key ? 'border-ink font-medium text-ink' : 'border-transparent text-muted-2'
            }`}
          >
            {label}
          </a>
        ))}
      </nav>

      {tab === 'overview' ? (
        <>
          <dl className="m-0 grid grid-cols-4 gap-4 max-lg:grid-cols-2">
            {[
              ['Status', null],
              ['Views on approved posts', o.views.toLocaleString('en-US')],
              ['Counted views', o.countedViews.toLocaleString('en-US')],
              ['Creators earning', o.creators.toLocaleString('en-US')],
              ['Earned by creators', formatDollars(figures.paidCents)],
              ['Left in budget', formatDollars(figures.leftCents)],
              ['Budget', formatDollars(c.budgetCents)],
              ['Cost per 1,000 counted views', cpm === null ? 'None yet' : formatDollars(cpm)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-card border border-solid border-line bg-[#FBF7F0] px-5 py-4">
                <dt className="text-[13px] text-muted-2">{k}</dt>
                <dd className="m-0 mt-2 font-serif text-[26px] leading-none tabular-nums">
                  {v ?? <StatusBadge status={status?.dot ?? 'neutral'}>{status?.label ?? c.status}</StatusBadge>}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4" aria-label={`${usedPercent}% of the budget earned`}>
            <div className="h-2 overflow-hidden rounded-pill bg-line">
              <div className="h-full rounded-pill bg-ink" style={{ width: `${usedPercent}%` }} />
            </div>
            <p className="mt-2 mb-0 text-[13px] text-muted-2">{usedPercent}% of the budget earned by creators.</p>
          </div>

          <section aria-label="Posts" className="mt-10">
            <nav aria-label="Posts by outcome" className="flex gap-3">
              {(Object.keys(BUCKETS) as Bucket[]).map((b) => (
                <a
                  key={b}
                  href={`${base}?tab=overview&show=${b}`}
                  aria-current={bucket === b ? 'true' : undefined}
                  className={`flex items-center gap-3 rounded-pill border border-solid px-5 py-2 text-[14px] no-underline ${
                    bucket === b ? 'border-ink bg-ink text-white hover:text-white' : 'border-line text-ink'
                  }`}
                >
                  {BUCKETS[b].label}
                  <span className="tabular-nums">{o.counts[b]}</span>
                </a>
              ))}
            </nav>
            {o.posts.length === 0 ? (
              <div className="mt-6">
                <EmptyState body={`No ${BUCKETS[bucket].label.toLowerCase()} posts yet.`} />
              </div>
            ) : (
              <table className="mt-6 w-full border-collapse text-[14px]">
                <caption className="sr-only">{BUCKETS[bucket].label} posts</caption>
                <thead>
                  <tr className="text-left text-[13px] text-muted-2">
                    <th scope="col" className="py-2 font-normal">
                      Creator
                    </th>
                    <th scope="col" className="py-2 font-normal">
                      Post
                    </th>
                    <th scope="col" className="py-2 font-normal">
                      State
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      Views
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      Counted
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      Earned
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {o.posts.map((p) => (
                    <tr key={p.id} className="border-0 border-t border-solid border-line">
                      <td className="py-3">
                        <a href={`/admin/creators/${p.creatorId}`}>{p.creator}</a>
                      </td>
                      <td className="py-3">
                        <a href={p.postUrl} target="_blank" rel="noreferrer">
                          {PLATFORM_LABELS[p.platform as keyof typeof PLATFORM_LABELS] ?? p.platform} post
                        </a>
                        <span className="text-muted-2"> · </span>
                        <a href={`/admin/submissions/${p.id}`} className="text-muted-2">
                          Details
                        </a>
                      </td>
                      <td className="py-3">{CREATOR_STATE[p.state]?.label ?? p.state}</td>
                      <td className="py-3 text-right tabular-nums">{p.views.toLocaleString('en-US')}</td>
                      <td className="py-3 text-right tabular-nums">{p.countedViews.toLocaleString('en-US')}</td>
                      <td className="py-3 text-right tabular-nums">{formatDollars(p.earnedCents)}</td>
                      <td className="py-3 text-right whitespace-nowrap text-muted-2">
                        {p.submittedAt.toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : canMoney && !['closed', 'cancelled'].includes(c.status) ? (
        <CampaignBuilder id={c.id} initial={valuesFrom(c)} clients={clients} locked={locked} />
      ) : (
        <p className="text-[15px] text-muted-2">
          {['closed', 'cancelled'].includes(c.status)
            ? 'This campaign has ended and can no longer be edited.'
            : 'Only finance and admin staff can edit campaigns.'}
        </p>
      )}
    </AdminPage>
  )
}
