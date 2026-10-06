import type { Metadata } from 'next'
import { enabledProviders } from '@/auth'
import { AuthForm } from '../../auth-form'
import { AuthShell } from '../../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: "Staff sign in | Maison d'Élites", robots: { index: false } }

// The team's own way in: the same secure email link or Google sign in, landing on the staff dashboard.
// Staff accounts are added by an admin on the Team page; there is no sign up here.
export default async function StaffSignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const target = next?.startsWith('/admin') ? next : '/admin'
  return (
    <AuthShell
      title="Staff sign in"
      lead="For the Maison d'Élites team. We email you a link. No password needed."
      footer={<>No access yet? Ask an admin to add you on the Team page.</>}
    >
      <AuthForm mode="sign-in" next={target} providers={enabledProviders()} />
    </AuthShell>
  )
}
