import { EmptyState } from '@mde/ui'
import { requireStaff } from '@/server/guard'
import { dueSoon, staffAppeals } from '@/server/appeals'
import { AdminPage } from '../_components/ui'

export const dynamic = 'force-dynamic'

const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

// The appeals inbox, nearest deadline first (01_PRODUCT.md 8.4). Not in the mockups; staff style.
export default async function AppealsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff('staff', '/admin/appeals')
  const { show } = await searchParams
  const tab = show === 'answered' ? 'answered' : 'open'
  const rows = await staffAppeals(tab)
  const now = new Date()
  return (
    <AdminPage title="Appeals" lead="Answer each appeal before its deadline. Nearest deadline first.">
      <nav aria-label="Appeals" className="mb-6 flex gap-6 text-[14px]">
        {(['open', 'answered'] as const).map((t) => (
          <a
            key={t}
            href={`/admin/appeals?show=${t}`}
            aria-current={tab === t ? 'page' : undefined}
            className={tab === t ? 'font-medium text-ink' : 'text-muted-2'}
          >
            {t === 'open' ? 'Open' : 'Answered'}
          </a>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState body={tab === 'open' ? 'No open appeals.' : 'No answered appeals yet.'} />
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">{tab === 'open' ? 'Open appeals by deadline' : 'Answered appeals'}</caption>
          <thead>
            <tr className="text-left text-muted-2">
              <th scope="col" className="py-2 font-normal">
                Creator
              </th>
              <th scope="col" className="py-2 font-normal">
                Campaign
              </th>
              <th scope="col" className="py-2 font-normal">
                {tab === 'open' ? 'Reply by' : 'Outcome'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const late = a.dueAt <= now
              const soon = !late && dueSoon(a.dueAt, now)
              return (
                <tr key={a.id} className="border-0 border-t border-solid border-line">
                  <td className="py-3">
                    <a href={`/admin/appeals/${a.id}`}>{a.name ?? a.email}</a>
                  </td>
                  <td className="py-3">{a.campaignTitle}</td>
                  <td className="py-3">
                    {tab === 'open' ? (
                      <span className={late ? 'font-medium text-bad' : soon ? 'font-medium text-[#B26A00]' : ''}>
                        {when(a.dueAt)}
                        {late ? ' · late' : soon ? ' · within 24 hours' : ''}
                      </span>
                    ) : a.status === 'overturned' ? (
                      'Overturned'
                    ) : (
                      'Upheld'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </AdminPage>
  )
}
