import type { Metadata } from 'next'
import { AuthShell } from '../shell'

export const metadata: Metadata = { title: "Sign-in problem | Maison d'Élites" }

const MESSAGES: Record<string, string> = {
  Verification: 'This link has expired or was already used. Ask for a new one.',
  AccessDenied: 'This account cannot sign in. Contact support if you think this is a mistake.',
  Configuration: 'Sign in is not available right now. Try again in a few minutes.',
}

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error = '' } = await searchParams
  return (
    <AuthShell title="We could not sign you in." lead={MESSAGES[error] ?? 'Something went wrong. Try again.'}>
      <a
        href="/sign-in"
        className="inline-flex h-12 items-center rounded-pill bg-ink px-6 text-[15px] font-medium text-white no-underline hover:text-white"
      >
        Back to sign in{' '}
        <span aria-hidden className="ml-3">
          →
        </span>
      </a>
    </AuthShell>
  )
}
