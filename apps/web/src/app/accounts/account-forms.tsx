'use client'

import { PLATFORM_LABELS } from '@mde/campaigns/templates'
import { Button, Dialog, Field, Input } from '@mde/ui'
import { useActionState, useState, useTransition } from 'react'
import {
  addAccountAction,
  removeAccountAction,
  renewCodeAction,
  verifyAccountAction,
  type AccountState,
} from './actions'

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'x'] as const

function Message({ state }: { state: AccountState }) {
  if (state.error)
    return (
      <p role="alert" className="m-0 text-[14px] text-flagged">
        {state.error}
      </p>
    )
  if (state.ok && state.ok !== 'added')
    return (
      <p role="status" className="m-0 text-[14px] font-semibold" style={{ color: '#4FB286' }}>
        {state.ok}
      </p>
    )
  return null
}

export function AddAccount() {
  const [platform, setPlatform] = useState<string>('tiktok')
  const [state, action, pending] = useActionState<AccountState, FormData>(addAccountAction, {})
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-[13px] font-medium">Platform</legend>
        {/* The mockups' filter pills, wrapping in the narrow column. */}
        <div role="radiogroup" aria-label="Platform" className="flex flex-wrap gap-[6px]">
          {PLATFORMS.map((p) => {
            const on = p === platform
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPlatform(p)}
                className="flex h-[34px] cursor-pointer items-center gap-2 rounded-pill border-0 px-[14px] font-app text-[13px] font-semibold"
                style={{
                  background: on ? 'rgba(216,197,143,0.2)' : 'var(--t-soft)',
                  color: on ? 'var(--t-accent-ink)' : 'var(--t-muted)',
                }}
              >
                <span aria-hidden className="size-[5px] rounded-full" style={{ background: 'currentColor' }} />
                {PLATFORM_LABELS[p]}
              </button>
            )
          })}
        </div>
      </fieldset>
      <input type="hidden" name="platform" value={platform} />
      <Field label="Handle" tone="app" helper="As it appears on your profile.">
        {(p) => (
          <Input
            tone="app"
            id={p.id}
            aria-describedby={p.describedBy}
            name="handle"
            placeholder="@yourname"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </Field>
      <Message state={state} />
      <Button type="submit" tone="app" arrow loading={pending}>
        Get a code
      </Button>
    </form>
  )
}

type ActionsProps = {
  id: string
  theme: 'dark' | 'glass'
  handle: string
  pending: boolean
  expired: boolean
  code: string | null
}

export function AccountActions({ id, theme, handle, pending, expired, code }: ActionsProps) {
  const [state, verify, verifying] = useActionState<AccountState>(verifyAccountAction.bind(null, id), {})
  const [busy, start] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const run = (fn: () => Promise<AccountState>) =>
    start(async () => {
      const r = await fn()
      setError(r.error)
      if (!r.error) setConfirm(false)
    })

  return (
    <div className="mt-4 flex flex-col gap-4">
      {pending && code && !expired ? (
        <div className="rounded-[18px] border border-solid border-[var(--t-hair2)] p-5">
          <div className="text-[12px] font-semibold tracking-[0.06em] text-[var(--t-muted)] uppercase">Your code</div>
          <div
            className="mt-2 text-[32px] leading-none font-bold tracking-[0.04em] tabular-nums select-all"
            style={{ color: 'var(--t-accent-ink)' }}
          >
            {code}
          </div>
          <ol className="mt-4 mb-0 pl-5 text-[14px] leading-[1.6] text-[var(--t-muted)]">
            <li>Add the code anywhere in the public bio of @{handle}.</li>
            <li>Press Verify. It can take a few minutes for a new bio to show.</li>
            <li>Once verified, you can remove the code.</li>
          </ol>
        </div>
      ) : null}
      {pending && expired ? (
        <p className="m-0 text-[14px] text-[var(--t-muted)]">This code has expired. Get a new code to keep going.</p>
      ) : null}
      <Message state={state} />
      {error ? (
        <p role="alert" className="m-0 text-[14px] text-flagged">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {pending && !expired ? (
          <form action={verify}>
            <Button type="submit" tone="app" size="sm" loading={verifying}>
              Verify
            </Button>
          </form>
        ) : null}
        {pending && expired ? (
          <Button tone="app" size="sm" loading={busy} onClick={() => run(() => renewCodeAction(id))}>
            Get a new code
          </Button>
        ) : null}
        <Dialog
          theme={theme}
          open={confirm}
          onOpenChange={setConfirm}
          trigger={
            <Button tone="app" size="sm" variant="quiet">
              Remove
            </Button>
          }
          title={`Remove @${handle}?`}
          description="Posts already submitted from this account keep their status. You can link it again later."
          footer={
            <>
              <Button tone="app" size="sm" variant="secondary" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
              <Button
                tone="app"
                size="sm"
                variant="destructive"
                loading={busy}
                onClick={() => run(() => removeAccountAction(id))}
              >
                Remove account
              </Button>
            </>
          }
        />
      </div>
    </div>
  )
}
