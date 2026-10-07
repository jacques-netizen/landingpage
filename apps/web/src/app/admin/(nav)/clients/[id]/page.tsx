import { db, tables } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { EmptyState, StatusBadge, Table } from '@mde/ui'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { clientFundingHistory, clientHolding } from '@/server/admin-queries'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { AdminPage } from '../../_components/ui'
import { ClientForm, FundingForm } from '../client-form'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await requireStaff('staff', `/admin/clients/${id}`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const d = db()
  const [client] = await d.select().from(tables.clients).where(eq(tables.clients.id, id))
  if (!client) notFound()
  const canEdit = hasAccess(viewer, 'money')
  const [holding, history, campaigns] = await Promise.all([
    clientHolding(d, id),
    clientFundingHistory(d, id),
    d.select().from(tables.campaigns).where(eq(tables.campaigns.clientId, id)),
  ])
  return (
    <AdminPage title={client.name} lead={`${formatDollars(holding)} paid in and not yet moved into a campaign.`}>
      <ClientForm
        id={id}
        canEdit={canEdit}
        initial={{
          name: client.name,
          contactName: client.contactName ?? '',
          contactEmail: client.contactEmail ?? '',
          serviceFee: (client.serviceFeeBps / 100).toString(),
          notes: client.notes ?? '',
        }}
      />
      {canEdit ? (
        <section className="mt-12">
          <h2 className="m-0 mb-1 font-app text-[16px] font-semibold">Record funding</h2>
          <p className="mt-0 mb-6 text-[13px] text-muted-2">
            Money the client paid by invoice or bank transfer. Each reference is recorded once.
          </p>
          <FundingForm clientId={id} />
        </section>
      ) : null}
      <section className="mt-12">
        <h2 className="m-0 mb-4 font-app text-[16px] font-semibold">Funding received</h2>
        <Table
          dense
          caption="Funding received"
          rows={history}
          rowKey={(r) => r.id}
          columns={[
            { key: 'at', header: 'Date', cell: (r) => r.at.toLocaleDateString('en-US', { dateStyle: 'medium' }) },
            { key: 'ref', header: 'Reference', cell: (r) => r.reference ?? '' },
            { key: 'amount', header: 'Amount', align: 'right', cell: (r) => formatDollars(r.amountCents) },
          ]}
          empty={<EmptyState body="No funding recorded yet." />}
        />
      </section>
      <section className="mt-12">
        <h2 className="m-0 mb-4 font-app text-[16px] font-semibold">Campaigns</h2>
        <Table
          dense
          caption="Campaigns for this client"
          rows={campaigns}
          rowKey={(r) => r.id}
          columns={[
            { key: 'title', header: 'Campaign', cell: (r) => <a href={`/admin/campaigns/${r.id}`}>{r.title}</a> },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <StatusBadge status={r.status === 'live' ? 'ok' : 'neutral'}>{r.status.replace('_', ' ')}</StatusBadge>
              ),
            },
            { key: 'budget', header: 'Budget', align: 'right', cell: (r) => formatDollars(r.budgetCents) },
          ]}
          empty={<EmptyState body="No campaigns for this client yet." />}
        />
      </section>
    </AdminPage>
  )
}
