'use client'

import { Button, Field, Input, Select, Textarea } from '@mde/ui'
import { useActionState } from 'react'
import { submitAction, type SubmitCheck, type SubmitState } from './actions'

type Account = { id: string; label: string }

// The review mockup's check colours: Pass green, Review amber. Fail uses the error red.
const DOT = { pass: '#2F7D4F', review: '#B26A00', fail: '#E5675C' } as const
const WORD = { pass: 'Pass', review: 'Review', fail: 'Fail' } as const

const LABELS = [
  'Joined and open for posts',
  'Link is a post on an allowed platform',
  'Posted on a linked account',
  'Not already in this campaign',
  'Within the post limit',
  'Post and stats are public',
  'Posted at the right time',
  'Account meets the rules',
  'Minimum duration',
  'Required hashtag present',
  'Same clip posted before',
]

function CheckList({ checks, running }: { checks?: SubmitCheck[]; running: boolean }) {
  const rows = running ? LABELS.map((label, i) => ({ check: i + 1, label, status: null, message: undefined })) : checks
  if (!rows?.length) return null
  return (
    <ul aria-live="polite" aria-busy={running} className="m-0 list-none p-0">
      {rows.map((c) => (
        <li key={c.check} className="border-0 border-b border-solid border-[var(--t-hair)] py-[10px] text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <span className={c.status ? 'font-semibold' : 'text-[var(--t-muted)]'}>{c.label}</span>
            {c.status ? (
              <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap">
                <span aria-hidden className="size-[7px] rounded-full" style={{ background: DOT[c.status] }} />
                {WORD[c.status]}
              </span>
            ) : (
              <span aria-hidden className="size-[7px] animate-pulse rounded-full bg-[var(--t-hair2)]" />
            )}
          </div>
          {c.message ? <p className="mt-1 mb-0 text-[13px] leading-[1.45] text-[var(--t-muted)]">{c.message}</p> : null}
        </li>
      ))}
    </ul>
  )
}

const OUTCOME: Record<NonNullable<SubmitState['outcome']>, { title: string; body: string }> = {
  needs_review: { title: 'Submitted.', body: 'Your post passed the automatic checks and is waiting for a reviewer.' },
  approved: { title: 'Approved.', body: 'Your post passed every check. Views are counted from now on.' },
  flagged: {
    title: 'Submitted for a closer look.',
    body: 'A reviewer will check it before it earns. Nothing is taken off your earnings.',
  },
  rejected_auto: {
    title: 'Not accepted.',
    body: 'See the reason below. Fix the post and submit the link again, or appeal from your submissions.',
  },
  not_submitted: { title: 'Not submitted.', body: 'See the reason below. Nothing was saved.' },
}

export function SubmitPanel({
  campaignId,
  accounts,
  theme,
}: {
  campaignId: string
  accounts: Account[]
  theme: 'dark' | 'glass'
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitAction.bind(null, campaignId), {})
  if (!accounts.length)
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[15px] font-semibold">You have joined this campaign.</p>
        <p className="m-0 text-[14px] text-[var(--t-muted)]">
          To submit a post, first link and verify the account you post from.
        </p>
        <a
          href="/accounts"
          className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-gold-soft px-[26px] text-[14px] font-bold text-ink no-underline hover:text-ink"
        >
          Link an account <span aria-hidden>→</span>
        </a>
      </div>
    )
  const outcome = !pending && state.outcome ? OUTCOME[state.outcome] : null
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <Field label="Account you posted from" tone="app">
          {(p) => (
            <Select
              tone="app"
              theme={theme}
              id={p.id}
              name="linkedAccountId"
              aria-describedby={p.describedBy}
              defaultValue={state.values?.linkedAccountId || (accounts.length === 1 ? accounts[0]!.id : undefined)}
              placeholder="Choose an account"
              options={accounts.map((a) => ({ value: a.id, label: a.label }))}
            />
          )}
        </Field>
        <Field label="Link to your post" tone="app" helper="Copy it from the post itself.">
          {(p) => (
            <Input
              tone="app"
              id={p.id}
              aria-describedby={p.describedBy}
              name="postUrl"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              defaultValue={state.values?.postUrl}
            />
          )}
        </Field>
        <Field label="Note for the reviewer" tone="app" helper="Optional.">
          {(p) => (
            <Textarea
              tone="app"
              id={p.id}
              aria-describedby={p.describedBy}
              name="note"
              rows={2}
              maxLength={1000}
              defaultValue={state.values?.note}
            />
          )}
        </Field>
        {state.error && !pending ? (
          <p role="alert" className="m-0 text-[14px] text-flagged">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" tone="app" arrow loading={pending}>
          {pending ? 'Checking your post' : 'Submit post'}
        </Button>
      </form>
      {outcome ? (
        <div role="status">
          <p className="m-0 text-[15px] font-semibold">{outcome.title}</p>
          <p className="mt-1 mb-0 text-[13px] text-[var(--t-muted)]">{outcome.body}</p>
        </div>
      ) : null}
      <CheckList checks={state.checks} running={pending} />
      {outcome && state.outcome !== 'not_submitted' ? (
        <a href="/submissions" className="text-[13px] font-semibold text-[var(--t-accent-ink)]">
          See all your submissions
        </a>
      ) : null}
    </div>
  )
}
