'use client'

import { Button, Field, Textarea } from '@mde/ui'
import { useActionState } from 'react'
import { Notice } from '../../_components/ui'
import { resolveAppealAction, type AppealState } from './actions'

export function ResolveForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<AppealState, FormData>(resolveAppealAction.bind(null, id), {})
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      <Field label="Reply to the creator" helper="Required. The creator sees it with the outcome.">
        {(p) => <Textarea id={p.id} name="reply" aria-describedby={p.describedBy} rows={4} />}
      </Field>
      <div className="flex gap-3">
        <Button type="submit" name="outcome" value="overturned" loading={pending}>
          Overturn
        </Button>
        <Button type="submit" name="outcome" value="upheld" variant="secondary" disabled={pending}>
          Uphold
        </Button>
      </div>
    </form>
  )
}
