import { apiUrl } from '@/developers/base'
import { C, Callout, Code, H2, P, Page, Table, UL } from '@/developers/ui'

export const metadata = { title: 'Authentication' }

export default function Authentication() {
  return (
    <Page
      href="/developers/authentication"
      eyebrow="Get started"
      title="Authentication"
      lead="Every request carries an API key as a bearer token."
    >
      <Code title="Header" code={`Authorization: Bearer mde_live_...`} />
      <P>
        Requests without a key, with a wrong key or with a revoked key get <C>401 unauthorized</C>. All requests go over
        HTTPS to <C>{apiUrl()}</C>.
      </P>
      <H2 id="kinds">Live and sandbox keys</H2>
      <Table
        head={['Key starts with', 'Sees', 'Use it for']}
        rows={[
          [<C key="t">mde_test_</C>, 'Our demo campaigns only', 'Building and testing'],
          [<C key="l">mde_live_</C>, 'Your real campaigns', 'Production'],
        ]}
      />
      <P>
        The answers look the same either way; <C>livemode</C> on <a href="/developers/reference/getMe">/me</a> and on
        every webhook event tells you which one you are using.
      </P>
      <H2 id="scope">What a key can see</H2>
      <P>
        When we issue a key we set which campaigns it covers: every campaign, or the campaigns of certain clients.
        Anything outside that answers <C>404 not_found</C>, as if it did not exist.
      </P>
      <H2 id="safety">Keeping keys safe</H2>
      <UL>
        <li>Keep keys on your server, in an environment variable or a secrets manager.</li>
        <li>Never put a key in a website, a mobile app or a code repository.</li>
        <li>We store only a fingerprint of each key, so a lost key cannot be shown again: we issue a new one.</li>
        <li>If a key may have leaked, tell us and we revoke it at once. Its webhooks stop with it.</li>
      </UL>
      <Callout>
        <P>Keys only read. Nothing you do with a key can change a campaign, a clip or a payout.</P>
      </Callout>
    </Page>
  )
}
