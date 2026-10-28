import { apiUrl } from '@/developers/base'
import { C, Callout, CodeBlock, H2, P, Page, Table, UL } from '@/developers/ui'

export const metadata = { title: 'Webhooks' }

const EVENT = `{
  "id": "evt_4f1c0a9b2e7d6c5b8a3f1e20",
  "object": "event",
  "type": "clip.approved",
  "created_at": "2026-10-26T14:02:11.000Z",
  "livemode": true,
  "data": {
    "clip": { "id": "3f6c2a9e-...", "object": "clip", "stats": { "views": 17379, ... }, ... },
    "campaign": { "id": "9b2e4f10-...", "object": "campaign", "stats": { ... }, ... }
  }
}`

export default function Webhooks() {
  const base = apiUrl()
  return (
    <Page
      href="/developers/webhooks"
      eyebrow="Guides"
      title="Webhooks"
      lead="Get an HTTPS request on your server when something happens, instead of asking over and over."
    >
      <H2 id="events">Events</H2>
      <Table
        head={['Event', 'Sent when', 'data']}
        rows={[
          [<C key="1">clip.approved</C>, 'A clip passes review and starts to count.', 'clip, campaign'],
          [
            <C key="2">clip.views_updated</C>,
            "A clip's figures are read again and its views changed.",
            'clip, campaign',
          ],
          [<C key="3">campaign.started</C>, 'A campaign goes live, or is resumed.', 'campaign'],
          [<C key="4">campaign.ended</C>, 'A campaign ends.', 'campaign'],
        ]}
      />
      <P>You only get events for campaigns your key can see.</P>
      <H2 id="create">Add an endpoint</H2>
      <P>
        Create a webhook with the API. The answer has the <C>secret</C> that signs every delivery: store it, it is not
        shown again. A key can have up to 5 webhooks; the address must be public HTTPS.
      </P>
      <CodeBlock
        tabs={[
          {
            label: 'cURL',
            code: `curl ${base}/webhooks \\\n  -H "Authorization: Bearer $MDE_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "https://example.com/webhooks/maison", "events": ["clip.approved", "clip.views_updated"]}'`,
          },
        ]}
      />
      <H2 id="payload">What you receive</H2>
      <P>
        A <C>POST</C> with a JSON body. The <C>data</C> holds the clip and campaign exactly as the API returns them, so
        you rarely need a second request.
      </P>
      <CodeBlock tabs={[{ label: 'Body', code: EVENT }]} />
      <Table
        head={['Header', 'Holds']}
        rows={[
          [<C key="1">MDE-Event</C>, 'The event type.'],
          [<C key="2">MDE-Delivery</C>, 'The id of this delivery.'],
          [<C key="3">MDE-Signature</C>, 'The signature, as t=<time>,v1=<signature>.'],
        ]}
      />
      <H2 id="verify">Check the signature</H2>
      <P>
        Every delivery is signed with your webhook&apos;s secret. Compute an HMAC-SHA256 of <C>{'<t>.<raw body>'}</C>{' '}
        with the secret and compare it with <C>v1</C>. Reject requests where they differ or where <C>t</C> is more than
        five minutes old. Use the raw body exactly as received.
      </P>
      <CodeBlock
        tabs={[
          {
            label: 'Node.js',
            code: `import crypto from 'node:crypto'\n\nexport function verify(rawBody, header, secret) {\n  const { t, v1 } = Object.fromEntries(header.split(',').map((p) => p.split('=')))\n  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false\n  const expected = crypto.createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest('hex')\n  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))\n}`,
          },
          {
            label: 'Python',
            code: `import hashlib, hmac, time\n\ndef verify(raw_body: bytes, header: str, secret: str) -> bool:\n    parts = dict(p.split("=", 1) for p in header.split(","))\n    if abs(time.time() - int(parts["t"])) > 300:\n        return False\n    signed = parts["t"].encode() + b"." + raw_body\n    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()\n    return hmac.compare_digest(expected, parts["v1"])`,
          },
        ]}
      />
      <H2 id="answer">Answering and retries</H2>
      <UL>
        <li>Answer with any 2xx status within 10 seconds. Do the work afterwards, not before answering.</li>
        <li>
          Otherwise we try again after 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours, 12 hours and 24 hours, then
          stop.
        </li>
        <li>
          An event can arrive more than once and out of order. Use the event <C>id</C> to skip ones you have seen, and{' '}
          <C>updated_at</C> on the clip to keep the newest figures.
        </li>
        <li>Redirects are not followed: give the final address.</li>
      </UL>
      <H2 id="manage">Manage webhooks</H2>
      <P>
        <a href="/developers/reference/listWebhooks">List webhooks</a> shows yours, and{' '}
        <a href="/developers/reference/deleteWebhook">Delete a webhook</a> stops one at once. To change the address or
        events, create a new webhook and delete the old one.
      </P>
      <Callout>
        <P>
          Events are about what happens after your webhook exists. To catch up on earlier data, read it from the API.
        </P>
      </Callout>
    </Page>
  )
}
