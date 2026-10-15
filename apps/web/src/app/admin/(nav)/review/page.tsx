import { redirect } from 'next/navigation'

// Review moved inside each campaign (owner brief, 2026-10-15). Old links land on the campaign's Review
// tab when they named one, otherwise on the home list of campaigns.
export default async function ReviewRedirect({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const { campaign } = await searchParams
  if (campaign && /^[0-9a-f-]{36}$/i.test(campaign)) redirect(`/admin/campaigns/${campaign}?tab=review`)
  redirect('/admin')
}
