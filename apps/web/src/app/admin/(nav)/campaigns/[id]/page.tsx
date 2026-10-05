import { CAMPAIGN_STATUS } from '@mde/campaigns/status'
import { campaignFigures, isFunded, missingForPublish } from '@mde/campaigns'
import { db, tables } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { serviceFeeCents } from '@mde/money/quote'
import { StatusBadge } from '@mde/ui'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { clientHolding } from '@/server/admin-queries'
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
  searchParams: Promise<{ saved?: string; copied?: string }>
}) {
  const { id } = await params
  const { saved, copied } = await searchParams
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

      <dl className="m-0 grid grid-cols-4 gap-8 border-0 border-y border-solid border-line py-6">
        <div>
          <dt className="text-[13px] text-muted-2">Status</dt>
          <dd className="m-0 mt-2">
            <StatusBadge status={status?.dot ?? 'neutral'}>{status?.label ?? c.status}</StatusBadge>
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-2">Budget</dt>
          <dd className="m-0 mt-1 font-serif text-[28px] tabular-nums">{formatDollars(c.budgetCents)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-2">Earned by creators</dt>
          <dd className="m-0 mt-1 font-serif text-[28px] tabular-nums">{formatDollars(figures.paidCents)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-2">Left in budget</dt>
          <dd className="m-0 mt-1 font-serif text-[28px] tabular-nums">{formatDollars(figures.leftCents)}</dd>
        </div>
      </dl>

      <section className="py-6">
        <h2 className="m-0 font-serif text-[24px] font-normal">Funding</h2>
        <p className="mt-2 mb-4 max-w-[640px] text-[15px] text-muted-2">
          {funded
            ? `Funded. ${formatDollars(c.budgetCents)} is in the campaign budget and the ${formatDollars(feeCents)} service fee was taken.`
            : `Needs ${formatDollars(c.budgetCents + feeCents)}: the ${formatDollars(c.budgetCents)} budget plus a ${formatDollars(feeCents)} service fee. ${client?.name ?? 'The client'} has ${formatDollars(holding)} paid in and not yet used.`}{' '}
          {!funded && client ? <a href={`/admin/clients/${client.id}`}>Record funding</a> : null}
        </p>
        {open && missing.length ? (
          <p className="mt-0 mb-4 text-[13px] text-muted-2">Before publishing, add the {missing.join(', ')}.</p>
        ) : null}
        {canMoney ? (
          <CampaignActions
            id={c.id}
            fundLabel={`Fund ${formatDollars(c.budgetCents + feeCents)} from client balance`}
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

      {canMoney && !['closed', 'cancelled'].includes(c.status) ? (
        <CampaignBuilder id={c.id} initial={valuesFrom(c)} clients={clients} locked={locked} />
      ) : (
        <p className="border-0 border-t border-solid border-line pt-6 text-[15px] text-muted-2">
          {['closed', 'cancelled'].includes(c.status)
            ? 'This campaign has ended and can no longer be edited.'
            : 'Only finance and admin staff can edit campaigns.'}
        </p>
      )}
    </AdminPage>
  )
}
