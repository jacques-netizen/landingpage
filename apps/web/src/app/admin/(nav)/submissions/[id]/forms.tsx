'use client'

import { Button, Field, Select, Textarea } from '@mde/ui'
import { useActionState } from 'react'
import { Notice } from '../../_components/ui'
import { clearFlagAction, decideAction, type DecisionState } from './actions'

export function DecisionForm({
  id,
  reasons,
  can,
}: {
  id: string
  reasons: { value: string; label: string }[]
  can: { approve: boolean; reject: boolean; info: boolean }
}) {
  const [state, action, pending] = useActionState<DecisionState, FormData>(decideAction.bind(null, id), {})
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      <Field label="Reason" helper="Needed to reject or remove. The creator sees its message.">
        {(p) => (
          <Select
            id={p.id}
            name="reasonCode"
            aria-describedby={p.describedBy}
            placeholder="Choose a reason"
            options={reasons}
          />
        )}
      </Field>
      <Field
        label="Note"
        helper="Shown to the creator. Needed to clear flags, ask for information, or with the reason Other."
      >
        {(p) => <Textarea id={p.id} name="note" aria-describedby={p.describedBy} rows={3} />}
      </Field>
      <div className="flex flex-wrap gap-3">
        {can.approve ? (
          <Button type="submit" name="intent" value="approve" loading={pending}>
            Approve
          </Button>
        ) : null}
        {can.reject ? (
          <>
            <Button type="submit" name="intent" value="reject" variant="secondary" disabled={pending}>
              Reject
            </Button>
            <Button type="submit" name="intent" value="remove" variant="quiet" disabled={pending}>
              Remove
            </Button>
          </>
        ) : null}
        {can.info ? (
          <Button type="submit" name="intent" value="info" variant="quiet" disabled={pending}>
            Ask for information
          </Button>
        ) : null}
      </div>
    </form>
  )
}

export function ClearFlag({ id, flagId }: { id: string; flagId: string }) {
  const [state, action, pending] = useActionState<DecisionState, FormData>(clearFlagAction.bind(null, id, flagId), {})
  return (
    <form action={action} className="mt-2 flex items-start gap-2">
      <input
        name="note"
        aria-label="Why this flag is cleared"
        placeholder="Why it is fine"
        className="h-9 flex-1 rounded-input border border-solid border-sand bg-[#FBF7F0] px-3 font-sans text-[13px]"
      />
      <Button type="submit" size="sm" variant="secondary" loading={pending}>
        Clear flag
      </Button>
      {state.error ? <span className="text-[12px] text-bad">{state.error}</span> : null}
    </form>
  )
}
