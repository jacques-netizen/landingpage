import type { Metadata } from 'next'
import { Table } from '@mde/ui'
import { PageHeading } from '@/components/public-page'
import { publicNumbers } from '@/server/public-settings'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Fees | Maison d'Élites" }

type Fee = { name: string; who: string; amount: string; when: string }

// Every fee a creator or client can pay (01_PRODUCT.md section 8.1). Creator numbers come from
// settings, so this page always matches what the withdraw form and the ledger charge.
export default async function FeesPage() {
  const n = await publicNumbers()
  const creator: Fee[] = [
    { name: 'Joining a campaign', who: 'Creators', amount: 'None', when: 'Never charged' },
    { name: 'Posting and earning', who: 'Creators', amount: 'None', when: 'Never charged' },
    {
      name: 'Withdrawal fee',
      who: 'Creators',
      amount: n.withdrawalFee,
      when: 'Taken only when the payout succeeds. A failed payout is free',
    },
    {
      name: 'Minimum withdrawal',
      who: 'Creators',
      amount: n.withdrawalMin,
      when: 'Not a fee. The smallest amount you can withdraw',
    },
  ]
  const client: Fee[] = [
    {
      name: 'Service fee',
      who: 'Clients',
      amount: 'A percentage of the budget, agreed with each client',
      when: 'Paid on top of the budget when the campaign is funded. The whole budget goes to creators',
    },
  ]
  const columns = [
    { key: 'name', header: 'Fee', cell: (f: Fee) => <span className="font-medium">{f.name}</span> },
    { key: 'amount', header: 'Amount', cell: (f: Fee) => <span className="tabular-nums">{f.amount}</span> },
    { key: 'when', header: 'When', cell: (f: Fee) => <span className="text-muted">{f.when}</span> },
  ]
  return (
    <>
      <PageHeading
        title="Every fee,"
        italic="in one place."
        lead="Creators never pay to join or post. These are the only amounts anyone pays."
      />
      <section className="max-w-[960px]">
        <h2 className="m-0 mb-4 font-serif text-[32px] font-normal">For creators</h2>
        <Table caption="Fees for creators" columns={columns} rows={creator} rowKey={(f) => f.name} />
        <h2 className="mt-16 mb-4 font-serif text-[32px] font-normal">For clients</h2>
        <Table caption="Fees for clients" columns={columns} rows={client} rowKey={(f) => f.name} />
        <p className="mt-10 mb-0 text-[13px] text-muted-2">Earnings become available to withdraw {n.availableWhen}.</p>
      </section>
    </>
  )
}
