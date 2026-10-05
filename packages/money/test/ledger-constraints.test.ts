// Database guarantees behind the ledger: unbalanced transactions are rejected at commit, money rows
// cannot be edited or deleted, and balances that must not go negative cannot.
import { afterAll, describe, expect, it } from 'vitest'
import { connect } from './fixtures'

const ctx = connect(2)
const sql = ctx.client
afterAll(() => ctx.client.end())

async function account(kind: string, ownerType: string | null, ownerId: string | null) {
  const [a] =
    await sql`insert into ledger_accounts (kind, owner_type, owner_id) values (${kind}, ${ownerType}, ${ownerId})
    on conflict (kind, owner_type, owner_id) do update set kind = excluded.kind returning id`
  return a!.id as string
}

const message = (p: Promise<unknown>) =>
  p.then(
    () => 'committed',
    (e: Error) => e.message,
  )

describe('ledger constraints', () => {
  it('rejects a transaction whose entries do not sum to zero', async () => {
    const ext = await account('external', 'platform', null)
    const hold = await account('client_funds_holding', 'client', crypto.randomUUID())
    const result = await message(
      sql.begin(async (tx) => {
        const [t] =
          await tx`insert into ledger_transactions (kind, idempotency_key) values ('client_funding_received', ${crypto.randomUUID()}) returning id`
        await tx`insert into ledger_entries (transaction_id, account_id, amount_cents) values (${t!.id}, ${ext}, -1000), (${t!.id}, ${hold}, 999)`
      }),
    )
    expect(result).toMatch(/does not balance/)
  })

  it('accepts a balanced transaction', async () => {
    const ext = await account('external', 'platform', null)
    const hold = await account('client_funds_holding', 'client', crypto.randomUUID())
    const result = await message(
      sql.begin(async (tx) => {
        const [t] =
          await tx`insert into ledger_transactions (kind, idempotency_key) values ('client_funding_received', ${crypto.randomUUID()}) returning id`
        await tx`insert into ledger_entries (transaction_id, account_id, amount_cents) values (${t!.id}, ${ext}, -1000), (${t!.id}, ${hold}, 1000)`
      }),
    )
    expect(result).toBe('committed')
  })

  it('rejects a transaction that would take a guarded balance below zero', async () => {
    const budget = await account('campaign_budget', 'campaign', crypto.randomUUID())
    const pending = await account('creator_pending', 'creator', crypto.randomUUID())
    const result = await message(
      sql.begin(async (tx) => {
        const [t] =
          await tx`insert into ledger_transactions (kind, idempotency_key) values ('earning_accrued', ${crypto.randomUUID()}) returning id`
        await tx`insert into ledger_entries (transaction_id, account_id, amount_cents) values (${t!.id}, ${budget}, -500), (${t!.id}, ${pending}, 500)`
      }),
    )
    expect(result).toMatch(/below zero/)
  })

  it('never lets ledger rows be edited or deleted', async () => {
    expect(await message(sql`update ledger_entries set amount_cents = amount_cents`)).toMatch(/cannot be changed/)
    expect(await message(sql`delete from ledger_entries`)).toMatch(/cannot be changed/)
    expect(await message(sql`update ledger_transactions set memo = 'x'`)).toMatch(/cannot be changed/)
    expect(await message(sql`delete from ledger_transactions`)).toMatch(/cannot be changed/)
  })
})
