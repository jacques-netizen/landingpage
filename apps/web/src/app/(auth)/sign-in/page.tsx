import type { Metadata } from 'next'
import { enabledProviders } from '@/auth'
import { googleCheck } from '@/server/google-check'
import { AuthForm } from '../auth-form'
import { AuthShell } from '../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Sign in | Maison d'Élites" }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '/campaigns' } = await searchParams
  return (
    <AuthShell
      title="Sign in"
      lead="With your username and password, or a link we email you."
      footer={
        <>
          New here?{' '}
          <a href={`/sign-up${next !== '/campaigns' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</a>
        </>
      }
    >
      <AuthForm mode="sign-in" next={next} providers={await signInProviders()} />
    </AuthShell>
  )
}

/** Google's button only while Google accepts the app's sign-in address (owner report, 2026-10-25). */
async function signInProviders() {
  const p = enabledProviders()
  return { ...p, google: p.google && (await googleCheck()).signIn !== false }
}
