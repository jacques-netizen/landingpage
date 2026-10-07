'use client'

import { Button, Checkbox, Field, Input } from '@mde/ui'
import { useActionState, useState } from 'react'
import { authAction, type AuthFormState } from './actions'

type Props = {
  mode: 'sign-in' | 'sign-up' | 'staff'
  next: string
  providers: { google: boolean; discord: boolean }
  initialError?: string
}

function TextField({
  label,
  name,
  error,
  helper,
  ...rest
}: {
  label: string
  name: string
  error?: string
  helper?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} helper={helper}>
      {(p) => (
        <Input
          id={p.id}
          aria-describedby={p.describedBy}
          invalid={p.invalid}
          name={name}
          autoFocus={!!error}
          {...rest}
        />
      )}
    </Field>
  )
}

export function AuthForm({ mode, next, providers, initialError }: Props) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(authAction.bind(null, mode), {
    error: initialError,
  })
  const [intent, setIntent] = useState('')
  const f = state.fields ?? {}
  const anyProvider = mode !== 'staff' && (providers.google || providers.discord)
  const submit = (value: string, label: string, variant?: 'secondary') => (
    <Button
      type="submit"
      name="intent"
      value={value}
      variant={variant}
      arrow={!variant}
      loading={pending && intent === value}
      disabled={pending}
      onClick={() => setIntent(value)}
    >
      {label}
    </Button>
  )
  const or = (
    <div className="flex items-center gap-4 text-[13px] text-muted-2">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  )

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
        <>
          <TextField
            label="Username"
            name="username"
            error={f.username}
            helper="Shown on your profile instead of your email."
            defaultValue={state.username}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            error={f.email}
            defaultValue={state.email}
            autoComplete="email"
            placeholder="name@example.com"
          />
          <TextField label="Password" name="password" type="password" error={f.password} autoComplete="new-password" />
          <TextField
            label="Discord username (optional)"
            name="discord"
            error={f.discord}
            defaultValue={state.discord}
            autoCapitalize="none"
            spellCheck={false}
          />
          <div className="flex flex-col gap-3">
            <Checkbox name="terms" invalid={!!f.terms}>
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
            {f.terms ? <p className="m-0 -mt-1 pl-8 text-[13px] text-bad">{f.terms}</p> : null}
          </div>
          {submit('password', 'Create account')}
        </>
      ) : mode === 'sign-in' ? (
        <>
          <TextField
            label="Username or email"
            name="email"
            error={f.email}
            defaultValue={state.email}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            error={f.password}
            autoComplete="current-password"
          />
          {submit('password', 'Sign in')}
          {or}
          {submit('email', 'Email me a sign-in link', 'secondary')}
        </>
      ) : (
        <>
          <TextField
            label="Email"
            name="email"
            type="email"
            error={f.email}
            defaultValue={state.email}
            autoComplete="email"
            placeholder="name@example.com"
          />
          {submit('email', 'Email me a sign-in link')}
        </>
      )}

      {anyProvider ? (
        <div className="flex flex-col gap-3">
          {mode === 'sign-up' ? or : null}
          {providers.google ? submit('google', 'Continue with Google', 'secondary') : null}
          {providers.discord ? submit('discord', 'Continue with Discord', 'secondary') : null}
        </div>
      ) : null}
    </form>
  )
}
