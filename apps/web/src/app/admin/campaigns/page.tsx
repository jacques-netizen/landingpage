import { CAMPAIGN_STATUS } from '@mde/campaigns/status'
import { campaignFigures } from '@mde/campaigns'
import { db } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { EmptyState, StatusBadge, Table, type Column } from '@mde/ui'
import { campaignsForStaff } from '@/server/admin-queries'
import { requireStaff } from '@/server/guard'
import { hasAccess } from '@/server/viewer'
import { AdminPage, LinkButton } from '../_components/ui'

type Row = Awaited<ReturnType<typeof campaignsForStaff>>[number] & { usedLabel: string }

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
  { key: 'waiting', header: 'Posts waiting', align: 'right', cell: (r) => r.postsWaiting },
]

export default async function CampaignsAdminPage() {
  const viewer = await requireStaff('staff', '/admin/campaigns')
  const d = db()
  const campaigns = await campaignsForStaff(d)
  const figures = await campaignFigures(
    d,
    campaigns.map((c) => c.id),
  )
  const rows: Row[] = campaigns.map((c) => {
    const f = figures.get(c.id)!
    return { ...c, usedLabel: `${formatDollars(f.paidCents)} of ${formatDollars(f.budgetCents)}` }
  })
  return (
    <AdminPage
      title="Campaigns"
      lead="Every campaign, its status, how much of the budget creators have earned, and posts waiting for review."
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
