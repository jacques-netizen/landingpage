'use client'

import { Button, Field, Input } from '@mde/ui'
import { useActionState, useState } from 'react'
import { MoneyField } from '../campaigns/builder-parts'
import { Notice } from '../_components/ui'
import { creditUserAction, type CreditState } from './actions'

export function CreditForm() {
  const [state, action, pending] = useActionState<CreditState, FormData>(creditUserAction, {})
  // One key per credit, so pressing twice never pays twice; a new one after each success.
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [lastOk, setLastOk] = useState<string | undefined>()
  if (state.ok && state.ok !== lastOk) {
    setLastOk(state.ok)
    setKey(crypto.randomUUID())
  }
  const err = (f: CreditState['field']) => (state.field === f ? state.error : undefined)
  return (
    <form action={action} className="flex max-w-[560px] flex-col gap-5">
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      {state.error && !state.field ? <Notice kind="bad">{state.error}</Notice> : null}
      <input type="hidden" name="key" value={key} />
      <Field label="Username or email" error={err('user')}>
        {(p) => (
          <Input
            id={p.id}
            aria-describedby={p.describedBy}
            invalid={p.invalid}
            name="user"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="@username or name@example.com"
          />
        )}
      </Field>
      <MoneyField name="amount" label="Amount" error={err('amount')} placeholder="25" />
      <Field label="Reason" error={err('reason')} helper="The user sees this, and it is kept in the books.">
        {(p) => (
          <Input
            id={p.id}
            aria-describedby={p.describedBy}
            invalid={p.invalid}
            name="reason"
            maxLength={300}
            placeholder="Bonus for the launch campaign"
          />
        )}
      </Field>
      <div>
        <Button type="submit" loading={pending}>
          Credit user
        </Button>
      </div>
    </form>
  )
}
