'use client'

import { Button, Field, Select, Textarea } from '@mde/ui'
import { useActionState } from 'react'
import { Notice } from '../../_components/ui'
import { notesAction, suspendAction, warnAction, type CreatorFormState } from './actions'

export function WarnForm({ id, reasons }: { id: string; reasons: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<CreatorFormState, FormData>(warnAction.bind(null, id), {})
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      <Field label="Reason" helper="The creator sees its message.">
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
      <Field label="Note to the creator" helper="Optional.">
        {(p) => <Textarea id={p.id} name="note" aria-describedby={p.describedBy} rows={2} />}
      </Field>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>
          Send warning
        </Button>
      </div>
    </form>
  )
}

export function SuspendForm({ id, suspended }: { id: string; suspended: boolean }) {
  const [state, action, pending] = useActionState<CreatorFormState, FormData>(suspendAction.bind(null, id), {})
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      <Field label="Reason" helper="Required. Kept in the audit log.">
        {(p) => <Textarea id={p.id} name="reason" aria-describedby={p.describedBy} rows={2} />}
      </Field>
      <div>
        {suspended ? (
          <Button type="submit" name="intent" value="restore" loading={pending}>
            Restore
          </Button>
        ) : (
          <Button type="submit" name="intent" value="suspend" variant="secondary" loading={pending}>
            Suspend
          </Button>
        )}
      </div>
    </form>
  )
}

export function NotesForm({ id, notes }: { id: string; notes: string | null }) {
  const [state, action, pending] = useActionState<CreatorFormState, FormData>(notesAction.bind(null, id), {})
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      <Field label="Staff notes" helper="Only staff see these.">
        {(p) => (
          <Textarea
            id={p.id}
            name="notes"
            aria-describedby={p.describedBy}
            rows={4}
            maxLength={4000}
            defaultValue={notes ?? ''}
          />
        )}
      </Field>
      <div>
        <Button type="submit" variant="secondary" size="sm" loading={pending}>
          Save notes
        </Button>
      </div>
    </form>
  )
}
