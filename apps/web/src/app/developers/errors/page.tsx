import { C, Code, H2, P, Page, Table } from '@/developers/ui'

export const metadata = { title: 'Errors and limits' }

export default function Errors() {
  return (
    <Page
      href="/developers/errors"
      eyebrow="Guides"
      title="Errors and limits"
      lead="Errors use standard HTTP status codes and always have the same shape."
    >
      <Code
        title="Error"
        code={`{\n  "error": {\n    "type": "not_found",\n    "message": "No campaign with that id for this key."\n  }\n}`}
      />
      <Table
        head={['Status', 'type', 'Meaning']}
        rows={[
          ['400', <C key="a">invalid_request</C>, 'A parameter or the body is not valid. The message says which.'],
          ['401', <C key="b">unauthorized</C>, 'The key is missing, wrong or revoked.'],
          ['404', <C key="c">not_found</C>, 'Nothing with that id that this key can see, or no such endpoint.'],
          ['429', <C key="d">rate_limited</C>, 'Too many requests. Wait for the Retry-After seconds.'],
          ['500', <C key="e">server_error</C>, 'Something went wrong on our side. Try again shortly.'],
        ]}
      />
      <H2 id="limits">Rate limits</H2>
      <P>
        Each key can make 600 requests a minute. Over that, requests answer <C>429</C> with a <C>Retry-After</C> header
        in seconds. For live numbers, use <a href="/developers/webhooks">webhooks</a> instead of polling.
      </P>
      <H2 id="freshness">How fresh the numbers are</H2>
      <P>
        We read each clip&apos;s views from its platform on a schedule: often in its first hours, then about hourly.
        Every campaign and clip has <C>updated_at</C>, the time its figures were last read. Asking more often than that
        returns the same figures.
      </P>
      <H2 id="versions">Changes to the API</H2>
      <P>
        We add fields and endpoints without notice; your code should ignore fields it does not know. We never remove or
        rename a field without announcing it in the <a href="/developers/changelog">changelog</a> first.
      </P>
    </Page>
  )
}
