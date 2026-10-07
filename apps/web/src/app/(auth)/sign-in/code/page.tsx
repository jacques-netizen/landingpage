import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { pendingSignIn } from '@/server/devices'
import { AuthShell } from '../../shell'
import { CodeForm } from './code-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Enter your code | Maison d'Élites", robots: { index: false } }

const hide = (email: string) => {
  const [name = '', domain = ''] = email.split('@')
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`
}

// A password sign in on a new device: the 6-digit code from the email (owner request, 2026-10-07).
export default async function CodePage() {
  const p = await pendingSignIn()
  if (!p) redirect('/sign-in')
  return (
    <AuthShell
      title="Check your email."
      lead={`This is a new device, so we sent a 6-digit code to ${hide(p.email)}. It expires in 10 minutes.`}
      footer={
        <>
          Not you? <a href="/sign-in">Sign in again</a>
        </>
      }
    >
      <CodeForm />
    </AuthShell>
  )
}
