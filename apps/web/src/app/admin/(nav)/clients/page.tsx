import { db } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { EmptyState, Table, type Column } from '@mde/ui'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { clientsWithBalances } from '@/server/admin-queries'
import { AdminPage, LinkButton } from '../_components/ui'

type Row = Awaited<ReturnType<typeof clientsWithBalances>>[number]

const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Client', cell: (r) => <a href={`/admin/clients/${r.id}`}>{r.name}</a> },
  { key: 'contact', header: 'Contact', cell: (r) => r.contactEmail ?? '' },
  { key: 'fee', header: 'Service fee', align: 'right', cell: (r) => `${(r.serviceFeeBps / 100).toFixed(2)}%` },
  { key: 'campaigns', header: 'Campaigns', align: 'right', cell: (r) => r.campaigns },
  { key: 'holding', header: 'Paid in, not yet used', align: 'right', cell: (r) => formatDollars(r.holdingCents) },
]

export default async function ClientsPage() {
  const viewer = await requireStaff('staff', '/admin/clients')
  const rows = await clientsWithBalances(db())
  return (
    <AdminPage
      title="Clients"
      lead="Client records, their service fee and the money they have paid in."
      actions={hasAccess(viewer, 'money') ? <LinkButton href="/admin/clients/new">New client</LinkButton> : null}
    >
      <Table
        dense
        caption="Clients"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState body="No clients yet. Add the first client to start a campaign." />}
      />
    </AdminPage>
  )
}
