'use client'

import { Button, Dialog, Field, Input } from '@mde/ui'
import { useState, useTransition, type ReactNode } from 'react'
import { savePayoutMethodAction, type PayoutField } from '@/app/wallet/actions'
import { COUNTRIES } from '@/lib/countries'
import { COINS, networksFor } from '@/lib/crypto-wallets'

type Method = 'crypto' | 'bank'

// "Add payout method" for the wallet (owner requests, 2026-10-08): a crypto wallet, set up in three
// separate steps so the coin, network and address cannot be mixed up, or a bank account. Not in the
// mockups: built from the wallet's own dialog, fields and buttons.
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
  const [method, setMethod] = useState<Method>('crypto')
  const [coin, setCoin] = useState('')
  const [network, setNetwork] = useState('')
  const [address, setAddress] = useState('')
  const [bank, setBank] = useState({ country: '', bankName: '', accountNumber: '', name: '' })
  const [errors, setErrors] = useState<Partial<Record<PayoutField | 'form', string>>>({})
  const [busy, start] = useTransition()
  const networks = coin ? networksFor(coin) : []

  const save = () =>
    start(async () => {
      const r = await savePayoutMethodAction(
        method === 'crypto' ? { method, coin, network, address } : { method, ...bank },
      )
      if (r.ok) {
        setErrors({})
        return onSaved()
      }
      setErrors(r.field ? { [r.field]: r.error } : { form: r.error })
    })

  const pill = (on: boolean, label: string, go: () => void, key: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      onClick={go}
      className="h-10 cursor-pointer rounded-pill border border-solid px-4 font-app text-[14px] font-semibold"
      style={{
        background: on ? 'rgba(216,197,143,0.2)' : 'transparent',
        color: on ? 'var(--t-accent-ink)' : 'var(--t-muted)',
        borderColor: on ? 'rgba(216,197,143,0.6)' : 'var(--t-glass-line)',
      }}
    >
      {label}
    </button>
  )

  const step = (n: number, title: string, children: ReactNode, error?: string) => (
    <section aria-label={`Step ${n}: ${title}`} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 font-app text-[13px] font-semibold text-[var(--t-text)]">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full text-[12px]"
          style={{ background: 'rgba(216,197,143,0.2)', color: 'var(--t-accent-ink)' }}
        >
          {n}
        </span>
        {title}
      </div>
      {children}
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-bad">
          {error}
        </p>
      ) : null}
    </section>
  )

  const field = (label: string, key: keyof typeof bank, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field tone="app" label={label} error={errors[key]}>
      {(p) => (
        <Input
          tone="app"
          id={p.id}
          aria-describedby={p.describedBy}
          invalid={p.invalid}
          value={bank[key]}
          onChange={(e) => setBank((b) => ({ ...b, [key]: e.target.value }))}
          {...props}
        />
      )}
    </Field>
  )

  return (
    <Dialog
      theme={theme}
      open={open}
      onOpenChange={onOpenChange}
      title="Add payout method"
      description="Where your withdrawals are paid."
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
      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1" data-theme={theme}>
        <div className="flex gap-2" role="group" aria-label="Payout method">
          {pill(method === 'crypto', 'Crypto', () => setMethod('crypto'), 'crypto')}
          {pill(method === 'bank', 'Bank transfer', () => setMethod('bank'), 'bank')}
        </div>

        {method === 'crypto' ? (
          <>
            {step(
              1,
              'Select the crypto',
              <div className="flex flex-wrap gap-2" role="group" aria-label="Crypto">
                {COINS.map((c) =>
                  pill(
                    coin === c,
                    c,
                    () => {
                      setCoin(c)
                      setNetwork('')
                    },
                    c,
                  ),
                )}
              </div>,
              errors.coin,
            )}
            {step(
              2,
              'Select the network',
              coin ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Network">
                  {networks.map((w) => {
                    const id = w.id.split('|')[1]!
                    return pill(network === id, w.network, () => setNetwork(id), id)
                  })}
                </div>
              ) : (
                <p className="m-0 text-[13px] text-[var(--t-muted)]">Choose the crypto first.</p>
              ),
              errors.network,
            )}
            {step(
              3,
              'Enter the details',
              <Field
                tone="app"
                label="Wallet address"
                helper={
                  coin && network
                    ? `Your ${coin} address on ${networks.find((w) => w.id.endsWith(`|${network}`))?.network}. Money sent on the wrong network is lost.`
                    : 'Choose the crypto and network first.'
                }
              >
                {(p) => (
                  <Input
                    tone="app"
                    id={p.id}
                    aria-describedby={p.describedBy}
                    invalid={!!errors.address}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={!coin || !network}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="font-mono text-[14px]"
                  />
                )}
              </Field>,
              errors.address,
            )}
          </>
        ) : (
          <>
            <Field tone="app" label="Location" error={errors.country}>
              {(p) => (
                // A plain select: 250 countries are easier to pick by typing, and phones show their own list.
                <select
                  id={p.id}
                  aria-describedby={p.describedBy}
                  aria-invalid={p.invalid || undefined}
                  value={bank.country}
                  onChange={(e) => setBank((b) => ({ ...b, country: e.target.value }))}
                  className={`box-border h-12 w-full appearance-none rounded-input border border-solid bg-[var(--t-glass-bg)] px-4 font-app text-[14px] font-medium text-[var(--t-text)] backdrop-blur-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--t-text)] ${p.invalid ? 'border-bad' : 'border-[var(--t-glass-line)]'}`}
                >
                  <option value="">Choose your country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {field('Bank name', 'bankName', { autoComplete: 'off' })}
            {field('Bank account number', 'accountNumber', {
              autoComplete: 'off',
              inputMode: 'text',
              spellCheck: false,
              className: 'font-mono text-[14px]',
            })}
            {field('Name on account', 'name', { autoComplete: 'name' })}
          </>
        )}

        {errors.form ? (
          <p role="alert" className="m-0 text-[13px] text-bad">
            {errors.form}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
