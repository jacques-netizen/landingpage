import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Button, PageContainer } from '@mde/ui'
import { auth } from '@/auth'
import { signOutAction } from '../(auth)/actions'

export const metadata: Metadata = { title: 'Account' }
export const dynamic = 'force-dynamic'

/** Placeholder landing page after sign in. The creator overview replaces it in a later phase. */
export default async function Account() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')
  return (
    <PageContainer className="py-24">
      <h1 className="font-display text-display-md">You are signed in</h1>
      <p className="mt-3 text-body text-ink-2">{session.user.email}</p>
      <form action={signOutAction} className="mt-8">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </PageContainer>
  )
}
