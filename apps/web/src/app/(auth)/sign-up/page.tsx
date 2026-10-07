import type { Metadata } from 'next'
import { enabledProviders } from '@/auth'
import { AuthForm } from '../auth-form'
import { AuthShell } from '../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Create an account | Maison d'Élites" }

const ERRORS: Record<string, string> = {
  consent: 'Tick both boxes to create an account, then continue.',
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next = '/campaigns', error } = await searchParams
  return (
    <AuthShell
      title="Create an account"
      lead="Join campaigns, post on your own accounts and get paid for every view that counts."
      footer={
        <>
          Already have an account?{' '}
          <a href={`/sign-in${next !== '/campaigns' ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in</a>
        </>
      }
    >
      <AuthForm
        mode="sign-up"
        next={next}
        providers={enabledProviders()}
        initialError={error ? ERRORS[error] : undefined}
      />
    </AuthShell>
  )
}
