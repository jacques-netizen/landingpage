'use client'

import { Button, Field, Input, Textarea } from '@mde/ui'
import { useActionState } from 'react'
import { MoneyField } from '../campaigns/builder-parts'
import { Notice } from '../_components/ui'
import { recordFundingAction, saveClientAction, type FormState } from './actions'

type ClientValues = { name: string; contactName: string; contactEmail: string; serviceFee: string; notes: string }

export function ClientForm({ id, initial, canEdit }: { id: string | null; initial: ClientValues; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveClientAction.bind(null, id), {})
  const f = state.fields ?? {}
  return (
    <form action={action} noValidate className="flex max-w-[640px] flex-col gap-5">
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      <Field label="Client name" error={f.name}>
        {(p) => (
          <Input
            id={p.id}
            aria-describedby={p.describedBy}
            invalid={p.invalid}
            name="name"
            defaultValue={initial.name}
            disabled={!canEdit}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-5">
        <Field label="Contact name" error={f.contactName}>
          {(p) => (
            <Input
              id={p.id}
              aria-describedby={p.describedBy}
              name="contactName"
              defaultValue={initial.contactName}
              disabled={!canEdit}
            />
          )}
        </Field>
        <Field label="Contact email" error={f.contactEmail}>
          {(p) => (
            <Input
              id={p.id}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              name="contactEmail"
              type="email"
              defaultValue={initial.contactEmail}
              disabled={!canEdit}
            />
          )}
        </Field>
      </div>
      <Field
        label="Service fee (percent of the budget)"
        helper="Charged on top of the budget. Leave empty for no fee."
        error={f.serviceFee}
      >
        {(p) => (
          <div className="relative max-w-[200px]">
            <Input
              id={p.id}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              name="serviceFee"
              defaultValue={initial.serviceFee.replace(/%$/, '')}
              placeholder="0"
              inputMode="decimal"
              disabled={!canEdit}
              className="pr-9"
            />
            <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted-2">
              %
            </span>
          </div>
        )}
      </Field>
      <Field label="Notes">
        {(p) => <Textarea id={p.id} name="notes" defaultValue={initial.notes} disabled={!canEdit} />}
      </Field>
      {canEdit ? (
        <div>
          <Button type="submit" loading={pending}>
            {id ? 'Save client' : 'Create client'}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

export function FundingForm({ clientId }: { clientId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordFundingAction.bind(null, clientId), {})
  const f = state.fields ?? {}
  return (
    <form action={action} noValidate className="flex max-w-[640px] flex-col gap-5">
      {state.ok ? <Notice kind="ok">{state.ok}</Notice> : null}
      {state.error ? <Notice kind="bad">{state.error}</Notice> : null}
      <div className="grid grid-cols-2 gap-5">
        <MoneyField
          name="amount"
          label="Amount received"
          helper="The budget plus the service fee."
          error={f.amount}
          placeholder="1100"
        />
        <Field label="Invoice or bank reference" error={f.reference}>
          {(p) => (
            <Input
              id={p.id}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              name="reference"
              placeholder="INV-1042"
            />
          )}
        </Field>
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Record funding
        </Button>
      </div>
    </form>
  )
}
