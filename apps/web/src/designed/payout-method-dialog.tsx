'use client'

import { Button, Dialog, Field, Input, Select } from '@mde/ui'
import { useState, useTransition } from 'react'
import { savePayoutMethodAction } from '@/app/wallet/actions'
import { CRYPTO_WALLETS } from '@/lib/crypto-wallets'

// "Add payout method" for the wallet: the crypto wallet withdrawals are sent to (owner request,
// 2026-10-08). Not in the mockups: built from the wallet's own dialog, fields and buttons.
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
  const [wallet, setWallet] = useState<string>(CRYPTO_WALLETS[0].id)
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState<{ wallet?: string; address?: string; form?: string }>({})
  const [busy, start] = useTransition()

  const save = () =>
    start(async () => {
      const r = await savePayoutMethodAction({ wallet, address })
      if (r.ok) {
        setErrors({})
        setAddress('')
        return onSaved()
      }
      setErrors(r.field ? { [r.field]: r.error } : { form: r.error })
    })

  return (
    <Dialog
      theme={theme}
      open={open}
      onOpenChange={onOpenChange}
      title="Add payout method"
      description="Withdrawals are paid in crypto stablecoins, one coin per dollar, to your own wallet."
      footer={
        <>
          <Button tone="app" size="sm" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button tone="app" size="sm" onClick={save} loading={busy}>
            Save wallet
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5" data-theme={theme}>
        <Field tone="app" label="Coin and network" error={errors.wallet}>
          {(p) => (
            <Select
              tone="app"
              theme={theme}
              id={p.id}
              aria-describedby={p.describedBy}
              value={wallet}
              onValueChange={setWallet}
              options={CRYPTO_WALLETS.map((w) => ({ value: w.id, label: w.label }))}
            />
          )}
        </Field>
        <Field
          tone="app"
          label="Wallet address"
          error={errors.address}
          helper="Copy it from your wallet app for this exact coin and network. Money sent on the wrong network is lost."
        >
          {(p) => (
            <Input
              tone="app"
              id={p.id}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="font-mono text-[14px]"
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
