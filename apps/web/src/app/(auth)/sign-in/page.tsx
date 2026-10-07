import type { Metadata } from 'next'
import { enabledProviders } from '@/auth'
import { AuthForm } from '../auth-form'
import { AuthShell } from '../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Sign in | Maison d'Élites" }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '/campaigns' } = await searchParams
  return (
    <AuthShell
      title="Sign in"
      lead="We email you a link. No password needed."
      footer={
        <>
          New here?{' '}
          <a href={`/sign-up${next !== '/campaigns' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</a>
        </>
      }
    >
      <AuthForm mode="sign-in" next={next} providers={enabledProviders()} />
    </AuthShell>
  )
}
