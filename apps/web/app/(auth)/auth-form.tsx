'use client'
import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import { AlertCircle, Button, Checkbox, Input, SuccessNote } from '@mde/ui'
import { signInAction, signUpAction, type AuthFormState } from './actions'

const initial: AuthFormState = { status: 'idle' }

export function AuthForm({
  mode,
  oauth,
}: {
  mode: 'sign-in' | 'sign-up'
  oauth: { google: boolean; discord: boolean }
}) {
  const [state, action, pending] = useActionState(
    mode === 'sign-in' ? signInAction : signUpAction,
    initial,
  )
  const formRef = useRef<HTMLFormElement>(null)

  // Move focus to the first field with an error.
  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    }
  }, [state])

  if (state.status === 'sent') {
    return (
      <div className="flex flex-col gap-6" aria-live="polite">
        <h1 className="font-display text-display-md">Check your email</h1>
        <SuccessNote>
          {mode === 'sign-in'
            ? 'If that email has an account, a sign in link is on its way.'
            : 'We sent a sign in link.'}
        </SuccessNote>
        <p className="text-body text-ink-2">
          The link works once and expires in 15 minutes. It was sent to{' '}
          <span className="text-ink">{state.email}</span>.
        </p>
        {mode === 'sign-in' && (
          <p className="text-body-sm text-ink-2">
            New here?{' '}
            <Link href="/sign-up" className="text-ink underline underline-offset-4">
              Create an account
            </Link>
            .
          </p>
        )}
      </div>
    )
  }

  const errs = state.fieldErrors ?? {}
  const hasOAuth = oauth.google || oauth.discord
  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="flex flex-col gap-6"
      aria-busy={pending}
    >
      <h1 className="font-display text-display-md">
        {mode === 'sign-in' ? 'Sign in' : 'Create your account'}
      </h1>

      {state.status === 'error' && state.message && (
        <p role="alert" className="flex items-center gap-2 text-body text-bad">
          <AlertCircle size={16} />
          {state.message}
        </p>
      )}

      {hasOAuth && (
        <div className="flex flex-col gap-3">
          {oauth.google && (
            <Button
              type="submit"
              name="intent"
              value="google"
              variant="secondary"
              disabled={pending}
              className="w-full"
            >
              Continue with Google
            </Button>
          )}
          {oauth.discord && (
            <Button
              type="submit"
              name="intent"
              value="discord"
              variant="secondary"
              disabled={pending}
              className="w-full"
            >
              Continue with Discord
            </Button>
          )}
        </div>
      )}

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errs.email}
        helper={mode === 'sign-in' ? 'We email you a link. No password needed.' : undefined}
        required
      />

      {mode === 'sign-up' && (
        <div className="flex flex-col gap-4">
          <Checkbox name="age" label="I am 18 or older" error={errs.age} />
          <Checkbox
            name="terms"
            label={
              <>
                I accept the{' '}
                <Link href="/legal/terms" className="underline underline-offset-4">
                  terms of use
                </Link>{' '}
                and the{' '}
                <Link href="/legal/privacy" className="underline underline-offset-4">
                  privacy policy
                </Link>
              </>
            }
            error={errs.terms}
          />
        </div>
      )}

      <Button
        type="submit"
        name="intent"
        value="email"
        forward
        loading={pending}
        className="w-full"
      >
        {mode === 'sign-in' ? 'Email me a link' : 'Create account'}
      </Button>

      <p className="text-body-sm text-ink-2">
        {mode === 'sign-in' ? (
          <>
            New here?{' '}
            <Link href="/sign-up" className="text-ink underline underline-offset-4">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/sign-in" className="text-ink underline underline-offset-4">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  )
}
