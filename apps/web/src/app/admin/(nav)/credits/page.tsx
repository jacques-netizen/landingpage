import { db } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { sql } from 'drizzle-orm'
import { requireStaff } from '@/server/guard'
import { AdminPage } from '../_components/ui'
import { CreditForm } from './form'

export const dynamic = 'force-dynamic'

// Credit any user's balance (owner request, 2026-10-08). Admin only; every credit is in the ledger
// and the audit log with who made it and why.
export default async function CreditsPage() {
  await requireStaff('admin', '/admin/credits')
  const recent = await db().execute<{
    at: Date
    cents: string
    memo: string | null
    who: string
    by: string | null
  }>(sql`
    select t.created_at as at, e.amount_cents as cents, t.memo,
      coalesce('@' || u.username, u.email) as who, coalesce('@' || s.username, s.email) as by
    from ledger_transactions t
    join ledger_entries e on e.transaction_id = t.id
    join ledger_accounts a on a.id = e.account_id and a.kind = 'creator_available'
    join users u on u.id = a.owner_id
    left join users s on s.id = t.created_by
    where t.kind = 'manual_adjustment' and t.idempotency_key like 'adjustment:credit:%'
    order by t.created_at desc limit 50`)
  return (
    <AdminPage
      title="Credit a user"
      lead="Add money to anyone's available balance. They can withdraw it straight away, and they are told."
    >
      <CreditForm />
      <h2 className="mt-10 mb-3 font-app text-[16px] font-semibold">Recent credits</h2>
      {recent.length === 0 ? (
        <p className="m-0 text-[14px] text-muted-2">No credits yet.</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th className="py-2 font-medium">When</th>
              <th className="py-2 font-medium">User</th>
              <th className="py-2 text-right font-medium">Amount</th>
              <th className="py-2 pl-6 font-medium">Reason</th>
              <th className="py-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r, i) => (
              <tr key={i} className="border-0 border-t border-solid border-line">
                <td className="py-2">
                  {new Date(r.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="py-2">{r.who}</td>
                <td className="py-2 text-right tabular-nums">{formatDollars(Number(r.cents))}</td>
                <td className="py-2 pl-6">{(r.memo ?? '').replace(/^Credit: /, '')}</td>
                <td className="py-2 text-muted-2">{r.by ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminPage>
  )
}
