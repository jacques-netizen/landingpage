import type { Metadata } from 'next'
import { AuthShell } from '../shell'

export const metadata: Metadata = { title: "Check your email | Maison d'Élites" }

export default function CheckEmailPage() {
  return (
    <AuthShell
      title="Check your email."
      lead="We sent a link to your inbox. It works once and expires in 24 hours. It can take a minute to arrive."
      footer={
        <>
          Wrong address? <a href="/sign-in">Use a different email</a>
        </>
      }
    >
      <p className="m-0 text-[15px] text-muted-2">
        You can close this tab. The link signs you in wherever you open it.
      </p>
    </AuthShell>
  )
}
