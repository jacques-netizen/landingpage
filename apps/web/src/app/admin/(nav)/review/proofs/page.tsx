import { redirect } from 'next/navigation'

// View verifications moved inside each campaign (owner brief, 2026-10-15).
export default function ProofsRedirect() {
  redirect('/admin')
}
