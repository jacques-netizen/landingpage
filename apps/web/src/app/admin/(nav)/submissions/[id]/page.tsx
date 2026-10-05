import { db, tables } from '@mde/db'
import { formatDollars } from '@mde/money/dollars'
import { CREATOR_STATE, DECISION_LABEL, listReasonCodes, type CheckResult } from '@mde/submissions'
import { LineChart, StatusBadge } from '@mde/ui'
import { asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/server/guard'
import { AdminPage, LinkButton } from '../../_components/ui'
import { ClearFlag, DecisionForm } from './forms'

export const dynamic = 'force-dynamic'

const count = (n: number) => n.toLocaleString('en-US')
const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
const FLAG_LABEL: Record<string, string> = {
  view_jump: 'View jump',
  engagement_below_floor: 'Engagement below the floor',
  duplicate_media: 'Same clip posted before',
  wrong_author: 'Posted from another account',
  follower_drop: 'Follower drop',
}

// Post detail (01_PRODUCT.md 8.4): the post link, creator and account, checks, view history,
// flags, previous decisions, reason picker and note. Not in the mockups; staff screen style.
export default async function SubmissionAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireStaff('staff', `/admin/submissions/${id}`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const d = db()
  const [row] = await d
    .select({
      s: tables.submissions,
      campaign: tables.campaigns.title,
      email: tables.users.email,
      name: tables.users.name,
    })
    .from(tables.submissions)
    .innerJoin(tables.campaigns, eq(tables.campaigns.id, tables.submissions.campaignId))
    .innerJoin(tables.users, eq(tables.users.id, tables.submissions.creatorId))
    .where(eq(tables.submissions.id, id))
  if (!row) notFound()
  const s = row.s
  const [account, snaps, decisions, flags, appeal, reasons] = await Promise.all([
    s.linkedAccountId
      ? d
          .select()
          .from(tables.linkedAccounts)
          .where(eq(tables.linkedAccounts.id, s.linkedAccountId))
          .then((r) => r[0])
      : null,
    d
      .select()
      .from(tables.viewSnapshots)
      .where(eq(tables.viewSnapshots.submissionId, id))
      .orderBy(asc(tables.viewSnapshots.takenAt)),
    d
      .select({ dec: tables.reviewDecisions, email: tables.users.email })
      .from(tables.reviewDecisions)
      .leftJoin(tables.users, eq(tables.users.id, tables.reviewDecisions.reviewerId))
      .where(eq(tables.reviewDecisions.submissionId, id))
      .orderBy(asc(tables.reviewDecisions.createdAt)),
    d
      .select()
      .from(tables.fraudFlags)
      .where(eq(tables.fraudFlags.submissionId, id))
      .orderBy(asc(tables.fraudFlags.createdAt)),
    d
      .select()
      .from(tables.appeals)
      .where(eq(tables.appeals.submissionId, id))
      .then((r) => r[0]),
    listReasonCodes(d),
  ])
  const label = CREATOR_STATE[s.state]?.label ?? s.state
  const tone = CREATOR_STATE[s.state]?.tone
  const views = snaps.filter((x) => x.views !== null)
  const checks = (s.checkResults ?? []) as CheckResult[]

  return (
    <AdminPage
      title="Post detail"
      lead={`${row.campaign} · ${row.name ?? row.email} · submitted ${when(s.submittedAt)}`}
      actions={
        <LinkButton href={s.postUrl} variant="secondary">
          Open post
        </LinkButton>
      }
    >
      <dl className="m-0 grid grid-cols-4 gap-8 border-0 border-y border-solid border-line py-6">
        <div>
          <dt className="text-[13px] text-muted-2">State</dt>
          <dd className="m-0 mt-2">
            <StatusBadge status={tone === 'good' ? 'ok' : tone === 'bad' ? 'bad' : 'warn'}>{label}</StatusBadge>
          </dd>
        </div>
        {[
          ['Counted views', count(s.countedViews)],
          ['Total views', count(s.latestViews)],
          ['Earned', formatDollars(s.earnedCents)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[13px] text-muted-2">{k}</dt>
            <dd className="m-0 mt-1 font-serif text-[28px] tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="border-0 border-b border-solid border-line py-6 text-[14px]">
        <h2 className="m-0 mb-2 font-serif text-[22px] font-normal">Creator and account</h2>
        <p className="m-0">
          {row.name ?? row.email} ·{' '}
          {account
            ? `${account.platform} @${account.handle} (${account.status}, ${account.followers === null ? 'followers hidden' : `${count(account.followers)} followers`})`
            : 'no linked account matched'}
        </p>
        <p className="mt-1 mb-0 text-muted-2">
          Rate locked at {formatDollars(s.rateCentsPer1000Locked)} per 1,000 views. Baseline {count(s.baselineViews)}{' '}
          views.
        </p>
        {s.creatorNote ? <p className="mt-2 mb-0">Note from the creator: {s.creatorNote}</p> : null}
      </section>

      <section className="border-0 border-b border-solid border-line py-6">
        {views.length ? (
          <LineChart
            title="View history"
            summary={`${views.length} checks, from ${count(views[0]!.views!)} to ${count(views.at(-1)!.views!)} views.`}
            points={views.map((x) => ({ label: when(x.takenAt), value: x.views! }))}
          />
        ) : (
          <p className="m-0 text-[13px] text-muted-2">No view checks with data yet.</p>
        )}
      </section>

      <section className="border-0 border-b border-solid border-line py-6 text-[13px]">
        <h2 className="m-0 mb-2 font-serif text-[22px] font-normal">Checks</h2>
        {checks.length === 0 ? <p className="m-0 text-muted-2">No automatic check results stored.</p> : null}
        {checks.map((c) => (
          <div key={c.check} className="flex items-center gap-3 border-0 border-b border-solid border-line py-2">
            <span
              className="size-[6px] rounded-full"
              style={{ background: c.status === 'pass' ? '#2F7D4F' : c.status === 'review' ? '#B26A00' : '#B3261E' }}
            />
            <span className="flex-1">
              {c.label}
              {c.detail ? <span className="text-muted-2"> · {c.detail}</span> : null}
            </span>
            <span className="text-muted-2">
              {c.status === 'pass' ? 'Pass' : c.status === 'review' ? 'Review' : 'Fail'}
            </span>
          </div>
        ))}
      </section>

      <section className="border-0 border-b border-solid border-line py-6 text-[13px]">
        <h2 className="m-0 mb-2 font-serif text-[22px] font-normal">Flags</h2>
        {flags.length === 0 ? <p className="m-0 text-muted-2">No flags.</p> : null}
        {flags.map((f) => (
          <div key={f.id} className="border-0 border-b border-solid border-line py-3">
            <span className="font-medium">{FLAG_LABEL[f.kind] ?? f.kind}</span>{' '}
            <span className="text-muted-2">
              · {f.status} · {when(f.createdAt)}
            </span>
            {f.status === 'open' ? <ClearFlag id={id} flagId={f.id} /> : null}
          </div>
        ))}
      </section>

      <section className="border-0 border-b border-solid border-line py-6 text-[13px]">
        <h2 className="m-0 mb-2 font-serif text-[22px] font-normal">Decisions</h2>
        {decisions.length === 0 ? <p className="m-0 text-muted-2">No decisions yet.</p> : null}
        {decisions.map(({ dec, email }) => (
          <p key={dec.id} className="my-2">
            <span className="font-medium">{DECISION_LABEL[dec.outcome] ?? dec.outcome}</span>{' '}
            <span className="text-muted-2">
              by {email ?? 'the automatic checks'} · {when(dec.createdAt)}
              {dec.reasonCode ? ` · ${dec.reasonCode}` : ''}
            </span>
            {dec.note ? <span className="block">{dec.note}</span> : null}
          </p>
        ))}
        {appeal ? (
          <p className="mt-3 mb-0">
            Appeal {appeal.status}, due {when(appeal.dueAt)}.{' '}
            <a href={`/admin/appeals/${appeal.id}`}>Open the appeal</a>
          </p>
        ) : null}
      </section>

      <section className="py-6">
        <h2 className="m-0 mb-4 font-serif text-[22px] font-normal">Decide</h2>
        <DecisionForm
          id={id}
          reasons={reasons.map((r) => ({ value: r.code, label: r.label }))}
          can={{
            approve: ['needs_review', 'needs_info', 'flagged', 'rejected', 'rejected_auto', 'removed'].includes(
              s.state,
            ),
            reject: ['needs_review', 'needs_info', 'flagged', 'approved', 'earning', 'final'].includes(s.state),
            info: ['needs_review', 'flagged'].includes(s.state),
          }}
        />
      </section>
    </AdminPage>
  )
}
