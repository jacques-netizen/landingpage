import { formatDollars } from '@mde/money/dollars'
import { Button, EmptyState, Input, Table, type Column } from '@mde/ui'
import { listCreators } from '@/server/creators'
import { requireStaff } from '@/server/guard'
import { AdminPage } from '../_components/ui'

export const dynamic = 'force-dynamic'

type Row = Awaited<ReturnType<typeof listCreators>>[number]

const STATUS: Record<string, string> = { active: 'Active', suspended: 'Suspended', closed: 'Closed' }

const COLUMNS: Column<Row>[] = [
  {
    key: 'name',
    header: 'Creator',
    cell: (r) => (
      <>
        <a href={`/admin/creators/${r.id}`}>{r.name ?? r.email}</a>
        {r.name ? <div className="text-[12px] text-muted-2">{r.email}</div> : null}
      </>
    ),
  },
  { key: 'status', header: 'Status', cell: (r) => STATUS[r.status] ?? r.status },
  { key: 'strikes', header: 'Strikes', align: 'right', cell: (r) => r.strikes },
  { key: 'posts', header: 'Posts', align: 'right', cell: (r) => r.posts },
  { key: 'earned', header: 'Earned', align: 'right', cell: (r) => formatDollars(Number(r.earnedCents)) },
]

// Creators, searchable by name or email (01_PRODUCT.md 8.4). Not in the mockups; staff style.
export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff('staff', '/admin/creators')
  const { q } = await searchParams
  const rows = await listCreators(q)
  return (
    <AdminPage title="Creators" lead="Search by name or email. Open a creator to warn, suspend or add notes.">
      <form role="search" action="/admin/creators" className="mb-6 flex max-w-[520px] gap-3">
        <Input name="q" defaultValue={q} aria-label="Search creators" placeholder="Name or email" className="h-10" />
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>
      <Table
        dense
        caption="Creators"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState body={q ? `No creator matches "${q}".` : 'No creators yet.'} />}
      />
    </AdminPage>
  )
}
