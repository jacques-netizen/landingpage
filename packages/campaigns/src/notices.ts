// Campaign notifications (03_SYSTEMS.md section 9): staff hear about funding, going live and closing;
// creators with a verified account on one of a public campaign's platforms hear it went live, unless
// they switched new campaign alerts off.
import { notify, tables, type DbOrTx } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { inArray, sql } from 'drizzle-orm'

type Campaign = typeof tables.campaigns.$inferSelect

async function toStaff(d: DbOrTx, roles: string[], n: { title: string; body?: string; link: string }) {
  const staff = await d
    .selectDistinct({ id: tables.staffRoles.userId })
    .from(tables.staffRoles)
    .where(inArray(tables.staffRoles.role, roles))
  for (const { id } of staff) await notify(d, id, 'campaign_event', n)
}

export async function noticeWentLive(d: DbOrTx, c: Campaign) {
  await toStaff(d, ['reviewer', 'finance', 'admin'], {
    title: 'Campaign is live',
    body: c.title,
    link: `/admin/campaigns/${c.id}/monitor`,
  })
  if (c.visibility !== 'public') return
  // One row per matching creator, written in a single statement.
  await d.execute(sql`
    insert into notifications (user_id, kind, title, body, link)
    select u.id, 'new_campaign', ${`New campaign: ${c.title}`},
           ${`Pays ${formatDollars(c.rateCentsPer1000)} per 1,000 views.`}, ${`/campaigns/${c.id}`}
    from users u
    where u.status = 'active' and u.notify_new_campaigns
      and exists (select 1 from linked_accounts a where a.creator_id = u.id and a.status = 'verified'
                  and a.platform in (${sql.join(
                    c.platforms.map((p) => sql`${p}`),
                    sql`, `,
                  )}))`)
}

export async function noticeClosed(d: DbOrTx, c: Campaign) {
  await toStaff(d, ['reviewer', 'finance', 'admin'], {
    title: 'Campaign closed',
    body: c.title,
    link: `/admin/campaigns/${c.id}/monitor`,
  })
}

export async function noticeFunding(d: DbOrTx, clientId: string, amountCents: number) {
  const [client] = await d
    .select({ name: tables.clients.name })
    .from(tables.clients)
    .where(sql`${tables.clients.id} = ${clientId}`)
  await toStaff(d, ['finance', 'admin'], {
    title: 'Funding recorded',
    body: `${formatDollars(amountCents)} from ${client?.name ?? 'a client'}.`,
    link: `/admin/clients/${clientId}`,
  })
}
