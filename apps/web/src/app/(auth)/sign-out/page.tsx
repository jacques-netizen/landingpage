import { Button } from '@mde/ui'
import type { Metadata } from 'next'
import { signOutAction } from '../actions'
import { AuthShell } from '../shell'

export const metadata: Metadata = { title: "Sign out | Maison d'Élites" }

export default function SignOutPage() {
  return (
    <AuthShell title="Sign out" lead="You can sign back in at any time with your email.">
      <form action={signOutAction}>
        <Button type="submit">Sign out</Button>
      </form>
    </AuthShell>
  )
}
