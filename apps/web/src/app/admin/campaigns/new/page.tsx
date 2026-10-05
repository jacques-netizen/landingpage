import { TEMPLATES, type CampaignType } from '@mde/campaigns/templates'
import { db, tables } from '@mde/db'
import { asc } from 'drizzle-orm'
import { requireStaff } from '@/server/guard'
import { AdminPage, LinkButton } from '../../_components/ui'
import { CampaignBuilder } from '../builder'
import { valuesForTemplate } from '../values'

const TYPE_COLOUR: Record<CampaignType, string> = {
  clipping: '#DDF59A',
  logo: '#D3C7FF',
  music: '#FFD3B0',
  ugc: '#CDE6FF',
}

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireStaff('money', '/admin/campaigns/new')
  const { type } = await searchParams
  if (!type || !(type in TEMPLATES)) {
    return (
      <AdminPage
        title="New campaign"
        lead="Start from a template. It fills in the rules for that kind of campaign; you can change any of them."
      >
        <ul className="m-0 grid max-w-[860px] grid-cols-2 gap-4 p-0">
          {Object.values(TEMPLATES).map((t) => (
            <li key={t.type} className="list-none">
              <a
                href={`/admin/campaigns/new?type=${t.type}`}
                className="block rounded-card border border-solid border-line p-6 no-underline hover:border-sand"
              >
                <span
                  className="inline-flex h-8 items-center rounded-chip px-3 text-[13px] text-ink"
                  style={{ background: TYPE_COLOUR[t.type] }}
                >
                  {t.label}
                </span>
                <span className="mt-4 block text-[15px] text-ink">{t.description}</span>
                <span className="mt-2 block text-[13px] text-muted-2">{t.checks.join('. ')}.</span>
              </a>
            </li>
          ))}
        </ul>
      </AdminPage>
    )
  }
  const clients = await db()
    .select({ id: tables.clients.id, name: tables.clients.name })
    .from(tables.clients)
    .orderBy(asc(tables.clients.name))
  return (
    <AdminPage
      title="New campaign"
      lead="Saved as a draft. Publish it when it is ready; it goes live once fully funded."
      actions={
        <LinkButton href="/admin/campaigns/new" variant="secondary">
          Change template
        </LinkButton>
      }
    >
      {clients.length === 0 ? (
        <p className="m-0 text-[15px] text-muted-2">
          Add a client first. <a href="/admin/clients/new">New client</a>
        </p>
      ) : (
        <CampaignBuilder id={null} initial={valuesForTemplate(type as CampaignType)} clients={clients} locked={[]} />
      )}
    </AdminPage>
  )
}
