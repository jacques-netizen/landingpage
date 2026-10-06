import { CAMPAIGN_STATUS } from '@mde/campaigns/status'
import { campaignFigures } from '@mde/campaigns'
import { db } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { EmptyState, StatusBadge, Table, type Column } from '@mde/ui'
import { campaignsForStaff } from '@/server/admin-queries'
import { campaignPostCounts } from '@/server/campaign-overview'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { AdminPage, LinkButton } from '../_components/ui'

type Row = Awaited<ReturnType<typeof campaignsForStaff>>[number] & {
  usedLabel: string
  posts: { approved: number; pending: number; rejected: number; views: number }
}

const COLUMNS: Column<Row>[] = [
  { key: 'title', header: 'Campaign', cell: (r) => <a href={`/admin/campaigns/${r.id}`}>{r.title}</a> },
  { key: 'client', header: 'Client', cell: (r) => r.clientName ?? '' },
  {
    key: 'status',
    header: 'Status',
    cell: (r) => (
      <StatusBadge status={CAMPAIGN_STATUS[r.status]?.dot ?? 'neutral'}>
        {CAMPAIGN_STATUS[r.status]?.label ?? r.status}
      </StatusBadge>
    ),
  },
  { key: 'used', header: 'Budget used', align: 'right', cell: (r) => r.usedLabel },
  { key: 'views', header: 'Views', align: 'right', cell: (r) => r.posts.views.toLocaleString('en-US') },
  {
    key: 'approved',
    header: 'Approved',
    align: 'right',
    cell: (r) => <a href={`/admin/campaigns/${r.id}?tab=overview&show=approved`}>{r.posts.approved}</a>,
  },
  {
    key: 'pending',
    header: 'Pending',
    align: 'right',
    cell: (r) => <a href={`/admin/campaigns/${r.id}?tab=overview&show=pending`}>{r.posts.pending}</a>,
  },
  {
    key: 'rejected',
    header: 'Rejected',
    align: 'right',
    cell: (r) => <a href={`/admin/campaigns/${r.id}?tab=overview&show=rejected`}>{r.posts.rejected}</a>,
  },
]

export default async function CampaignsAdminPage() {
  const viewer = await requireStaff('staff', '/admin/campaigns')
  const d = db()
  const campaigns = await campaignsForStaff(d)
  const figures = await campaignFigures(
    d,
    campaigns.map((c) => c.id),
  )
  const counts = await campaignPostCounts()
  const rows: Row[] = campaigns.map((c) => {
    const f = figures.get(c.id)!
    return {
      ...c,
      usedLabel: `${formatDollars(f.paidCents)} of ${formatDollars(f.budgetCents)}`,
      posts: counts.get(c.id) ?? { approved: 0, pending: 0, rejected: 0, views: 0 },
    }
  })
  return (
    <AdminPage
      title="Campaigns"
      lead="Every campaign with its budget, views and posts. Open one to see every post."
      actions={hasAccess(viewer, 'money') ? <LinkButton href="/admin/campaigns/new">New campaign</LinkButton> : null}
    >
      <Table
        dense
        caption="Campaigns"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState body="No campaigns yet. Start one from a template." />}
      />
    </AdminPage>
  )
}
