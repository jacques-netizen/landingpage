'use client'

import { Button, Field, Input, Textarea } from '@mde/ui'
import { useActionState } from 'react'
import { sendEnquiry, type EnquiryState } from './actions'

export function EnquiryForm({ contactEmail }: { contactEmail: string }) {
  const [state, action, pending] = useActionState<EnquiryState, FormData>(sendEnquiry, {})
  if (state.ok)
    return (
      <div role="status" className="border-0 border-t border-solid border-line pt-8">
        <p className="m-0 font-serif text-[30px] leading-[1.1]">Thank you. Your message is with us.</p>
        <p className="mt-3 mb-0 text-[15px] text-muted">We will reply by email.</p>
      </div>
    )
  const f = state.fields ?? {}
  const v = state.values ?? {}
  const input = (name: 'name' | 'email' | 'company', label: string, type = 'text', autoComplete?: string) => (
    <Field label={label} error={f[name]}>
      {(p) => (
        <Input
          id={p.id}
          aria-describedby={p.describedBy}
          invalid={p.invalid}
          name={name}
          type={type}
          autoComplete={autoComplete}
          defaultValue={v[name]}
        />
      )}
    </Field>
  )
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.error ? (
        <p
          role="alert"
          className="m-0 rounded-input border border-solid border-[rgba(179,38,30,0.35)] bg-[rgba(179,38,30,0.06)] px-4 py-3 text-[14px] text-bad"
        >
          {state.error} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
        {input('name', 'Your name', 'text', 'name')}
        {input('email', 'Email', 'email', 'email')}
        {input('company', 'Company or artist', 'text', 'organization')}
        <Field label="Budget" helper="Optional. A rough figure is fine.">
          {(p) => <Input id={p.id} aria-describedby={p.describedBy} name="budget" defaultValue={v.budget} />}
        </Field>
      </div>
      <Field label="What would you like to promote?" error={f.message}>
        {(p) => (
          <Textarea
            id={p.id}
            aria-describedby={p.describedBy}
            invalid={p.invalid}
            name="message"
            rows={6}
            defaultValue={v.message}
          />
        )}
      </Field>
      <div aria-hidden className="absolute left-[-10000px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Send enquiry
        </Button>
      </div>
    </form>
  )
}
