import { apiUrl } from '@/developers/base'
import { C, Callout, Cards, Code, H2, P, Page, UL } from '@/developers/ui'

export const metadata = { title: 'Introduction' }

export default function Introduction() {
  return (
    <Page
      href="/developers"
      eyebrow="Developers"
      title="Build on Maison d'Élites"
      lead="Read campaign results straight from the source: every campaign, every clip, its views and engagement, day by day. Get told the moment a clip is approved or its views move."
    >
      <Cards
        items={[
          { title: 'Quickstart', text: 'Make your first request in five minutes.', href: '/developers/quickstart' },
          { title: 'API reference', text: 'Every endpoint, with examples.', href: '/developers/reference' },
          { title: 'Webhooks', text: 'Events pushed to your server as they happen.', href: '/developers/webhooks' },
          { title: 'Sandbox', text: 'Build against demo campaigns before going live.', href: '/developers/sandbox' },
        ]}
      />
      <H2 id="what">What you can build</H2>
      <UL>
        <li>Campaign dashboards in your own product, with live views, likes, comments and shares.</li>
        <li>Reporting pipelines that pull daily views into your data warehouse.</li>
        <li>Alerts when clips are approved, views climb, or a campaign starts or ends.</li>
        <li>Links to the client reports and PDFs we publish for each campaign.</li>
      </UL>
      <H2 id="how">How it works</H2>
      <P>
        The API is a read-only REST API over HTTPS that answers in JSON. Every request carries an API key, which we
        issue to approved partners. A key sees the campaigns it was given: every campaign, or only those of certain
        clients.
      </P>
      <Code title="Base URL" code={apiUrl()} />
      <Table />
      <Callout>
        <P>
          The API never shares money amounts, clippers&apos; contact details or payout information. Figures are the same
          ones the campaign&apos;s client sees in their report.
        </P>
      </Callout>
      <H2 id="next">Next</H2>
      <P>
        New here? Start with the <a href="/developers/quickstart">Quickstart</a>. No key yet?{' '}
        <a href="/developers/access">Ask for API access</a>.
      </P>
      <P>
        The full API is also described in OpenAPI 3.1 at <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>, for
        tools like Postman or a generated client.
      </P>
    </Page>
  )
}

function Table() {
  return (
    <div className="dx-tablewrap">
      <table className="dx-table">
        <thead>
          <tr>
            <th scope="col">Resource</th>
            <th scope="col">What it is</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <C>campaign</C>
            </td>
            <td>A campaign that has gone live, with its totals and the share of its budget delivered.</td>
          </tr>
          <tr>
            <td>
              <C>clip</C>
            </td>
            <td>A post a clipper made for a campaign, with its platform, link, page and stats.</td>
          </tr>
          <tr>
            <td>
              <C>report</C>
            </td>
            <td>A published client report, as a web page and a PDF.</td>
          </tr>
          <tr>
            <td>
              <C>webhook</C>
            </td>
            <td>An address of yours that receives events.</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
