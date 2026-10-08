'use client'

import { Button, Dialog, Field, Input } from '@mde/ui'
import { parseDollarsToCents } from '@mde/money/dollars'
import { withdrawalQuote, type WithdrawalFeeSettings } from '@mde/money/quote'
import { useState, useTransition } from 'react'
import { requestWithdrawalAction } from '@/app/wallet/actions'
import { fmt } from './wallet-model'

// Withdraw to the saved crypto wallet (owner request, 2026-10-08). Shows the fee and what arrives,
// worked out with the same function the server uses. Not in the mockups: the wallet's own dialog style.
export function WithdrawDialog({
  theme,
  open,
  onOpenChange,
  availableCents,
  fees,
  to,
  onDone,
}: {
  theme: 'dark' | 'glass'
  open: boolean
  onOpenChange: (open: boolean) => void
  availableCents: number
  fees: WithdrawalFeeSettings
  to: string
  onDone: () => void
}) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, start] = useTransition()
  const shown = amount || (availableCents / 100).toFixed(2)
  const parsed = parseDollarsToCents(shown)
  const quote = parsed.ok ? withdrawalQuote(parsed.cents, fees) : null

  const submit = () =>
    start(async () => {
      const r = await requestWithdrawalAction({ amount: shown })
      if (!r.ok) return setError(r.error)
      setError(null)
      setAmount('')
      onDone()
    })

  return (
    <Dialog
      theme={theme}
      open={open}
      onOpenChange={onOpenChange}
      title="Withdraw"
      description={`Available: ${fmt(availableCents)}. We verify every withdrawal, then send it to your wallet.`}
      footer={
        <>
          <Button tone="app" size="sm" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button tone="app" size="sm" onClick={submit} loading={busy} disabled={!quote?.ok}>
            Request withdrawal
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5" data-theme={theme}>
        <Field tone="app" label="Amount in USD" error={error ?? (quote && !quote.ok ? quote.message : undefined)}>
          {(p) => (
            <Input
              tone="app"
              id={p.id}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              value={shown}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
          )}
        </Field>
        <dl className="m-0 flex flex-col gap-2 text-[14px]">
          {(
            [
              ['Fee', quote?.ok ? fmt(quote.feeCents) : '...'],
              ['You receive', quote?.ok ? `${fmt(quote.netCents)} in stablecoins` : '...'],
              ['To', to],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-[var(--t-muted)]">{k}</dt>
              <dd className="m-0 text-right font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Dialog>
  )
}
