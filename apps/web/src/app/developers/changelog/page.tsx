import { H2, P, Page, UL } from '@/developers/ui'

export const metadata = { title: 'Changelog' }

export default function Changelog() {
  return (
    <Page href="/developers/changelog" eyebrow="More" title="Changelog" lead="What changed in the API, newest first.">
      <H2 id="2026-10-28">28 October 2026</H2>
      <P>First release of the API.</P>
      <UL>
        <li>Campaigns, clips, views per day and reports, read-only.</li>
        <li>Webhooks for clip.approved, clip.views_updated, campaign.started and campaign.ended.</li>
        <li>Live and sandbox keys.</li>
        <li>OpenAPI 3.1 description at /api/v1/openapi.json.</li>
      </UL>
    </Page>
  )
}
