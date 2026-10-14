'use client'

import { formatDollars } from '@mde/money/dollars'
import { Button, Field, Input, Textarea } from '@mde/ui'
import { useActionState } from 'react'
import { Notice } from '../../_components/ui'
import { approveProofAction, rejectProofAction, type ProofDecisionState } from './actions'

export type ProofRow = {
  id: string
  status: string
  code: string
  claimedViews: number | null
  setViews: number | null
  note: string | null
  decisionNote: string | null
  requestedAt: string
  submittedAt: string | null
  reviewedAt: string | null
  screenshotUrl: string | null
  recordingUrl: string | null
  submission: {
    id: string
    platform: string
    postUrl: string
    state: string
    latestViews: number
    baselineViews: number
    countedViews: number
    earnedCents: number
  }
  campaign: { id: string; title: string }
  creator: { id: string; email: string; username: string | null; name: string | null; handle: string | null }
}

const n = (v: number) => v.toLocaleString('en-US')
const when = (iso: string | null) => (iso ? iso.replace('T', ' ').slice(0, 16) + ' UTC' : '')

export function ProofCard({ p, rules }: { p: ProofRow; rules: string[] }) {
  const [approveState, approve, approving] = useActionState<ProofDecisionState, FormData>(
    approveProofAction.bind(null, p.id),
    {},
  )
  const [rejectState, reject, rejecting] = useActionState<ProofDecisionState, FormData>(
    rejectProofAction.bind(null, p.id),
    {},
  )
  const state = approveState.ok || approveState.error ? approveState : rejectState
  const decided = p.status !== 'submitted'
  return (
    <article className="rounded-[14px] border border-solid border-line bg-panel p-5 text-[13px]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-app text-[16px] font-semibold">
            {p.creator.handle ? `@${p.creator.handle}` : (p.creator.username ?? p.creator.email)} · {p.campaign.title}
          </h2>
          <p className="mt-1 mb-0 text-muted-2">
            {p.submission.platform} ·{' '}
            <a href={p.submission.postUrl} target="_blank" rel="noreferrer" className="text-ink">
              open post
            </a>{' '}
            ·{' '}
            <a href={`/admin/submissions/${p.submission.id}`} className="text-ink">
              post detail
            </a>{' '}
            · sent {when(p.submittedAt)}
          </p>
        </div>
        <dl className="m-0 grid grid-cols-4 gap-5 text-right">
          {[
            ['Reported', p.claimedViews === null ? '' : n(p.claimedViews)],
            ['We have', n(p.submission.latestViews)],
            ['Counted', n(p.submission.countedViews)],
            ['Earned', formatDollars(p.submission.earnedCents)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12px] text-muted-2">{k}</dt>
              <dd className="m-0 font-app text-[18px] font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-5">
        <div>
          <p className="m-0 mb-2 font-semibold">Recording</p>
          {p.recordingUrl ? (
            <video src={p.recordingUrl} controls playsInline className="w-full rounded-[10px] bg-ink" />
          ) : (
            <p className="m-0 text-muted-2">No recording.</p>
          )}
        </div>
        <div>
          <p className="m-0 mb-2 font-semibold">Screenshot</p>
          {p.screenshotUrl ? (
            <a href={p.screenshotUrl} target="_blank" rel="noreferrer">
              <img
                src={p.screenshotUrl}
                alt="Analytics screenshot"
                className="w-full rounded-[10px] border border-solid border-line"
              />
            </a>
          ) : (
            <p className="m-0 text-muted-2">No screenshot.</p>
          )}
        </div>
        <div>
          <p className="m-0 mb-2 font-semibold">
            Check against the rules. Code <span className="font-mono">{p.code}</span>, issued {when(p.requestedAt)}.
          </p>
          <ol className="m-0 pl-5 text-muted-2">
            {rules.map((r) => (
              <li key={r} className="py-[2px]">
                {r}
              </li>
            ))}
          </ol>
          {p.note ? (
            <p className="mt-3 mb-0">
              <span className="text-muted-2">Creator's note:</span> {p.note}
            </p>
          ) : null}
        </div>
      </div>

      {decided ? (
        <p className="mt-4 mb-0 text-muted-2">
          {p.status === 'approved' ? `Approved, views set to ${n(p.setViews ?? 0)}` : 'Rejected'} {when(p.reviewedAt)}
          {p.decisionNote ? `. ${p.decisionNote}` : ''}
        </p>
      ) : state.ok ? (
        <div className="mt-4">
          <Notice kind="ok">{state.ok}</Notice>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-6 border-0 border-t border-solid border-line pt-5">
          <form action={approve} className="flex flex-col gap-3">
            <Field label="Views the recording shows" helper="Must not be below the views we already have.">
              {(f) => <Input id={f.id} name="views" inputMode="numeric" defaultValue={p.claimedViews ?? ''} required />}
            </Field>
            <Field label="Note to the creator" helper="Optional.">
              {(f) => <Textarea id={f.id} name="note" rows={2} maxLength={500} />}
            </Field>
            <Button type="submit" loading={approving} size="sm">
              Set views and approve
            </Button>
          </form>
          <form action={reject} className="flex flex-col gap-3">
            <Field label="Why it is not accepted" helper="The creator sees this.">
              {(f) => <Textarea id={f.id} name="note" rows={4} maxLength={500} required />}
            </Field>
            <Button type="submit" variant="secondary" loading={rejecting} size="sm">
              Reject proof
            </Button>
          </form>
          {state.error ? (
            <div className="col-span-2">
              <Notice kind="bad">{state.error}</Notice>
            </div>
          ) : null}
        </div>
      )}
    </article>
  )
}
