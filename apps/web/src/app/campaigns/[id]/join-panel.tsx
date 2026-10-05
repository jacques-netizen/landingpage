'use client'

import { Button, Field, Input } from '@mde/ui'
import { useActionState } from 'react'
import { joinAction, type JoinState } from './actions'

type Props = {
  campaignId: string
  state: 'signed-out' | 'can-join' | 'joined' | 'closed' | 'preview'
  isPrivate: boolean
  opensLabel: string | null
}

// Join, or what to do next. Private campaigns ask for the access code here.
export function JoinPanel({ campaignId, state, isPrivate, opensLabel }: Props) {
  const [result, action, pending] = useActionState<JoinState, FormData>(joinAction.bind(null, campaignId), {})
  if (state === 'preview')
    return (
      <p className="m-0 text-[14px] text-[var(--t-muted)]">Preview. Creators can join once the campaign is live.</p>
    )
  if (state === 'closed')
    return <p className="m-0 text-[14px] text-[var(--t-muted)]">This campaign is closed to new creators.</p>
  if (state === 'joined')
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[15px] font-semibold">You have joined this campaign.</p>
        <p className="m-0 text-[14px] text-[var(--t-muted)]">
          Post on your own account{opensLabel ? ` once submissions open on ${opensLabel}` : ''}, then submit the link
          here.
        </p>
      </div>
    )
  if (state === 'signed-out')
    return (
      <a
        href={`/sign-in?next=/campaigns/${campaignId}`}
        className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-gold-soft px-[26px] text-[14px] font-bold text-ink no-underline hover:text-ink"
      >
        Sign in to join <span aria-hidden>→</span>
      </a>
    )
  return (
    <form action={action} className="flex flex-col gap-4">
      {isPrivate ? (
        <Field
          label="Access code"
          tone="app"
          helper="This campaign is private. Ask the person who shared it for the code."
        >
          {(p) => (
            <Input
              tone="app"
              id={p.id}
              aria-describedby={p.describedBy}
              name="accessCode"
              autoComplete="off"
              placeholder="MDE-7K4Q"
            />
          )}
        </Field>
      ) : null}
      {result.error ? (
        <p role="alert" className="m-0 text-[14px] text-flagged">
          {result.error}
        </p>
      ) : null}
      <Button type="submit" tone="app" arrow loading={pending}>
        Join campaign
      </Button>
    </form>
  )
}
