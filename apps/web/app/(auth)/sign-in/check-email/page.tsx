import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Check your email' }

export default function CheckEmail() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-display-md">Check your email</h1>
      <p className="text-body text-ink-2">
        A sign in link is on its way. It works once and expires in 15 minutes.
      </p>
      <Link href="/sign-in" className="text-body text-ink underline underline-offset-4">
        Back to sign in
      </Link>
    </div>
  )
}
