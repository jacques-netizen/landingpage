import { db, tables } from '@mde/db'
import { listPartnerKeys } from '@mde/partners'
import { asc, desc, inArray } from 'drizzle-orm'
import { requireStaff } from '@/server/guard'
import { AdminPage } from '../_components/ui'
import { NewKeyForm, RevokeKey } from './forms'

export const dynamic = 'force-dynamic'

// Partner API keys and their webhooks (owner decision, 2026-10-28). Admin only. Not in the mockups;
// staff style.
const when = (d: Date | null) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'Never')

export default async function DevelopersPage() {
  await requireStaff('admin', '/admin/developers')
  const d = db()
  const [keys, clients] = await Promise.all([
    listPartnerKeys(d),
    d
      .select({ id: tables.clients.id, name: tables.clients.name })
      .from(tables.clients)
      .orderBy(asc(tables.clients.name)),
  ])
  const ids = keys.map((k) => k.id)
  const hooks = ids.length
    ? await d.select().from(tables.partnerWebhooks).where(inArray(tables.partnerWebhooks.keyId, ids))
    : []
  const recent = hooks.length
    ? await d
        .select()
        .from(tables.webhookDeliveries)
        .where(
          inArray(
            tables.webhookDeliveries.webhookId,
            hooks.map((h) => h.id),
          ),
        )
        .orderBy(desc(tables.webhookDeliveries.createdAt))
        .limit(200)
    : []
  const clientName = new Map(clients.map((c) => [c.id, c.name]))
  return (
    <AdminPage
      title="Developers"
      lead="API keys for partners you approve. The documentation is public at /developers; a key is what lets a partner use it."
      actions={
        <a href="/developers" target="_blank" rel="noopener" className="text-[14px]">
          Open the developer docs
        </a>
      }
    >
      <section className="max-w-[860px] rounded-card border border-solid border-line bg-field p-6">
        <h2 className="m-0 mb-4 font-app text-[16px] font-semibold">New key</h2>
        <NewKeyForm clients={clients} />
        <p className="mt-4 mb-0 text-[12px] text-muted-2">
          Keys only read: campaigns, clip stats, daily views and published reports. They never see money amounts,
          clippers&apos; emails or payout details. Give a sandbox key first; a live key once the partner is ready.
        </p>
      </section>

      <section className="mt-8 max-w-[860px]">
        <h2 className="m-0 mb-3 font-app text-[16px] font-semibold">Keys</h2>
        {keys.length === 0 ? (
          <p className="m-0 text-[14px] text-muted-2">No keys yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {keys.map((k) => {
              const kh = hooks.filter((h) => h.keyId === k.id && !h.disabledAt)
              return (
                <li key={k.id} className="rounded-[12px] border border-solid border-line bg-field px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <b className="text-[14px]">{k.partner}</b>{' '}
                      <span className="text-[12px] text-muted-2">
                        {k.mode === 'live' ? 'Live' : 'Sandbox'} · <code>{k.prefix}…</code> ·{' '}
                        {k.clientIds?.length
                          ? k.clientIds.map((c) => clientName.get(c) ?? 'Removed client').join(', ')
                          : 'Every campaign'}
                      </span>
                    </div>
                    {k.revokedAt ? (
                      <span className="text-[12px] text-muted">Revoked {when(k.revokedAt)}</span>
                    ) : (
                      <RevokeKey id={k.id} partner={k.partner} />
                    )}
                  </div>
                  <div className="mt-1 text-[12px] text-muted">
                    Created {when(k.createdAt)} · last used {when(k.lastUsedAt)}
                  </div>
                  {kh.length ? (
                    <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[12px]">
                      {kh.map((h) => {
                        const ds = recent.filter((x) => x.webhookId === h.id)
                        const failed = ds.filter((x) => x.failedAt).length
                        const waiting = ds.filter((x) => !x.deliveredAt && !x.failedAt).length
                        return (
                          <li key={h.id} className="rounded-[8px] bg-field-2 px-3 py-2">
                            Webhook <code>{h.url}</code> · {h.events.join(', ')}
                            <div className="text-muted">
                              {ds.length} recent deliveries
                              {waiting ? `, ${waiting} being retried` : ''}
                              {failed ? `, ${failed} failed` : ''}
                              {ds[0] ? ` · last ${when(ds[0].createdAt)}` : ''}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </AdminPage>
  )
}
