'use client'

import { Button, Field, Input } from '@mde/ui'
import { useActionState, useState } from 'react'
import { codeAction, type CodeFormState } from '../../actions'

export function CodeForm() {
  const [state, action, pending] = useActionState<CodeFormState, FormData>(codeAction, {})
  const [intent, setIntent] = useState('')
  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {state.sent ? (
        <p role="status" className="m-0 text-[14px] text-ok-ink">
          We sent a new code.
        </p>
      ) : null}
      <Field label="Code" error={state.error}>
        {(p) => (
          <Input
            id={p.id}
            aria-describedby={p.describedBy}
            invalid={p.invalid}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
            placeholder="123456"
            className="text-[20px] tracking-[0.3em]"
          />
        )}
      </Field>
      <Button
        type="submit"
        name="intent"
        value="check"
        arrow
        loading={pending && intent === 'check'}
        disabled={pending}
        onClick={() => setIntent('check')}
      >
        Sign in
      </Button>
      <Button
        type="submit"
        name="intent"
        value="resend"
        variant="secondary"
        loading={pending && intent === 'resend'}
        disabled={pending}
        onClick={() => setIntent('resend')}
      >
        Send a new code
      </Button>
    </form>
  )
}
