import Link from 'next/link'

export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center gap-5 px-6">
      <h1 className="font-display text-display-md">You do not have access</h1>
      <p className="text-body text-ink-2">
        This page is for staff. If you think you should have access, ask an admin.
      </p>
      <Link href="/" className="text-body text-ink underline underline-offset-4">
        Back to the home page
      </Link>
    </main>
  )
}
