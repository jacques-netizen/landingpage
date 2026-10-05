'use client'

import { Button, Checkbox, Field, Input } from '@mde/ui'
import { useActionState, useState } from 'react'
import { authAction, type AuthFormState } from './actions'

type Props = {
  mode: 'sign-in' | 'sign-up'
  next: string
  providers: { google: boolean; discord: boolean }
  initialError?: string
}

export function AuthForm({ mode, next, providers, initialError }: Props) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(authAction.bind(null, mode), {
    error: initialError,
  })
  const [intent, setIntent] = useState('email')
  const anyProvider = providers.google || providers.discord

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <p
          role="alert"
          className="m-0 rounded-input border border-solid border-[rgba(179,38,30,0.35)] bg-[rgba(179,38,30,0.06)] px-4 py-3 text-[14px] text-bad"
        >
          {state.error}
        </p>
      ) : null}

      {mode === 'sign-up' ? (
        <div className="flex flex-col gap-3">
          <Checkbox name="adult" invalid={!!state.fields?.adult}>
            I am 18 or older.
          </Checkbox>
          {state.fields?.adult ? <p className="m-0 -mt-1 pl-8 text-[13px] text-bad">{state.fields.adult}</p> : null}
          <Checkbox name="terms" invalid={!!state.fields?.terms}>
            I agree to the{' '}
            <a href="/legal/terms" target="_blank" rel="noopener">
              terms of use
            </a>{' '}
            and the{' '}
            <a href="/legal/privacy" target="_blank" rel="noopener">
              privacy policy
            </a>
            .
          </Checkbox>
          {state.fields?.terms ? <p className="m-0 -mt-1 pl-8 text-[13px] text-bad">{state.fields.terms}</p> : null}
        </div>
      ) : null}

      {anyProvider ? (
        <div className="flex flex-col gap-3">
          {providers.google ? (
            <Button
              type="submit"
              name="intent"
              value="google"
              variant="secondary"
              loading={pending && intent === 'google'}
              disabled={pending}
              onClick={() => setIntent('google')}
            >
              Continue with Google
            </Button>
          ) : null}
          {providers.discord ? (
            <Button
              type="submit"
              name="intent"
              value="discord"
              variant="secondary"
              loading={pending && intent === 'discord'}
              disabled={pending}
              onClick={() => setIntent('discord')}
            >
              Continue with Discord
            </Button>
          ) : null}
          <div className="flex items-center gap-4 text-[13px] text-muted-2">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      ) : null}

      <Field label="Email" error={state.fields?.email}>
        {(p) => (
          <Input
            id={p.id}
            aria-describedby={p.describedBy}
            invalid={p.invalid}
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            autoFocus={!!state.fields?.email}
            placeholder="name@example.com"
          />
        )}
      </Field>
      <Button
        type="submit"
        name="intent"
        value="email"
        arrow
        loading={pending && intent === 'email'}
        disabled={pending}
        onClick={() => setIntent('email')}
      >
        Email me a sign-in link
      </Button>
    </form>
  )
}
