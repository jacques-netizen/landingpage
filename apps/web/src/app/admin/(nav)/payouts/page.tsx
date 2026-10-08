import { db, tables } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { countryName } from '@/lib/countries'
import { describeDestination, explorerLink, parseBank, parseDestination } from '@/lib/crypto-wallets'
import { requireStaff } from '@/server/guard'
import { AdminPage } from '../_components/ui'
import { PayoutRow } from './row'

export const dynamic = 'force-dynamic'

const TABS = {
  verify: { label: 'To verify', statuses: ['requested'] },
  send: { label: 'To send', statuses: ['approved', 'in_batch', 'sent'] },
  paid: { label: 'Paid', statuses: ['paid'] },
  returned: { label: 'Returned', statuses: ['failed', 'cancelled'] },
} as const
type Tab = keyof typeof TABS

// Crypto withdrawals for finance and admins (owner request, 2026-10-08).
export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireStaff('money', '/admin/payouts')
  const { show } = await searchParams
  const tab: Tab = show && show in TABS ? (show as Tab) : 'verify'
  const d = db()
  const rows = await d
    .select({
      w: tables.withdrawals,
      email: tables.users.email,
      username: tables.users.username,
      discord: tables.users.discordUsername,
    })
    .from(tables.withdrawals)
    .innerJoin(tables.users, eq(tables.users.id, tables.withdrawals.creatorId))
    .where(inArray(tables.withdrawals.status, [...TABS[tab].statuses]))
    .orderBy(tab === 'verify' || tab === 'send' ? tables.withdrawals.createdAt : desc(tables.withdrawals.updatedAt))
    .limit(200)
  const counts = await d.execute<{ status: string; n: string }>(
    sql`select status, count(*) as n from withdrawals group by status`,
  )
  const n = (t: Tab) =>
    counts
      .filter((c) => (TABS[t].statuses as readonly string[]).includes(c.status))
      .reduce((s, c) => s + Number(c.n), 0)

  return (
    <AdminPage
      title="Payouts"
      lead="Withdrawals to crypto wallets and bank accounts. Verify each one, pay it, then mark it paid with the transaction hash or bank reference."
    >
      <nav aria-label="Payouts" className="mb-5 flex gap-1 rounded-[12px] bg-panel p-1 text-[13px]">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <a
            key={t}
            href={`/admin/payouts?show=${t}`}
            aria-current={t === tab ? 'page' : undefined}
            className={`flex-1 rounded-[9px] px-3 py-2 text-center no-underline ${t === tab ? 'bg-field-2 font-semibold text-ink' : 'text-muted-2'}`}
          >
            {TABS[t].label} ({n(t)})
          </a>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="m-0 rounded-[14px] border border-solid border-line bg-panel p-8 text-center text-[14px] text-muted-2">
          Nothing here.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(({ w, email, username, discord }) => {
            const dest = parseDestination(w.destination)
            const bank = parseBank(w.destination)
            return (
              <PayoutRow
                key={w.id}
                id={w.id}
                status={w.status}
                creator={username ? `@${username}` : email}
                creatorId={w.creatorId}
                contact={[email, discord ? `Discord ${discord}` : null].filter(Boolean).join(' · ')}
                amount={formatDollars(w.amountCents)}
                fee={formatDollars(w.feeCents)}
                net={formatDollars(w.netCents)}
                kind={bank ? 'bank' : 'crypto'}
                coin={
                  dest?.option.label ??
                  (bank
                    ? `Bank transfer, ${countryName(bank.country)}`
                    : (describeDestination(w.destination) ?? w.method))
                }
                address={dest?.address ?? bank?.accountNumber ?? ''}
                bank={bank ? { bankName: bank.bankName, name: bank.name } : null}
                requested={w.createdAt.toISOString()}
                hash={w.partnerReference}
                explorer={explorerLink(w.destination, w.partnerReference)}
                reason={w.failureReason}
              />
            )
          })}
        </div>
      )}
    </AdminPage>
  )
}
