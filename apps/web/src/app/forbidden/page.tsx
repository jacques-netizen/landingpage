import type { Metadata } from 'next'
import { AuthShell } from '../(auth)/shell'

export const metadata: Metadata = { title: "No access | Maison d'Élites", robots: { index: false } }

export default function ForbiddenPage() {
  return (
    <AuthShell
      title="You do not have access to this page."
      lead="Staff pages need a staff role. If you think you should have one, ask an admin."
    >
      <a
        href="/"
        className="inline-flex h-12 items-center rounded-pill bg-ink px-6 text-[15px] font-medium text-white no-underline hover:text-white"
      >
        Go to the home page{' '}
        <span aria-hidden className="ml-3">
          →
        </span>
      </a>
    </AuthShell>
  )
}
