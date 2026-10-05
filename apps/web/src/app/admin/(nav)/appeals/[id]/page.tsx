import { db, tables } from '@mde/db'
import { DECISION_LABEL } from '@mde/submissions'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { appealById, dueSoon } from '@/server/appeals'
import { requireStaff } from '@/server/guard'
import { AdminPage, LinkButton } from '../../_components/ui'
import { ResolveForm } from './form'

export const dynamic = 'force-dynamic'

const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

// One appeal: the original decision and evidence, the creator's message, and uphold or overturn with
// a reply (01_PRODUCT.md 8.4, 03_SYSTEMS.md section 7).
export default async function AppealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireStaff('staff', `/admin/appeals/${id}`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const a = await appealById(id)
  if (!a) notFound()
  const [reason] = a.reasonCode
    ? await db().select().from(tables.reasonCodes).where(eq(tables.reasonCodes.code, a.reasonCode))
    : []
  const decisions = await db()
    .select()
    .from(tables.reviewDecisions)
    .where(eq(tables.reviewDecisions.submissionId, a.submissionId))
    .orderBy(asc(tables.reviewDecisions.createdAt))
  const late = a.dueAt <= new Date()

  return (
    <AdminPage
      title={`Appeal from ${a.name ?? a.email}`}
      lead={`${a.campaignTitle} · ${a.status === 'open' ? `reply by ${when(a.dueAt)}${late ? ' (late)' : dueSoon(a.dueAt) ? ' (within 24 hours)' : ''}` : a.status}`}
      actions={
        <LinkButton href={`/admin/submissions/${a.submissionId}`} variant="secondary">
          Post detail
        </LinkButton>
      }
    >
      <section className="border-0 border-b border-solid border-line pb-6 text-[14px]">
        <h2 className="m-0 mb-2 font-serif text-[22px] font-normal">Original decision</h2>
        <p className="m-0">{reason ? `${reason.label}: ${reason.creatorMessage}` : 'No reason recorded.'}</p>
        {a.reasonNote ? <p className="mt-1 mb-0 text-muted-2">Note: {a.reasonNote}</p> : null}
        <ul className="mt-3 mb-0 pl-5 text-[13px] text-muted-2">
          {decisions.map((d) => (
            <li key={d.id}>
              {DECISION_LABEL[d.outcome] ?? d.outcome} {d.reviewerId ? 'by a reviewer' : 'by the automatic checks'} ·{' '}
              {when(d.createdAt)}
              {d.reasonCode ? ` · ${d.reasonCode}` : ''}
            </li>
          ))}
        </ul>
        <p className="mt-3 mb-0">
          <a href={a.postUrl} target="_blank" rel="noreferrer">
            Open the post
          </a>
        </p>
      </section>
      <section className="border-0 border-b border-solid border-line py-6 text-[14px]">
        <h2 className="m-0 mb-2 font-serif text-[22px] font-normal">The creator says</h2>
        <p className="m-0 whitespace-pre-line">{a.message}</p>
        {a.links?.length ? (
          <ul className="mt-3 mb-0 pl-5 text-[13px]">
            {a.links.map((l) => (
              <li key={l}>
                <a href={l} target="_blank" rel="noreferrer noopener">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="py-6">
        {a.status === 'open' ? (
          <ResolveForm id={a.id} />
        ) : (
          <p className="m-0 text-[14px]">
            {a.status === 'overturned' ? 'Overturned' : 'Upheld'}. Reply: {a.reply}
          </p>
        )}
      </section>
    </AdminPage>
  )
}
