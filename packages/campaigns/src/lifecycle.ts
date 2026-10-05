// The campaign-lifecycle job (03_SYSTEMS.md section 11), every 5 minutes. Closes campaigns whose end
// date has passed or whose budget is used up. Safe to run twice: a closed campaign is skipped.
// Campaigns open by date without a job: a live campaign takes submissions only inside its window.
import type { Db } from '@mde/db'
import { sql } from 'drizzle-orm'
import { closeCampaign } from './service'

export async function runCampaignLifecycle(db: Db, now = new Date()) {
  const due = await db.execute<{ id: string }>(sql`
    select c.id from campaigns c
    where c.status = 'closing'
       or (c.status = 'live' and c.end_at is not null and c.end_at <= ${now.toISOString()}::timestamptz)
       or (c.status = 'live' and exists(select 1 from ledger_transactions t where t.kind = 'campaign_funded' and t.campaign_id = c.id)
           and coalesce((select sum(e.amount_cents) from ledger_entries e join ledger_accounts a on a.id = e.account_id
                         where a.kind = 'campaign_budget' and a.owner_id = c.id), 0) < 1)`)
  let closed = 0
  for (const { id } of due) {
    await db.transaction(async (tx) => {
      // Re-check under the row lock: another run may have closed it already.
      const rows = await tx.execute<{ status: string }>(sql`select status from campaigns where id = ${id} for update`)
      if (!['live', 'closing'].includes(rows[0]?.status ?? '')) return
      await closeCampaign(tx, null, id, now)
      closed++
    })
  }
  return { closed }
}
