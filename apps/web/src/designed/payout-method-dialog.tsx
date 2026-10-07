'use client'

import { Button, Dialog, Field, Input } from '@mde/ui'
import { useState, useTransition } from 'react'
import { savePayoutMethodAction } from '@/app/wallet/actions'

type Method = 'paypal' | 'bank_transfer'

// "Add payout method" for the wallet (testing report item 5). Not in the mockups: built from the
// wallet's own dialog, fields and buttons in the app tone.
export function PayoutMethodDialog({
  theme,
  open,
  onOpenChange,
  onSaved,
}: {
  theme: 'dark' | 'glass'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [method, setMethod] = useState<Method>('paypal')
  const [name, setName] = useState('')
  const [details, setDetails] = useState('')
  const [errors, setErrors] = useState<{ name?: string; details?: string; form?: string }>({})
  const [busy, start] = useTransition()

  const save = () =>
    start(async () => {
      const r = await savePayoutMethodAction({ method, name, details })
      if (r.ok) {
        setErrors({})
        setDetails('')
        return onSaved()
      }
      setErrors(r.field ? { [r.field]: r.error } : { form: r.error })
    })

  const pill = (m: Method, label: string) => (
    <button
      key={m}
      type="button"
      aria-pressed={method === m}
      onClick={() => {
        setMethod(m)
        setErrors({})
      }}
      className="h-10 flex-1 cursor-pointer rounded-pill border border-solid px-4 font-app text-[14px] font-semibold"
      style={{
        background: method === m ? 'rgba(216,197,143,0.2)' : 'transparent',
        color: method === m ? 'var(--t-accent-ink)' : 'var(--t-muted)',
        borderColor: method === m ? 'rgba(216,197,143,0.6)' : 'var(--t-glass-line)',
      }}
    >
      {label}
    </button>
  )

  return (
    <Dialog
      theme={theme}
      open={open}
      onOpenChange={onOpenChange}
      title="Add payout method"
      description="Where your earnings are sent when you withdraw."
      footer={
        <>
          <Button tone="app" size="sm" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button tone="app" size="sm" onClick={save} loading={busy}>
            Save payout method
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5" data-theme={theme}>
        <div className="flex gap-2" role="group" aria-label="Payout method">
          {pill('paypal', 'PayPal')}
          {pill('bank_transfer', 'Bank transfer')}
        </div>
        <Field tone="app" label="Name on the account" error={errors.name}>
          {(p) => (
            <Input
              tone="app"
              id={p.id}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
        </Field>
        <Field
          tone="app"
          label={method === 'paypal' ? 'PayPal email' : 'IBAN or account number'}
          error={errors.details}
        >
          {(p) => (
            <Input
              tone="app"
              id={p.id}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              inputMode={method === 'paypal' ? 'email' : 'text'}
              autoComplete={method === 'paypal' ? 'email' : 'off'}
              placeholder={method === 'paypal' ? 'name@example.com' : ''}
            />
          )}
        </Field>
        {errors.form ? (
          <p role="alert" className="m-0 text-[13px] text-bad">
            {errors.form}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
