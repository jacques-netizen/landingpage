'use client'

import { Button, Input, Textarea } from '@mde/ui'
import { useActionState } from 'react'
import { saveReasonCodeAction, type ReasonState } from './actions'

export function ReasonCodeRow({
  code,
  label,
  creatorMessage,
}: {
  code: string
  label: string
  creatorMessage: string
}) {
  const [state, action, pending] = useActionState<ReasonState, FormData>(saveReasonCodeAction.bind(null, code), {})
  return (
    <form
      action={action}
      className="grid grid-cols-[180px_200px_minmax(0,1fr)_auto] items-start gap-3 border-0 border-b border-solid border-line py-3"
    >
      <code className="pt-3 text-[12px] break-all text-muted-2">{code}</code>
      <Input name="label" defaultValue={label} aria-label={`Label for ${code}`} className="h-10 text-[13px]" />
      <div>
        <Textarea
          name="creatorMessage"
          defaultValue={creatorMessage}
          aria-label={`Creator message for ${code}`}
          rows={2}
          className="min-h-10 py-2 text-[13px]"
        />
        {state.error ? (
          <p role="alert" className="m-0 mt-1 text-[12px] text-bad">
            {state.error}
          </p>
        ) : state.ok && !pending ? (
          <p role="status" className="m-0 mt-1 text-[12px] text-ok-ink">
            {state.ok}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="sm" variant="secondary" loading={pending}>
        Save
      </Button>
    </form>
  )
}
