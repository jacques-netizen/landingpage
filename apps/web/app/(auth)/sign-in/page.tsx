import type { Metadata } from 'next'
import { enabledOAuth } from '@/auth'
import { AuthForm } from '../auth-form'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <>
      {error && (
        <p role="alert" className="mb-6 text-body text-bad">
          {error === 'AccessDenied'
            ? 'That account is not set up yet. Create an account first, then sign in.'
            : error === 'Verification'
              ? 'That link has expired or was already used. Request a new one.'
              : 'We could not sign you in. Try again.'}
        </p>
      )}
      <AuthForm mode="sign-in" oauth={enabledOAuth} />
    </>
  )
}
