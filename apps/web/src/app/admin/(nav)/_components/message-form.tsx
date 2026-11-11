'use client'

import { Button, Field, Input, Textarea } from '@mde/ui'
import { useActionState, useEffect, useRef } from 'react'
import { Notice } from './ui'

export type MessageState = { ok?: string; error?: string; sent?: number }

// A plain message from staff to clippers, in the app and by email. Not a warning: no strike.
export function MessageForm({
  action,
  submitLabel,
  helper,
}: {
  action: (prev: MessageState, form: FormData) => Promise<MessageState>
  submitLabel: string
  helper: string
}) {
  const [state, run, pending] = useActionState<MessageState, FormData>(action, {})
  const form = useRef<HTMLFormElement>(null)
  // Clear the boxes after a send, so a second press cannot send the same message again by accident.
  useEffect(() => {
    if (state.ok) form.current?.reset()
  }, [state])
  return (
    <form ref={form} action={run} className="flex flex-col gap-4">
      {state.error && !pending ? <Notice kind="bad">{state.error}</Notice> : null}
      {state.ok && !pending ? <Notice kind="ok">{state.ok}</Notice> : null}
      <Field label="Title" helper="Optional. Shown as the first line. Without one: A message from the team.">
        {(p) => <Input id={p.id} name="title" aria-describedby={p.describedBy} maxLength={120} />}
      </Field>
      <Field label="Message" helper={helper}>
        {(p) => <Textarea id={p.id} name="body" aria-describedby={p.describedBy} rows={4} maxLength={2000} required />}
      </Field>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
